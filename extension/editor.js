/* Shared form for page popovers and the settings dialog. Inputs are rendered as text. */
(() => {
  const Core = UserTagsCore;
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
    { state: initialState, identity, defaultSource = '', save, remove, createTag },
  ) {
    let state = initialState;
    const original = Core.index(state).users.get(Core.userKey(identity.site, identity.id));
    const expectedRecord = Core.recordToken(original);
    const selected = new Set(original?.tagIds || []);
    const form = element('form', { class: 'user-editor' });
    const error = element('div', { class: 'error', role: 'status', 'aria-live': 'polite' });
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
    const list = element('div', { class: 'list' });
    const name = element('input', {
      type: 'text',
      maxlength: '30',
      placeholder: '新标签名称',
      'aria-label': '新标签名称',
    });
    const color = element('input', { type: 'color', value: '#8b6bc6', 'aria-label': '标签颜色' });
    const field = (label, control) =>
      element('label', { class: 'field' }, [element('span', { text: label }), control]);
    function refresh(next) {
      state = next;
      const chosenLevel = level.options.length ? level.value : original?.levelId || '';
      level.replaceChildren(
        element('option', { value: '', text: '不设置等级' }),
        ...state.levels.map((item) => element('option', { value: item.id, text: item.name })),
      );
      level.value = chosenLevel;
      const existing = new Set(state.tags.map((tag) => tag.id));
      for (const id of selected) if (!existing.has(id)) selected.delete(id);
      list.replaceChildren(
        ...state.tags.map((tag) => {
          const checkbox = element('input', {
            type: 'checkbox',
            'aria-label': tag.name,
            onchange: () => (checkbox.checked ? selected.add(tag.id) : selected.delete(tag.id)),
          });
          checkbox.checked = selected.has(tag.id);
          return element('label', {}, [checkbox, badge(tag)]);
        }),
      );
      if (!state.tags.length)
        list.append(element('div', { class: 'empty', text: '暂无描述标签，可在下方创建。' }));
      const current = Core.index(state).users.get(Core.userKey(identity.site, identity.id));
      if (Core.recordToken(current) !== expectedRecord)
        error.textContent = '标记已在其他页面更新，请关闭后重新打开。';
    }
    async function busy(work) {
      if (form.getAttribute('aria-busy') === 'true') return;
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
        controls.forEach((control) => {
          control.disabled = false;
        });
        form.removeAttribute('aria-busy');
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
          name.value = '';
          refresh(next);
        }),
    });
    const submit = element('button', { class: 'primary', type: 'submit', text: '保存标记' });
    const clear = element('button', {
      class: 'secondary',
      type: 'button',
      text: '移除标记',
      onclick: () => busy(() => remove({ user: identity, expectedRecord })),
    });
    form.addEventListener('submit', (event) => {
      event.preventDefault();
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
    const knownDate = original?.createdAt ? new Date(original.createdAt).toLocaleString() : '未知';
    form.append(
      field('等级', level),
      element('div', { class: 'field-label', text: '描述标签' }),
      list,
      field('备注', note),
      field('来源链接', source),
      element('div', {
        class: 'sub',
        text: original ? '首次标记：' + knownDate : '保存时记录标记时间',
      }),
      element('div', { class: 'create' }, [
        element('span', { text: '新建描述标签' }),
        element('div', { class: 'row' }, [name, color]),
        add,
      ]),
      element('div', { class: 'actions' }, [clear, submit]),
      error,
    );
    container.append(form);
    refresh(state);
    return { refresh, element: form };
  }
  globalThis.UserTagsEditor = { element, badge, mount };
})();
