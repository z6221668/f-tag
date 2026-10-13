(async () => {
  const log = [];
  const assert = (condition, message) => {
    if (!condition) throw new Error(message);
    log.push('PASS ' + message);
  };
  const wait = () => new Promise((resolve) => setTimeout(resolve, 60));
  const call = async (message) => {
    const result = await chrome.runtime.sendMessage(message);
    if (!result.ok) throw new Error(result.error);
    return result.state;
  };
  if (new URLSearchParams(location.search).has('narrow')) document.body.classList.add('narrow');
  const container = document.getElementById('editor');
  if (new URLSearchParams(location.search).has('preview'))
    document.getElementById('result').hidden = true;
  const identity = { site: 'v2ex.com', id: 'member/alice', name: 'Alice' };
  let closed = false;
  let saved = false;
  try {
    for (const name of [
      '广告推广',
      '反复争吵',
      '信息不实',
      '认真讨论',
      '值得关注',
      '观点偏激',
      '刷屏',
    ])
      await call({ type: 'SAVE_TAG', tag: { name, color: '#8b6bc6' } });
    const editor = UserTagsEditor.mount(container, {
      state: testState(),
      identity,
      defaultSource: 'https://www.v2ex.com/t/1',
      save: async (values) => {
        await call({ type: 'SET_USER', ...values });
        saved = true;
      },
      remove: (values) => call({ type: 'DELETE_USER', ...values }),
      createTag: (tag) => call({ type: 'SAVE_TAG', tag }),
      deleteTag: (values) => call({ type: 'DELETE_TAG', ...values }),
    });
    const root = editor.element;
    const click = (text) => {
      const button = [...root.querySelectorAll('button')].find((node) => node.textContent === text);
      assert(
        Boolean(button) && button.getClientRects().length > 0,
        text + ' has a visible control',
      );
      button.click();
    };
    assert(!editor.isDirty(), 'new editor starts with no pending changes');
    assert(
      root.querySelector('button.danger').hidden,
      'unmarked users do not show a remove action',
    );
    assert(
      [...root.querySelectorAll('.tag-option button')].every((button) => button.hidden),
      'global deletion is hidden during normal selection',
    );
    assert(
      root.querySelector('.tag-search').hidden && !root.querySelector('.metadata').open,
      'small libraries hide search and optional inputs are collapsed by default',
    );
    for (const name of ['频繁跑题', '复制粘贴'])
      await call({ type: 'SAVE_TAG', tag: { name, color: '#8b6bc6' } });
    editor.refresh(testState());
    assert(!root.querySelector('.tag-search').hidden, 'larger libraries reveal tag search');
    root.querySelector('.tag-search').value = '信息';
    root.querySelector('.tag-search').dispatchEvent(new Event('input'));
    assert(
      root.querySelectorAll('input[type=checkbox]').length === 1,
      'tag search narrows the available choices',
    );
    root.querySelector('input[type=checkbox]').click();
    root.querySelector('.tag-search').value = '无匹配结果';
    root.querySelector('.tag-search').dispatchEvent(new Event('input'));
    assert(
      root.querySelector('.empty').textContent.includes('没有匹配'),
      'empty search has useful feedback',
    );
    root.querySelector('.tag-search').value = '';
    root.querySelector('.tag-search').dispatchEvent(new Event('input'));
    assert(
      root.querySelector('[aria-label="信息不实"]').checked,
      'searching does not discard the selection',
    );
    const name = root.querySelector('[aria-label="新标签名称"]');
    click('+ 新建');
    name.value = '刚创建的标签';
    name.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    await wait();
    assert(
      !saved && testState().tags.length === 10,
      'Enter in the new tag field creates a tag without saving the user',
    );
    assert(
      root.querySelector('.editor-feedback').textContent.includes('保存标记后'),
      'creation feedback explains that user assignment still needs saving',
    );
    assert(
      !root.querySelector('.create').open &&
        root.querySelector('[aria-label="刚创建的标签"]').checked,
      'new tag is selected and the creation form collapses',
    );
    root.querySelector('.metadata').open = true;
    root.querySelector('textarea').value = '还没有保存的备注';
    editor.requestClose(() => {
      closed = true;
    });
    assert(
      !closed && !root.querySelector('.tag-confirmation').hidden,
      'closing a dirty editor asks before discarding',
    );
    click('继续编辑');
    assert(
      root.querySelector('textarea').value === '还没有保存的备注',
      'continuing keeps the pending note',
    );
    click('管理标签库');
    assert(
      root.querySelectorAll('.tag-use').length === 10 && !root.querySelector('.tag-use').hidden,
      'management mode displays saved usage counts',
    );
    root.querySelector('[aria-label="删除标签“刚创建的标签”"]').click();
    assert(
      root.querySelector('.tag-confirmation').textContent.includes('立即保存'),
      'global deletion explains the immediate effect',
    );
    click('取消');
    assert(testState().tags.length === 10, 'cancelling deletion preserves the library');
    click('完成管理');
    root.querySelector('.metadata').open = true;
    await wait();
    const card = document.querySelector('.preview-card');
    card.scrollTop = card.scrollHeight;
    await wait();
    const cardRect = card.getBoundingClientRect();
    const saveRect = root.querySelector('.primary').getBoundingClientRect();
    assert(
      saveRect.bottom <= cardRect.bottom + 1 && saveRect.top >= cardRect.top,
      'save action stays reachable in a short scrolling editor',
    );
    assert(card.scrollWidth <= card.clientWidth + 1, 'editor does not overflow horizontally');
    assert(
      root.querySelector('select').value === '',
      'tag-only selection does not add an unwanted level',
    );
    click('保存标记');
    await wait();
    assert(
      saved &&
        testState().users[0].tagIds.length === 2 &&
        testState().users[0].note === '还没有保存的备注',
      'save applies the choices and note only to the current account',
    );
    editor.requestClose(() => {
      closed = true;
    });
    click('放弃修改');
    await wait();
    assert(
      closed && testState().tags.length === 10,
      'discarding a user draft keeps already created library tags',
    );
    // Leave a compact, populated editor for visual review.
    container.replaceChildren();
    const previewState = testState();
    previewState.tags = previewState.tags.filter(
      (tag, index) => index === 0 || previewState.users[0].tagIds.includes(tag.id),
    );
    UserTagsEditor.mount(container, {
      state: previewState,
      identity,
      save: (values) => call({ type: 'SET_USER', ...values }),
      remove: (values) => call({ type: 'DELETE_USER', ...values }),
      createTag: (tag) => call({ type: 'SAVE_TAG', tag }),
      deleteTag: (values) => call({ type: 'DELETE_TAG', ...values }),
    });
    card.scrollTop = 0;
    document.getElementById('result').textContent = 'ALL PASS\n' + log.join('\n');
  } catch (error) {
    document.getElementById('result').textContent =
      'FAILED ' + error.message + '\n' + log.join('\n');
  }
})();
