/* Shared form for page popovers and the settings dialog. Inputs are rendered as text. */
(() => {
  const Core = UserTagsCore;
  // Scoped styles keep the settings dialog and isolated page popover consistent.
  const style = `
.user-editor {
  --editor-accent: #191b15;
  --editor-muted: #66665a;
  font:
    13px/1.55 system-ui,
    -apple-system,
    sans-serif;
  color: #292333;
}
.user-editor,
.user-editor * {
  box-sizing: border-box;
}
.user-editor [hidden] {
  display: none !important;
}
.user-editor button,
.user-editor input,
.user-editor select,
.user-editor textarea {
  font: inherit;
}
.user-editor button {
  min-height: 34px;
  border-radius: 8px;
  padding: 6px 10px;
  border: 1px solid #d2d0c4;
  background: #fff;
  color: #574d63;
  cursor: pointer;
  transition:
    background 140ms,
    border-color 140ms;
}
.user-editor button:hover {
  background: #f5f5ed;
  border-color: #8c907e;
}
.user-editor .primary {
  background: var(--editor-accent);
  border-color: var(--editor-accent);
  color: #fff;
}
.user-editor .primary:hover {
  background: #34382c;
}
.user-editor .danger {
  color: #a52d45;
  background: #fff5f6;
  border-color: #ecc3cd;
}
.user-editor button:disabled {
  opacity: 0.55;
  cursor: wait;
}
.user-editor :is(button, input, select, textarea, summary):focus-visible {
  outline: 2px solid #737a5f;
  outline-offset: 3px;
}
.user-editor .field {
  display: grid;
  gap: 4px;
  margin: 8px 0;
  font-size: 12px;
}
.user-editor .field :is(input, select, textarea),
.user-editor .tag-search,
.user-editor .create input[type="text"] {
  width: 100%;
  min-width: 0;
  padding: 8px 10px;
  color: #292333;
  background: #fff;
  border: 1px solid #d2d0c4;
  border-radius: 8px;
}
.user-editor .field textarea {
  min-height: 70px;
  resize: vertical;
  font: inherit;
}
.user-editor .tag-heading {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  margin-top: 16px;
}
.user-editor .tag-heading button {
  font-size: 12px;
  min-height: 30px;
}
.user-editor .tag-heading .new-tag {
  border: 0;
  background: transparent;
  padding: 3px 0 3px 8px;
  min-height: 24px;
}
.user-editor button[aria-pressed="true"] {
  background: #eef2df;
  color: #34382c;
}
.user-editor .hint {
  color: var(--editor-muted);
  font-size: 12px;
  margin: 6px 0 10px;
  overflow-wrap: anywhere;
}
.user-editor .tag-search {
  margin-bottom: 6px;
  font-size: 12px;
}
.user-editor .list {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin: 6px 0;
  max-height: 144px;
  overflow: auto;
  padding: 2px;
}
.user-editor .tag-option {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}
.user-editor .tag-option label {
  display: flex;
  flex: 1;
  gap: 5px;
  align-items: center;
  min-width: 0;
  min-height: 28px;
  padding: 3px 5px;
  border: 1px solid #ddded3;
  border-radius: 5px;
  cursor: pointer;
  background: #fff;
  transition: background 140ms;
}
.user-editor .tag-option label:has(input:checked) {
  border-color: #71785e;
  background: #f1f5e7;
}
.user-editor .tag-option label:hover {
  background: #f5f5ed;
}
.user-editor .tag-option input {
  accent-color: var(--editor-accent);
  width: 12px;
  height: 12px;
  margin: 0;
  flex-shrink: 0;
}
.user-editor .tag-option button {
  flex-shrink: 0;
  font-size: 12px;
}
.user-editor .tag {
  display: inline-block;
  background: var(--color);
  color: var(--ink);
  border: 0;
  border-radius: 5px;
  padding: 1px 5px;
  font-size: 11px;
  max-width: 150px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.user-editor .tag-use {
  color: var(--editor-muted);
  font-size: 11px;
  margin-left: auto;
  white-space: nowrap;
}
.user-editor .empty {
  color: var(--editor-muted);
  font-size: 12px;
  padding: 10px 4px;
  margin: 0;
}
.user-editor .create {
  border: 0;
  padding: 0;
  margin-top: 8px;
}
.user-editor summary {
  cursor: pointer;
  font-size: 12px;
  color: #555b36;
  padding: 9px 0;
}
.user-editor .row {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 8px;
  margin: 8px 0;
}
.user-editor .create .row {
  flex-wrap: nowrap;
}
.user-editor .create input[type="color"] {
  width: 38px;
  height: 36px;
  padding: 3px;
  border: 1px solid #d2d0c4;
  border-radius: 7px;
  background: #fff;
  flex-shrink: 0;
}
.user-editor .create .row input[type="text"] {
  flex: 1;
}
.user-editor .create > button {
  width: 100%;
  margin-bottom: 10px;
}
.user-editor .editor-feedback {
  font-size: 12px;
  color: #555b36;
  margin: 8px 0 0;
  overflow-wrap: anywhere;
}
.user-editor .editor-feedback:empty {
  display: none;
}
.user-editor .metadata {
  border-top: 1px solid #ddded3;
  margin-top: 12px;
}
.user-editor .metadata .field {
  margin-top: 4px;
}
.user-editor .tag-confirmation {
  border: 1px solid #e6bbca;
  background: #fff7f8;
  border-radius: 9px;
  font-size: 12px;
  padding: 12px;
  margin-top: 12px;
  overflow-wrap: anywhere;
}
.user-editor .tag-confirmation .row {
  margin-bottom: 0;
}
.user-editor .actions {
  position: sticky;
  bottom: -1px;
  display: block;
  background: #fff;
  border-top: 1px solid #ddded3;
  margin-top: 10px;
  padding: 8px 0 2px;
  z-index: 1;
}
.user-editor .actions .primary {
  width: 100%;
  min-height: 34px;
}
.user-editor .save-state {
  margin-bottom: 5px;
  color: var(--editor-muted);
  font-size: 11px;
}
.user-editor .error {
  color: #a52d45;
  font-size: 12px;
  min-height: 0;
  margin: 8px 0;
  overflow-wrap: anywhere;
}
.user-editor .error:empty {
  display: none;
}
.user-editor.is-managing .list {
  display: grid;
}
.user-editor.is-managing .tag-option label {
  min-height: 32px;
}
.user-editor .create:not([open]),
.user-editor .create summary {
  display: none;
}
.user-editor .metadata summary {
  color: var(--editor-muted);
  padding: 7px 0;
}
@media (prefers-reduced-motion: reduce) {
  .user-editor *,
  .user-editor *::before,
  .user-editor *::after {
    transition: none !important;
    animation: none !important;
  }
}
`;
  function element(tag, attributes = {}, children = []) {
    const node = document.createElement(tag);
    for (const [key, value] of Object.entries(attributes)) {
      if (key === 'text') node.textContent = value;
      else if (key.startsWith('on')) node.addEventListener(key.slice(2), value);
      else node.setAttribute(key, value);
    }
    node.append(...children);
    return node;
  }
  function ink(color) {
    const channels = color
      .slice(1)
      .match(/../g)
      .map((value) => parseInt(value, 16) / 255)
      .map((value) => (value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4));
    return channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722 > 0.179
      ? '#17131e'
      : '#fff';
  }
  function badge(tag) {
    const node = element('span', { class: 'tag', text: tag.name, title: tag.name });
    node.style.setProperty('--color', tag.color);
    node.style.setProperty('--ink', ink(tag.color));
    return node;
  }
  function mount(
    container,
    { state: initialState, identity, defaultSource = '', save, remove, createTag, deleteTag },
  ) {
    let state = initialState;
    const original = Core.index(state).users.get(Core.userKey(identity.site, identity.id));
    let expectedUser = original;
    let expectedRecord = Core.recordToken(expectedUser);
    const selected = new Set(original?.tagIds || []);
    let managing = false;
    let pendingConfirmation = false;
    let focusAfterWork;
    const form = element('form', { class: 'user-editor' });
    const error = element('div', { class: 'error', role: 'status', 'aria-live': 'polite' });
    const feedback = element('div', {
      class: 'editor-feedback',
      role: 'status',
      'aria-live': 'polite',
    });
    const level = element('select', { 'aria-label': '用户等级', name: 'level' });
    const note = element('textarea', {
      maxlength: '2000',
      rows: '3',
      placeholder: '标记原因（可选）',
      'aria-label': '标记原因',
    });
    note.value = original?.note || '';
    const source = element('input', {
      type: 'url',
      maxlength: '2048',
      placeholder: 'https://…',
      'aria-label': '来源链接',
    });
    source.value = original?.sourceUrl || defaultSource;
    const baseline = {
      levelId: original?.levelId || '',
      tagIds: [...selected].sort(),
      note: note.value,
      sourceUrl: source.value,
    };
    function isDirty() {
      return (
        name.value !== '' ||
        Core.stableStringify({
          levelId: level.value,
          tagIds: [...selected].sort(),
          note: note.value,
          sourceUrl: source.value,
        }) !== Core.stableStringify(baseline)
      );
    }
    const saveState = element('div', { class: 'save-state' });
    function updateSummary() {
      tagHeading.textContent = managing ? '标签库' : '标签';
      tagHeading.setAttribute('aria-label', '标签，已选择 ' + selected.size + ' 个');
      saveState.hidden = !isDirty();
      saveState.textContent = '用户标记尚未保存';
    }
    const tagHeading = element('span');
    const hint = element('div', { class: 'hint' });
    const manage = element('button', {
      type: 'button',
      'aria-pressed': 'false',
      text: '管理标签库',
      onclick: () => {
        managing = !managing;
        hideConfirmation();
        refresh(state);
      },
    });
    const search = element('input', {
      type: 'search',
      class: 'tag-search',
      placeholder: '搜索已有标签',
      'aria-label': '搜索标签',
      oninput: () => renderTags(),
    });
    const list = element('div', { class: 'list' });
    const confirmation = element('div', { class: 'tag-confirmation', role: 'group' });
    confirmation.hidden = true;
    function hideConfirmation() {
      confirmation.hidden = true;
      pendingConfirmation = false;
    }
    function showConfirmation(text, confirmText, work, cancelText = '取消') {
      pendingConfirmation = true;
      const cancel = element('button', {
        type: 'button',
        text: cancelText,
        onclick: () => {
          hideConfirmation();
          (manage.hidden || !manage.closest('details')?.open ? level : manage).focus();
        },
      });
      const confirm = element('button', {
        type: 'button',
        class: 'danger',
        text: confirmText,
        onclick: () => busy(work),
      });
      confirmation.replaceChildren(
        element('div', { text }),
        element('div', { class: 'row' }, [cancel, confirm]),
      );
      confirmation.hidden = false;
      confirmation.scrollIntoView({ block: 'nearest' });
      cancel.focus({ preventScroll: true });
    }
    function confirmDeletion(tag) {
      const expectedRevision = state.revision;
      const count = state.users.filter((user) => user.tagIds.includes(tag.id)).length;
      showConfirmation(
        '从标签库删除“' +
          tag.name +
          '”？' +
          (count
            ? '会同时从 ' + count + ' 位用户的标记中移除。'
            : '此标签尚未用于任何已保存的用户。') +
          '此操作立即保存，可在设置页恢复删除前的快照。',
        '确认删除标签',
        async () => {
          const next = await deleteTag({ id: tag.id, expectedRevision });
          // Advance only the known deletion; unrelated concurrent edits must still conflict.
          if (expectedUser)
            expectedUser = {
              ...expectedUser,
              tagIds: expectedUser.tagIds.filter((id) => id !== tag.id),
            };
          expectedRecord = Core.recordToken(expectedUser);
          baseline.tagIds = baseline.tagIds.filter((id) => id !== tag.id);
          hideConfirmation();
          error.textContent = '';
          refresh(next);
          feedback.textContent = '已从标签库删除“' + tag.name + '”。';
          focusAfterWork = manage.hidden ? level : manage;
        },
      );
    }
    const name = element('input', {
      type: 'text',
      maxlength: '30',
      placeholder: '新标签名称',
      'aria-label': '新标签名称',
    });
    const color = element('input', { type: 'color', value: '#8b6bc6', 'aria-label': '标签颜色' });
    const field = (label, control) =>
      element('label', { class: 'field' }, [element('span', { text: label }), control]);
    function renderTags() {
      const active = form.getRootNode().activeElement;
      const activeTag =
        list.contains(active) && active?.type === 'checkbox'
          ? active.getAttribute('aria-label')
          : null;
      const query = search.value.trim().toLocaleLowerCase();
      const uses = new Map();
      if (managing)
        for (const user of state.users)
          for (const id of user.tagIds) uses.set(id, (uses.get(id) || 0) + 1);
      const tags = state.tags.filter((tag) => tag.name.toLocaleLowerCase().includes(query));
      list.replaceChildren(
        ...tags.map((tag) => {
          const checkbox = element('input', {
            type: 'checkbox',
            'aria-label': tag.name,
            onchange: () => {
              checkbox.checked ? selected.add(tag.id) : selected.delete(tag.id);
              if (checkbox.checked && level.value === 'clear') {
                level.value = '';
                feedback.textContent = '';
              }
              updateSummary();
            },
          });
          checkbox.checked = selected.has(tag.id);
          const row = element('div', { class: 'tag-option' }, [
            element('label', {}, [checkbox, badge(tag)]),
          ]);
          if (deleteTag) {
            const count = element('span', {
              class: 'tag-use',
              text: (uses.get(tag.id) || 0) + ' 人使用',
            });
            count.hidden = !managing;
            row.querySelector('label').append(count);
            const deletion = element('button', {
              type: 'button',
              class: 'danger',
              text: '删除标签',
              'aria-label': '删除标签“' + tag.name + '”',
              onclick: () => confirmDeletion(tag),
            });
            deletion.hidden = !managing;
            row.append(deletion);
          }
          return row;
        }),
      );
      if (!tags.length)
        list.append(
          element('div', {
            class: 'empty',
            text: state.tags.length
              ? '没有匹配的标签，可清空搜索或新建。'
              : '还没有描述标签，可先设置等级，或在下方新建。',
          }),
        );
      if (form.getAttribute('aria-busy') === 'true')
        list.querySelectorAll('button,input').forEach((control) => {
          control.disabled = true;
        });
      else if (activeTag)
        [...list.querySelectorAll('input')]
          .find((input) => input.getAttribute('aria-label') === activeTag)
          ?.focus({ preventScroll: true });
    }
    function refresh(next) {
      state = next;
      const chosenLevel = level.options.length ? level.value : original?.levelId || '';
      level.replaceChildren(
        element('option', { value: '', text: '选择等级（可选）', disabled: '' }),
        element('option', { value: 'clear', text: '清除标签' }),
        ...state.levels.map((item) => element('option', { value: item.id, text: item.name })),
      );
      level.value = chosenLevel;
      const existing = new Set(state.tags.map((tag) => tag.id));
      for (const id of selected) if (!existing.has(id)) selected.delete(id);
      manage.hidden = !deleteTag || !state.tags.length;
      manage.textContent = managing ? '完成管理' : '管理标签库';
      manage.setAttribute('aria-pressed', String(managing));
      form.classList.toggle('is-managing', managing);
      hint.textContent = managing
        ? '管理所有用户共用的标签。新建和删除会立即保存。'
        : '可多选，保存后应用于此用户。';
      hint.hidden = !managing;
      search.hidden = state.tags.length <= 8 && !search.value;
      renderTags();
      updateSummary();
      const current = Core.index(state).users.get(Core.userKey(identity.site, identity.id));
      if (Core.recordToken(current) !== expectedRecord)
        error.textContent = '标记已在其他页面更新，请关闭后重新打开。';
    }
    async function busy(work) {
      if (form.getAttribute('aria-busy') === 'true') return;
      const focused = form.getRootNode().activeElement;
      focusAfterWork = null;
      const controls = [...form.querySelectorAll('button,input,textarea,select')];
      controls.forEach((control) => {
        control.disabled = true;
      });
      form.setAttribute('aria-busy', 'true');
      error.textContent = '';
      try {
        await work();
      } catch (failure) {
        error.textContent = failure.message;
      } finally {
        form.querySelectorAll('button,input,textarea,select').forEach((control) => {
          control.disabled = false;
        });
        form.removeAttribute('aria-busy');
        if (form.isConnected) {
          const focusTarget = focusAfterWork || focused;
          if (focusTarget?.isConnected && focusTarget.getClientRects().length)
            focusTarget.focus({ preventScroll: true });
        }
      }
    }
    const add = element('button', {
      class: 'secondary',
      type: 'button',
      text: '创建并选中',
      onclick: () =>
        busy(async () => {
          const tagName = name.value.trim();
          if (!tagName) throw new Error('请输入标签名称');
          const next = await createTag({ name: tagName, color: color.value });
          selected.add(next.tags.find((tag) => tag.name === tagName).id);
          if (level.value === 'clear') level.value = '';
          name.value = '';
          search.value = '';
          create.open = false;
          hideConfirmation();
          refresh(next);
          feedback.textContent = '“' + tagName + '”已加入标签库并选中；保存标记后应用于此用户。';
          focusAfterWork = [...list.querySelectorAll('input')].find(
            (input) => input.getAttribute('aria-label') === tagName,
          );
        }),
    });
    const submit = element('button', { class: 'primary', type: 'submit', text: '保存标记' });
    const clear = element('button', {
      class: 'danger',
      type: 'button',
      text: '移除标记',
      onclick: () =>
        showConfirmation(
          '移除 ' + identity.name + ' 的等级、标签和备注？标签库中的标签会保留。',
          '确认移除标记',
          async () => {
            await remove({ user: identity, expectedRecord });
          },
        ),
    });
    clear.hidden = !original;
    const create = element('details', { class: 'create' }, [
      element('summary', { text: '新建标签' }),
      element('div', { class: 'hint', text: '新标签会立即存入标签库，所有用户均可选用。' }),
      element('div', { class: 'row' }, [name, color]),
      add,
    ]);
    const newTag = element('button', {
      type: 'button',
      class: 'new-tag',
      text: '+ 新建',
      'aria-expanded': 'false',
      onclick: () => {
        create.open = !create.open;
        if (create.open) name.focus();
      },
    });
    create.id = 'f-tag-create-' + crypto.randomUUID();
    newTag.setAttribute('aria-controls', create.id);
    create.addEventListener('toggle', () => {
      newTag.setAttribute('aria-expanded', String(create.open));
    });
    name.addEventListener('keydown', (event) => {
      if (event.key === 'Enter' && !event.isComposing) {
        event.preventDefault();
        add.click();
      }
    });
    level.addEventListener('change', () => {
      if (level.value === 'clear') {
        selected.clear();
        note.value = '';
        source.value = '';
        name.value = '';
        search.value = '';
        managing = false;
        hideConfirmation();
        create.open = false;
        refresh(state);
        feedback.textContent = '保存后清除此用户的标记，标签库会保留。';
      } else {
        feedback.textContent = '';
      }
      updateSummary();
    });
    note.addEventListener('input', () => {
      if (level.value === 'clear' && note.value.trim()) {
        level.value = '';
        feedback.textContent = '';
        updateSummary();
      }
    });
    form.addEventListener('input', updateSummary);
    form.addEventListener('change', updateSummary);
    form.addEventListener('submit', (event) => {
      event.preventDefault();
      if (pendingConfirmation) {
        error.textContent = '请先完成当前确认，或点击取消。';
        return;
      }
      if (name.value.trim()) {
        create.open = true;
        error.textContent = '新标签尚未创建，请先点击“创建并选中”，或清空名称后保存标记。';
        name.focus();
        return;
      }
      if (
        level.value === 'clear' ||
        (original && !level.value && !selected.size && !note.value.trim())
      ) {
        busy(() => remove({ user: identity, expectedRecord }));
        return;
      }
      busy(() =>
        save({
          user: {
            ...identity,
            levelId: level.value || null,
            tagIds: [...selected],
            note: note.value.trim(),
            sourceUrl: source.value.trim(),
          },
          expectedRecord,
        }),
      );
    });
    form.addEventListener(
      'invalid',
      (event) => {
        const details = event.target.closest('details');
        if (details) details.open = true;
      },
      true,
    );
    const knownDate = original?.createdAt ? new Date(original.createdAt).toLocaleString() : '未知';
    form.append(
      element('style', { text: style }),
      field('等级', level),
      element('div', { class: 'tag-heading' }, [tagHeading, newTag]),
      hint,
      search,
      list,
      create,
      feedback,
      confirmation,
      element('details', { class: 'metadata' }, [
        element('summary', { text: '更多操作' }),
        manage,
        field('备注', note),
        field('来源链接', source),
        element('div', {
          class: 'hint',
          text: original ? '首次标记：' + knownDate : '保存时记录标记时间',
        }),
        clear,
      ]),
      error,
      element('div', { class: 'actions' }, [saveState, submit]),
    );
    container.append(form);
    const extras = form.querySelector('.metadata');
    extras.addEventListener('toggle', () => {
      if (!extras.open && managing) {
        managing = false;
        hideConfirmation();
        refresh(state);
      }
    });
    refresh(state);
    function requestClose(close) {
      if (form.getAttribute('aria-busy') === 'true') return;
      if (!isDirty()) {
        close();
        return;
      }
      showConfirmation(
        '当前用户的修改尚未保存。放弃这些修改？已新建或删除的标签库内容会保留。',
        '放弃修改',
        async () => close(),
        '继续编辑',
      );
    }
    return { refresh, element: form, requestClose, isDirty };
  }
  globalThis.UserTagsEditor = { element, badge, mount };
})();
