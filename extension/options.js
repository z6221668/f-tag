(() => {
  const Core = UserTagsCore;
  const $ = (id) => document.getElementById(id);
  const make = FTagClient.element;
  const version = chrome.runtime.getManifest().version;
  let state,
    lookup,
    recovery,
    undo,
    editingTag,
    editor,
    visibleLimit = 100;

  function status(text, error = false) {
    $('status').textContent = text;
    $('status').classList.toggle('error', error);
  }
  async function action(work) {
    try {
      await work();
    } catch (failure) {
      status(failure.message, true);
    }
  }
  function accept(next) {
    if (state && next.revision < state.revision) return;
    state = next;
    lookup = Core.index(state);
    editor?.refresh(state);
    render();
  }
  async function loadStatus() {
    const result = await FTagClient.call({ type: 'GET_STATUS' });
    recovery = result.recovery;
    undo = result.undo;
    accept(result.state);
    renderRecovery();
  }
  async function update(message, note = '已保存') {
    accept(await FTagClient.request(message));
    await loadStatus();
    status(note);
  }
  function confirmAction(text) {
    const dialog = $('confirm-dialog');
    $('confirm-text').textContent = text;
    return new Promise((resolve) => {
      function finish(answer) {
        dialog.close();
        $('confirm-yes').removeEventListener('click', yes);
        $('confirm-no').removeEventListener('click', no);
        dialog.removeEventListener('cancel', cancel);
        resolve(answer);
      }
      const yes = () => finish(true);
      const no = () => finish(false);
      const cancel = (event) => {
        event.preventDefault();
        finish(false);
      };
      $('confirm-yes').addEventListener('click', yes);
      $('confirm-no').addEventListener('click', no);
      dialog.addEventListener('cancel', cancel);
      dialog.showModal();
      $('confirm-no').focus();
    });
  }
  function resetTagForm() {
    editingTag = undefined;
    $('tag-form').reset();
    $('tag-save').textContent = '新增';
    $('tag-cancel').hidden = true;
  }
  function button(text, handler, className) {
    const node = make('button', text, className);
    node.type = 'button';
    node.addEventListener('click', () =>
      action(async () => {
        node.disabled = true;
        try {
          await handler();
        } finally {
          node.disabled = false;
        }
      }),
    );
    return node;
  }
  function openUser(user) {
    $('edit-content').replaceChildren();
    $('edit-title').textContent = user.name;
    const closeEditor = () => {
      $('edit-dialog').close();
      editor = null;
    };
    const finish = async (type, values) => {
      await update({ type, ...values });
      closeEditor();
    };
    editor = UserTagsEditor.mount($('edit-content'), {
      state,
      identity: { site: user.site, id: user.id, name: user.name },
      save: (values) => finish('SET_USER', values),
      remove: (values) => finish('DELETE_USER', values),
      createTag: async (tag) => {
        await update({ type: 'SAVE_TAG', tag });
        return state;
      },
    });
    $('edit-dialog').showModal();
    $('edit-close').focus();
  }
  function renderUsers() {
    const query = $('search').value.trim().toLowerCase();
    const users = state.users.filter((user) => {
      const names = user.tagIds.map((id) => lookup.tags.get(id)?.name || '').join(' ');
      const level = lookup.levels.get(user.levelId)?.name || '';
      return [user.name, user.id, user.site, names, level, user.note]
        .join(' ')
        .toLowerCase()
        .includes(query);
    });
    $('users').replaceChildren(
      ...users.slice(0, visibleLimit).map((user) => {
        const row = make('tr');
        const account = make('td');
        account.append(make('div', user.name), make('div', user.id, 'account'));
        const details = make('td');
        const chips = make('div', undefined, 'chips');
        const definitions = [
          lookup.levels.get(user.levelId),
          ...user.tagIds.map((id) => lookup.tags.get(id)),
        ].filter(Boolean);
        chips.append(...definitions.map((tag) => FTagClient.chip(tag)));
        details.append(chips);
        if (user.note) details.append(make('div', user.note, 'record-note'));
        details.append(
          make(
            'div',
            user.updatedAt ? '更新于 ' + new Date(user.updatedAt).toLocaleString() : '标记时间未知',
            'account',
          ),
        );
        if (user.sourceUrl) {
          const link = make('a', '来源');
          link.href = user.sourceUrl;
          link.target = '_blank';
          link.rel = 'noopener noreferrer';
          details.append(link);
        }
        const operations = make('td');
        operations.append(
          button('编辑', () => openUser(user)),
          button(
            '移除',
            async () => {
              if (await confirmAction('移除 ' + user.name + ' 的标记？'))
                await update(
                  { type: 'DELETE_USER', user, expectedRecord: Core.recordToken(user) },
                  '已移除标记，可撤销',
                );
            },
            'danger',
          ),
        );
        row.append(account, make('td', user.site), details, operations);
        return row;
      }),
    );
    if (users.length > visibleLimit) {
      const row = make('tr'),
        cell = make('td');
      cell.colSpan = 4;
      cell.append(
        button(`再显示 100 条（共 ${users.length} 条）`, () => {
          visibleLimit += 100;
          renderUsers();
        }),
      );
      row.append(cell);
      $('users').append(row);
    }
    $('empty').hidden = users.length > 0;
    $('user-count').textContent = `${state.users.length} 位`;
  }
  function renderRecovery() {
    const reasons = {
      import: '导入前',
      migration: '升级前',
      'delete-tag': '删除标签前',
      restore: '恢复前',
    };
    $('recovery-info').textContent = recovery
      ? `${reasons[recovery.reason] || '操作前'}快照 · ${new Date(recovery.createdAt).toLocaleString()}`
      : '暂无恢复快照';
    $('restore').disabled = !recovery;
    $('undo').disabled = !undo;
    $('undo').textContent = undo ? '撤销 ' + undo.name + ' 的上次标记' : '撤销上次标记';
  }
  function render() {
    $('enabled').checked = state.settings.enabled;
    $('levels').replaceChildren(
      ...state.levels.map((level) => {
        const form = make('form', undefined, 'row');
        const name = make('input');
        name.type = 'text';
        name.value = level.name;
        name.maxLength = 30;
        name.required = true;
        name.setAttribute('aria-label', '等级 ' + level.rank + ' 名称');
        const color = make('input');
        color.type = 'color';
        color.value = level.color;
        color.setAttribute('aria-label', '等级 ' + level.rank + ' 颜色');
        const save = make('button', '保存');
        save.type = 'submit';
        form.append(make('span', String(level.rank), 'muted'), name, color, save);
        form.addEventListener('submit', (event) => {
          event.preventDefault();
          action(() =>
            update({
              type: 'SAVE_LEVEL',
              level: { id: level.id, name: name.value.trim(), color: color.value },
            }),
          );
        });
        return form;
      }),
    );
    $('tags').replaceChildren(
      ...state.tags.map((tag) => {
        const row = make('div', undefined, 'item');
        const label = make('div', undefined, 'label');
        label.append(FTagClient.chip(tag));
        row.append(
          label,
          button('编辑', () => {
            editingTag = tag.id;
            $('tag-name').value = tag.name;
            $('tag-color').value = tag.color;
            $('tag-save').textContent = '保存';
            $('tag-cancel').hidden = false;
            $('tag-name').focus();
          }),
          button(
            '删除',
            async () => {
              if (
                await confirmAction(
                  '删除标签“' + tag.name + '”？所有用户上的此标签也会移除，删除前会保存恢复快照。',
                )
              ) {
                await update({ type: 'DELETE_TAG', id: tag.id });
                if (editingTag === tag.id) resetTagForm();
              }
            },
            'danger',
          ),
        );
        return row;
      }),
    );
    $('exclusions').replaceChildren(
      ...state.settings.excludedSites.map((hostname) => {
        const row = make('div', undefined, 'item');
        row.append(
          make('span', hostname, 'label'),
          button('移除', () => update({ type: 'SET_EXCLUDED', host: hostname, excluded: false })),
        );
        return row;
      }),
    );
    renderUsers();
  }

  $('tag-form').addEventListener('submit', (event) => {
    event.preventDefault();
    action(async () => {
      await update({
        type: 'SAVE_TAG',
        tag: { id: editingTag, name: $('tag-name').value.trim(), color: $('tag-color').value },
      });
      resetTagForm();
    });
  });
  $('tag-cancel').addEventListener('click', resetTagForm);
  $('enabled').addEventListener('change', () =>
    action(() => update({ type: 'SET_ENABLED', enabled: $('enabled').checked })),
  );
  $('exclude-form').addEventListener('submit', (event) => {
    event.preventDefault();
    action(async () => {
      await update({ type: 'SET_EXCLUDED', host: $('exclude-host').value, excluded: true });
      $('exclude-host').value = '';
    });
  });
  $('search').addEventListener('input', () => {
    visibleLimit = 100;
    renderUsers();
  });
  $('rules-save').addEventListener('click', () =>
    action(async () => {
      let rules;
      try {
        rules = JSON.parse($('rules').value || '[]');
      } catch {
        throw new Error('规则不是有效的 JSON');
      }
      const candidate = Core.validate({ ...state, settings: { ...state.settings, rules } });
      FTagClient.validateRules(candidate.settings.rules);
      await update({ type: 'SET_RULES', rules: candidate.settings.rules });
    }),
  );
  $('export').addEventListener('click', () =>
    action(async () => {
      const latest = await FTagClient.request({ type: 'GET_STATE' });
      const file = Core.backup(latest, version);
      const url = URL.createObjectURL(
        new Blob([JSON.stringify(file, null, 2)], { type: 'application/json' }),
      );
      const link = make('a');
      link.href = url;
      link.download = 'f-tag-' + version + '-' + new Date().toISOString().slice(0, 10) + '.json';
      document.body.append(link);
      link.click();
      link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      status('备份已导出');
    }),
  );
  $('import').addEventListener('click', () => $('import-file').click());
  $('import-file').addEventListener('change', () =>
    action(async () => {
      const file = $('import-file').files[0];
      $('import-file').value = '';
      if (!file) return;
      if (file.size > 8 * 1024 * 1024) throw new Error('备份文件超过 8 MB，请检查文件');
      let backup;
      try {
        backup = JSON.parse(await file.text());
      } catch {
        throw new Error('文件不是有效的 JSON 备份');
      }
      const incoming = Core.readBackup(backup, version);
      FTagClient.validateRules(incoming.settings.rules);
      await loadStatus();
      const expectedRevision = state.revision;
      if (
        !(await confirmAction(
          `导入 ${incoming.users.length} 位用户，替换当前记录和设置？覆盖前将保存本地恢复快照。`,
        ))
      )
        return;
      await update({ type: 'IMPORT', backup, expectedRevision }, '备份已导入，原记录可从快照恢复');
      resetTagForm();
      $('rules').value = JSON.stringify(state.settings.rules, null, 2);
    }),
  );
  $('restore').addEventListener('click', () =>
    action(async () => {
      await loadStatus();
      if (!recovery) throw new Error('没有可恢复的本地快照');
      const expectedRevision = state.revision;
      if (await confirmAction('恢复操作前的记录和设置？当前记录也将保存为新的快照。')) {
        await update({ type: 'RESTORE_SNAPSHOT', expectedRevision }, '快照已恢复');
        $('rules').value = JSON.stringify(state.settings.rules, null, 2);
      }
    }),
  );
  $('undo').addEventListener('click', () =>
    action(async () => {
      if (!undo) throw new Error('没有可撤销的标记');
      await update({ type: 'UNDO_USER', token: undo.token }, '已撤销上次标记');
    }),
  );
  $('edit-close').addEventListener('click', () => {
    $('edit-dialog').close();
    editor = null;
  });
  $('edit-dialog').addEventListener('close', () => {
    editor = null;
  });
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== 'local') return;
    if (changes.userTagsState?.newValue) accept(changes.userTagsState.newValue);
    if (changes.userTagsRecovery || changes.userTagsUndo) action(loadStatus);
  });
  action(async () => {
    await loadStatus();
    $('version').textContent = '版本 ' + version;
    $('rules').value = JSON.stringify(state.settings.rules, null, 2);
  });
})();
