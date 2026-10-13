(() => {
  const Core = UserTagsCore;
  const Adapters = UserTagsAdapters;
  let state,
    lookup,
    panel,
    notice,
    timer = null,
    observer,
    stopped = false,
    selectorError = false;
  const entries = new Map();
  const pendingRoots = new Set([document]);
  const style = `
:host {
  all: initial;
  display: inline-block;
  vertical-align: middle;
  margin-inline-start: 6px;
  color-scheme: light;
  font-family:
    system-ui,
    -apple-system,
    sans-serif;
}
* {
  box-sizing: border-box;
}
button,
input,
select,
textarea {
  font: inherit;
}
button {
  cursor: pointer;
}
.marks {
  display: inline-flex;
  gap: 4px;
  align-items: center;
  flex-wrap: wrap;
  line-height: 1.5;
}
.tag {
  border: 1px solid var(--color);
  background: var(--color);
  color: var(--ink);
  border-radius: 5px;
  padding: 1px 6px;
  font-size: 11px;
  max-width: 160px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.trigger {
  font-size: 10px;
  color: #787080;
  background: #f6f3fa;
  border: 1px solid #ded7e8;
  border-radius: 5px;
  padding: 1px 5px;
  line-height: 1.5;
}
.trigger:hover,
.trigger:focus-visible {
  color: #6242b5;
  border-color: #8b6bc6;
}
.panel {
  position: fixed;
  width: 330px;
  max-width: calc(100vw - 24px);
  max-height: calc(100vh - 24px);
  overflow: auto;
  background: #fff;
  color: #262332;
  border: 1px solid #c6c3b7;
  border-radius: 9px;
  box-shadow: 0 12px 60px #21143e30;
  padding: 16px;
  font-size: 13px;
  line-height: 1.6;
  animation: panel-enter 140ms ease-out;
}
@keyframes panel-enter { from { opacity: 0; transform: translateY(4px); } to { opacity: 1; transform: translateY(0); } }
@media (prefers-reduced-motion: reduce) { .panel { animation: none; } }
h2 {
  font-size: 17px;
  margin: 0 24px 2px 0;
  overflow-wrap: anywhere;
}
.sub {
  font-size: 11px;
  color: #827b8c;
  overflow-wrap: anywhere;
  margin-bottom: 16px;
}
.close {
  position: absolute;
  right: 12px;
  top: 10px;
  border: 0;
  background: transparent;
  font-size: 20px;
  color: #827b8c;
}
.primary,
.secondary {
  border: 0;
  border-radius: 8px;
  padding: 8px 12px;
  font-size: 12px;
}
.primary {
  background: #7652bf;
  color: white;
}
.secondary {
  background: #f2edf9;
  color: #6242a0;
}
.notice {
  position: fixed;
  bottom: 18px;
  right: 18px;
  max-width: calc(100vw - 36px);
  background: #fff;
  color: #262332;
  border: 1px solid #e4dfee;
  border-radius: 12px;
  padding: 16px 36px 16px 16px;
  box-shadow: 0 6px 30px #21143e30;
  display: flex;
  align-items: center;
  gap: 12px;
  font-size: 13px;
}
.notice .close {
  right: 8px;
  top: 4px;
}
button:disabled {
  opacity: 0.5;
  cursor: wait;
}
`;
  const el = UserTagsEditor.element;
  const badge = UserTagsEditor.badge;
  function acceptState(next) {
    if (state && next.revision < state.revision) return;
    state = next;
    lookup = Core.index(state);
  }
  async function request(message) {
    let result;
    try {
      result = await chrome.runtime.sendMessage(message);
    } catch {
      throw new Error('插件连接已失效，请刷新页面后重试');
    }
    if (!result?.ok) throw new Error(result?.error || '保存失败，请重试');
    acceptState(result.state);
    return { ...result, state };
  }
  function notify(message, undoToken) {
    notice?.remove();
    const host = el('span', { 'data-user-tags-notice': '' });
    host.style.setProperty('position', 'fixed', 'important');
    host.style.setProperty('z-index', '2147483647', 'important');
    const shadow = host.attachShadow({ mode: 'closed' });
    const box = el('div', { class: 'notice', role: 'status' }, [el('span', { text: message })]);
    if (undoToken)
      box.append(
        el('button', {
          type: 'button',
          class: 'secondary',
          text: '撤销',
          onclick: async (event) => {
            event.target.disabled = true;
            try {
              await request({ type: 'UNDO_USER', token: undoToken });
              refreshMarks();
              notify('已撤销上次标记');
            } catch (error) {
              notify(error.message);
            }
          },
        }),
      );
    box.append(
      el('button', {
        type: 'button',
        class: 'close',
        text: '×',
        'aria-label': '关闭提示',
        onclick: () => host.remove(),
      }),
    );
    shadow.append(el('style', { text: style }), box);
    document.documentElement.append(host);
    notice = host;
  }
  function close() {
    if (!panel) return;
    panel.resize?.disconnect();
    const trigger = panel.entry.shadow.querySelector('.trigger');
    panel.host.remove();
    panel = null;
    trigger?.focus({ preventScroll: true });
  }
  function draw(entry) {
    const user = lookup.users.get(Core.userKey(entry.user.site, entry.user.id));
    const tags = user
      ? [lookup.levels.get(user.levelId), ...user.tagIds.map((id) => lookup.tags.get(id))].filter(
          Boolean,
        )
      : [];
    const signature = JSON.stringify([tags, user?.note, entry.user.name]);
    if (entry.signature === signature) return;
    entry.signature = signature;
    const button = el('button', {
      class: 'trigger',
      type: 'button',
      text: 'Tag',
      'aria-label': '标记用户 ' + entry.user.name,
      onclick: (event) => {
        event.preventDefault();
        event.stopPropagation();
        openPanel(entry, button);
      },
    });
    const marks = el('span', { class: 'marks' }, [...tags.map(badge), button]);
    if (user?.note) marks.title = user.note;
    entry.shadow.replaceChildren(el('style', { text: style }), marks);
  }
  function refreshMarks() {
    for (const entry of entries.values()) draw(entry);
  }
  function openPanel(entry, trigger) {
    if (panel) {
      panel.editor.requestClose(() => {
        close();
        openPanel(entry, trigger);
      });
      return;
    }
    const host = el('span', { 'data-user-tags-panel': '' });
    host.style.setProperty('position', 'fixed', 'important');
    host.style.setProperty('z-index', '2147483647', 'important');
    const shadow = host.attachShadow({ mode: 'closed' });
    const box = el('section', {
      class: 'panel',
      role: 'dialog',
      'aria-modal': 'true',
      'aria-label': '用户标签',
    });
    box.append(
      el('button', {
        class: 'close',
        type: 'button',
        text: '×',
        'aria-label': '关闭',
        onclick: () => editor.requestClose(close),
      }),
      el('h2', { text: entry.user.name }),
      el('div', {
        class: 'sub',
        text: entry.user.site,
        title: entry.user.site + ' · ' + entry.user.id,
      }),
    );
    const finish = async (type, values) => {
      const result = await request({ type, ...values });
      refreshMarks();
      if (panel?.host === host) close();
      notify(type === 'DELETE_USER' ? '已移除标记' : '标记已保存', result.undo?.token);
    };
    const editor = UserTagsEditor.mount(box, {
      state,
      identity: entry.user,
      defaultSource: location.href,
      save: (values) => finish('SET_USER', values),
      remove: (values) => finish('DELETE_USER', values),
      createTag: async (tag) => {
        const result = await request({ type: 'SAVE_TAG', tag });
        refreshMarks();
        return result.state;
      },
      deleteTag: async (values) => {
        const result = await request({ type: 'DELETE_TAG', ...values });
        refreshMarks();
        return result.state;
      },
    });
    shadow.append(el('style', { text: style }), box);
    document.documentElement.append(host);
    panel = { host, trigger, entry, editor };
    const position = () => {
      const rect = entry.host.getBoundingClientRect();
      box.style.left = Math.max(12, Math.min(rect.left, innerWidth - box.offsetWidth - 12)) + 'px';
      box.style.top =
        Math.max(12, Math.min(rect.bottom + 8, innerHeight - box.offsetHeight - 12)) + 'px';
    };
    panel.resize = new ResizeObserver(position);
    panel.resize.observe(box);
    position();
    shadow.addEventListener('keydown', (event) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        event.stopPropagation();
        editor.requestClose(close);
      }
      if (event.key !== 'Tab') return;
      const focusables = [...box.querySelectorAll('button,input,select,textarea,summary')].filter(
        (n) =>
          !n.disabled &&
          !n.closest('[hidden]') &&
          (!n.closest('details:not([open])') || n.tagName === 'SUMMARY') &&
          n.getClientRects().length > 0,
      );
      const first = focusables[0],
        last = focusables.at(-1);
      if (event.shiftKey && shadow.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && shadow.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    });
    box.querySelector('select').focus();
  }
  document.addEventListener(
    'pointerdown',
    (event) => {
      if (
        panel &&
        !event.composedPath().includes(panel.host) &&
        !event.composedPath().includes(panel.trigger)
      )
        panel.editor.requestClose(close);
    },
    true,
  );
  function active() {
    return (
      !document.hidden &&
      state.settings.enabled &&
      !Core.excluded(location.hostname, state.settings)
    );
  }
  function scan() {
    timer = null;
    if (stopped) return;
    // Disconnect while adding our hosts so our own mutations cannot cause a scan loop.
    observer.disconnect();
    try {
      const isActive = active();
      const selector = Adapters.selector(location.hostname, state.settings.rules);
      selectorError = false;
      try {
        if (isActive) document.querySelector(selector);
      } catch {
        selectorError = true;
        for (const entry of entries.values()) entry.host.remove();
        entries.clear();
        close();
        notify('此站点的自定义选择器无效，请在插件设置中修正。');
        return;
      }
      for (const [link, entry] of entries) {
        const current = Adapters.identity(
          link.getAttribute('href'),
          location.href,
          state.settings.rules,
        );
        let matches = false;
        try {
          matches = link.matches(selector);
        } catch {
          /* Invalid imported selector disables this site's matching. */
        }
        if (
          !isActive ||
          !matches ||
          !link.isConnected ||
          !entry.host.isConnected ||
          !current ||
          current.site !== entry.user.site ||
          current.id !== entry.user.id
        ) {
          if (panel?.entry === entry) close();
          entry.host.remove();
          entries.delete(link);
        } else if (link.textContent.trim() !== entry.user.name) {
          entry.user.name = link.textContent.trim();
          draw(entry);
        }
      }
      if (!active()) {
        close();
        return;
      }
      const roots = [...pendingRoots];
      pendingRoots.clear();
      const links = new Set();
      try {
        for (const root of roots) {
          if (root !== document && !root.isConnected) continue;
          if (root.matches?.(selector)) links.add(root);
          for (const link of root.querySelectorAll?.(selector) || []) links.add(link);
        }
      } catch {
        return;
      }
      for (const link of links) {
        if (
          !(link instanceof HTMLAnchorElement) ||
          entries.has(link) ||
          link.closest('[data-user-tags-panel],[data-user-tags-host],[data-user-tags-notice]')
        )
          continue;
        if (
          link.isContentEditable ||
          link.closest('textarea,input,button,[contenteditable="true"]')
        )
          continue;
        const name = link.textContent.trim();
        if (
          !name ||
          name.length > 120 ||
          link.querySelector('img') ||
          link.getAttribute('aria-hidden') === 'true'
        )
          continue;
        const user = Adapters.identity(
          link.getAttribute('href'),
          location.href,
          state.settings.rules,
        );
        if (!user) continue;
        const host = el('span', { 'data-user-tags-host': '' });
        const entry = {
          user: { ...user, name },
          host,
          shadow: host.attachShadow({ mode: 'closed' }),
        };
        link.after(host);
        entries.set(link, entry);
        draw(entry);
      }
    } finally {
      if (active() && !selectorError)
        observer.observe(document.documentElement, {
          childList: true,
          subtree: true,
          attributes: true,
          attributeFilter: ['href'],
          characterData: true,
        });
    }
  }
  function schedule(full = true) {
    if (full) {
      pendingRoots.clear();
      pendingRoots.add(document);
    }
    if (!timer && !stopped) timer = setTimeout(scan, 160);
  }
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== 'local' || !changes.userTagsState?.newValue) return;
    if (state && changes.userTagsState.newValue.revision < state.revision) return;
    acceptState(changes.userTagsState.newValue);
    panel?.editor.refresh(state);
    refreshMarks();
    schedule();
  });
  request({ type: 'GET_STATE' })
    .then(() => {
      observer = new MutationObserver((records) => {
        for (const record of records) {
          const root =
            record.target.nodeType === Node.TEXT_NODE ? record.target.parentElement : record.target;
          if (
            root &&
            !root.closest?.('[data-user-tags-panel],[data-user-tags-host],[data-user-tags-notice]')
          )
            pendingRoots.add(root);
        }
        if (pendingRoots.size > 50) {
          pendingRoots.clear();
          pendingRoots.add(document);
        }
        schedule(false);
      });
      scan();
      addEventListener('popstate', () => schedule());
      addEventListener('hashchange', () => schedule());
      if (globalThis.navigation) navigation.addEventListener('navigatesuccess', () => schedule());
      addEventListener('pagehide', () => {
        observer.disconnect();
        clearTimeout(timer);
        timer = null;
        stopped = true;
        close();
        notice?.remove();
      });
      addEventListener('pageshow', () => {
        stopped = false;
        schedule();
      });
      document.addEventListener('visibilitychange', () => {
        if (document.hidden) {
          observer.disconnect();
          clearTimeout(timer);
          timer = null;
          close();
        } else schedule();
      });
    })
    .catch((error) => notify(error.message));
})();
