(async () => {
  const log = [],
    wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
  const assert = (condition, message) => {
    if (!condition) throw new Error(message);
    log.push('PASS ' + message);
  };
  const host = (id) => document.getElementById(id).nextElementSibling;
  const marks = (id) => testShadow(host(id));
  const panel = () => testShadow(document.querySelector('[data-user-tags-panel]'));
  const click = (root, text) =>
    [...root.querySelectorAll('button')].find((node) => node.textContent === text).click();
  try {
    await wait(240);
    assert(
      document.querySelectorAll('[data-user-tags-host]').length === 3,
      'only same-site named profiles receive buttons',
    );
    if (new URLSearchParams(location.search).has('restore'))
      assert(
        marks('author').querySelectorAll('.tag').length === 1,
        'existing marks restore on initial load',
      );
    marks('author').querySelector('button').click();
    assert(Boolean(panel().querySelector('[role=dialog]')), 'editor opens');
    panel().querySelector('select').value = 'level-1';
    panel().querySelector('textarea').value = '保留原始言论的判断';
    click(panel(), '保存标记');
    await wait(240);
    assert(
      marks('author').querySelectorAll('.tag').length === 1 &&
        marks('reply-author').querySelectorAll('.tag').length === 1,
      'same account updates together',
    );
    assert(
      testState().users[0].note === '保留原始言论的判断' &&
        testState().users[0].sourceUrl.includes('/tests/fixture.html'),
      'note, source and timestamps are saved',
    );
    assert(marks('bob').querySelectorAll('.tag').length === 0, 'other accounts stay independent');
    const article = document.createElement('article');
    const link = document.createElement('a');
    link.id = 'dynamic-author';
    link.href = '/member/alice';
    link.textContent = 'Alice';
    article.append(link);
    document.getElementById('dynamic').append(article);
    await wait(260);
    assert(
      marks('dynamic-author').querySelectorAll('.tag').length === 1,
      'dynamic replies inherit marks',
    );
    marks('bob').querySelector('button').click();
    panel().querySelector('input[type=text]').value = '<b>自定义</b>';
    click(panel(), '创建并选中');
    await wait(80);
    assert(
      panel().querySelectorAll('input[type=checkbox]').length === 1,
      'descriptive tag can be created separately',
    );
    click(panel(), '保存标记');
    await wait(240);
    assert(
      marks('bob').querySelector('.tag').textContent === '<b>自定义</b>' &&
        !marks('bob').querySelector('b'),
      'tag names are safe text',
    );
    const stale = testState();
    const changed = testState();
    changed.levels[0].name = '修改后的等级';
    await testSetState(changed);
    await wait(240);
    testEmitStale(stale);
    await wait(30);
    assert(
      marks('author').querySelector('.tag').textContent === '修改后的等级',
      'older snapshots do not overwrite newer marks',
    );
    const excluded = testState();
    excluded.settings.excludedSites = [location.hostname];
    await testSetState(excluded);
    await wait(260);
    assert(
      document.querySelectorAll('[data-user-tags-host]').length === 0 &&
        testState().users.length === 2,
      'whitelist removes UI without deleting records',
    );
    excluded.settings.excludedSites = [];
    await testSetState(excluded);
    await wait(260);
    assert(
      document.querySelectorAll('[data-user-tags-host]').length === 4,
      'removing whitelist restores buttons',
    );
    link.href = '/member/bob';
    link.textContent = 'Bob';
    await wait(260);
    assert(
      marks('dynamic-author').querySelector('.tag').textContent === '<b>自定义</b>',
      'recycled DOM adopts new account identity',
    );
    const later = document.createElement('a');
    later.id = 'restored-author';
    later.href = '/member/alice';
    later.textContent = 'Alice';
    document.getElementById('dynamic').append(later);
    // Interrupt a scheduled mutation scan, then simulate returning from the page cache.
    dispatchEvent(new PageTransitionEvent('pagehide', { persisted: true }));
    dispatchEvent(new PageTransitionEvent('pageshow', { persisted: true }));
    await wait(300);
    assert(
      Boolean(host('restored-author')?.hasAttribute('data-user-tags-host')),
      'page cache restore restarts a cancelled scan',
    );
    marks('bob').querySelector('button').click();
    const concurrent = testState();
    concurrent.users.find((user) => user.id === 'member/bob').note = '另一个标签页的新备注';
    await testSetState(concurrent);
    click(panel(), '保存标记');
    await wait(100);
    assert(
      panel().querySelector('.error').textContent.includes('其他页面'),
      'stale editor rejects overwrite',
    );
    panel().querySelector('.close').click();
    marks('bob').querySelector('button').click();
    click(panel(), '删除标签');
    click(panel(), '取消');
    assert(testState().tags.length === 1, 'cancelling tag deletion keeps the tag');
    const checkbox = panel().querySelector('input[type=checkbox]');
    checkbox.checked = false;
    checkbox.dispatchEvent(new Event('change'));
    click(panel(), '保存标记');
    await wait(180);
    assert(
      testState().tags.length === 1 &&
        testState().users.find((user) => user.id === 'member/bob').tagIds.length === 0,
      'unchecking removes only the user assignment',
    );
    for (const id of ['author', 'bob']) {
      marks(id).querySelector('button').click();
      const choice = panel().querySelector('input[type=checkbox]');
      choice.checked = true;
      choice.dispatchEvent(new Event('change'));
      click(panel(), '保存标记');
      await wait(180);
    }
    marks('bob').querySelector('button').click();
    click(panel(), '删除标签');
    const newer = testState();
    newer.levels[0].name = '确认期间改名';
    await testSetState(newer);
    click(panel(), '确认删除标签');
    await wait(100);
    assert(
      testState().tags.length === 1 &&
        panel().querySelector('.error').textContent.includes('重新确认'),
      'stale deletion confirmation preserves the tag',
    );
    click(panel(), '删除标签');
    panel().querySelector('textarea').value = '删除标签时保留未保存备注';
    click(panel(), '确认删除标签');
    await wait(180);
    assert(
      testState().tags.length === 0 && testState().users.every((user) => user.tagIds.length === 0),
      'page deletion removes the definition and all assignments',
    );
    assert(
      marks('author').querySelectorAll('.tag').length === 1 &&
        marks('bob').querySelectorAll('.tag').length === 0,
      'page badges update after global tag deletion and preserve levels',
    );
    click(panel(), '保存标记');
    await wait(180);
    assert(
      !document.querySelector('[data-user-tags-panel]') &&
        testState().users.find((user) => user.id === 'member/bob').note ===
          '删除标签时保留未保存备注',
      'editor saves pending fields after deleting an assigned tag without a false conflict',
    );
    const restored = await chrome.runtime.sendMessage({
      type: 'RESTORE_SNAPSHOT',
      expectedRevision: testState().revision,
    });
    await wait(180);
    assert(
      restored.ok &&
        testState().tags.length === 1 &&
        testState().users.every((user) => user.tagIds.length === 1),
      'deletion snapshot restores the tag and its assignments',
    );
    marks('bob').querySelector('button').click();
    panel().querySelector('input[type=text]').value = '临时新标签';
    click(panel(), '创建并选中');
    await wait(100);
    panel().querySelector('[aria-label="删除标签“临时新标签”"]').click();
    click(panel(), '确认删除标签');
    await wait(180);
    assert(
      testState().tags.length === 1 &&
        ![...panel().querySelectorAll('input[type=checkbox]')].some(
          (input) => input.getAttribute('aria-label') === '临时新标签',
        ),
      'new tags can be deleted before saving a user mark',
    );
    const updatedUser = testState();
    updatedUser.users.find((user) => user.id === 'member/bob').note = '删除之前的并发备注';
    await testSetState(updatedUser);
    click(panel(), '删除标签');
    click(panel(), '确认删除标签');
    await wait(180);
    click(panel(), '保存标记');
    await wait(100);
    assert(
      panel().querySelector('.error').textContent.includes('其他页面') &&
        testState().users.find((user) => user.id === 'member/bob').note === '删除之前的并发备注',
      'tag deletion does not suppress unrelated user edit conflicts',
    );
    panel().querySelector('.close').click();
    const before = document.querySelectorAll('[data-user-tags-host]').length;
    await wait(220);
    assert(
      document.querySelectorAll('[data-user-tags-host]').length === before,
      'plugin mutations do not duplicate hosts',
    );
    document.getElementById('result').textContent = 'ALL PASS\n' + log.join('\n');
  } catch (error) {
    document.getElementById('result').textContent =
      'FAILED ' + error.message + '\n' + log.join('\n');
  }
})();
