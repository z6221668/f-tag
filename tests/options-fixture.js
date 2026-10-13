(async () => {
  const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
  const results = [];
  async function waitFor(predicate, label) {
    for (let i = 0; i < 120; i++) {
      if (predicate()) return;
      await wait(40);
    }
    throw new Error(label + ': ' + $('status').textContent);
  }
  const assert = (condition, message) => {
    if (!condition) throw new Error(message);
    results.push('PASS ' + message);
  };
  const $ = (id) => document.getElementById(id);
  const report = document.createElement('pre');
  report.id = 'result';
  report.textContent = 'RUNNING';
  document.body.append(report);
  async function importFile(file) {
    $('status').textContent = '';
    const transfer = new DataTransfer();
    transfer.items.add(
      new File([JSON.stringify(file)], 'backup.json', { type: 'application/json' }),
    );
    $('import-file').files = transfer.files;
    $('import-file').dispatchEvent(new Event('change'));
    await waitFor(
      () => $('confirm-dialog').open || $('status').textContent !== '',
      'file import did not complete',
    );
  }
  const identity = { site: 'v2ex.com', id: 'member/alice', name: 'Alice' };
  try {
    await wait(200);
    assert(
      $('levels').querySelectorAll('form').length === 3,
      'settings separate grades from descriptive tags',
    );
    $('tag-name').value = '广告';
    $('tag-form').requestSubmit();
    await wait(100);
    assert(testState().tags.length === 1, 'settings create descriptive tag');
    await chrome.runtime.sendMessage({
      type: 'SET_USER',
      user: {
        ...identity,
        levelId: 'level-1',
        tagIds: [testState().tags[0].id],
        note: '初始备注',
        sourceUrl: 'https://www.v2ex.com/t/1',
      },
    });
    await wait(100);
    $('users').querySelector('button').click();
    $('edit-content').querySelector('select').value = 'level-2';
    $('edit-content').querySelector('textarea').value = '<b>备注</b>';
    $('edit-content').querySelector('form').requestSubmit();
    await wait(100);
    assert(
      !$('edit-dialog').open && testState().users[0].levelId === 'level-2',
      'settings edit user grade and note',
    );
    assert(
      $('users').querySelector('.record-note').textContent === '<b>备注</b>' &&
        !$('users').querySelector('b'),
      'remarks render safely as text',
    );
    $('users').querySelector('button').click();
    const pendingNote = $('edit-content').querySelector('textarea');
    pendingNote.closest('details').open = true;
    pendingNote.value = '尚未保存的输入';
    $('edit-close').click();
    assert(
      $('edit-dialog').open && !$('edit-content').querySelector('.tag-confirmation').hidden,
      'settings close button asks before discarding a user draft',
    );
    [...$('edit-content').querySelectorAll('button')]
      .find((button) => button.textContent === '继续编辑')
      .click();
    assert(
      pendingNote.value === '尚未保存的输入',
      'settings continue editing keeps pending fields',
    );
    $('edit-dialog').dispatchEvent(new Event('cancel', { cancelable: true }));
    [...$('edit-content').querySelectorAll('button')]
      .find((button) => button.textContent === '放弃修改')
      .click();
    await wait(100);
    assert(
      !$('edit-dialog').open && testState().users[0].note === '<b>备注</b>',
      'settings Escape path discards the draft only after confirmation',
    );
    const before = testState();
    const badSelector = UserTagsCore.backup(before, '0.3.0');
    badSelector.state.settings.rules = [
      { host: 'forum.example.com', prefix: '/u/', selector: 'a[' },
    ];
    await importFile(badSelector);
    assert(
      $('status').textContent.includes('不合法') && testState().revision === before.revision,
      'invalid backup selectors are rejected before replacement',
    );
    await importFile(UserTagsCore.backup(before, '0.4.0'));
    assert(
      $('status').textContent.includes('升级') && testState().revision === before.revision,
      'higher-version backup prompts upgrade without replacement',
    );
    const old = {
      format: 'f-tag',
      formatVersion: 1,
      appVersion: '0.2.0',
      state: {
        schemaVersion: 1,
        tags: [
          { id: 'level-1', name: '观察', color: '#123456' },
          { id: 'level-3', name: '严重', color: '#654321' },
        ],
        users: [{ ...identity, tagIds: ['level-1', 'level-3'] }],
        settings: { enabled: true, excludedSites: [], rules: [] },
      },
    };
    await importFile(old);
    assert(
      $('confirm-dialog').open,
      'valid import asks before replacement: ' + $('status').textContent,
    );
    await chrome.runtime.sendMessage({
      type: 'SET_USER',
      user: { ...testState().users[0], note: '其他页面刚保存的备注' },
    });
    $('confirm-yes').click();
    await wait(100);
    assert(
      $('status').textContent.includes('重新确认') &&
        testState().users[0].note === '其他页面刚保存的备注',
      'import confirmation cannot overwrite concurrent edits',
    );
    const saved = testState();
    await importFile(old);
    $('confirm-yes').click();
    await wait(150);
    assert(
      testState().users[0].levelId === 'level-3' && testState().users[0].note.includes('观察'),
      'legacy import preserves original selections and chooses one grade',
    );
    assert(!$('restore').disabled, 'replacement makes recovery snapshot available');
    $('restore').click();
    await wait(100);
    $('confirm-yes').click();
    await wait(150);
    assert(
      testState().users[0].note === saved.users[0].note &&
        testState().tags.length === saved.tags.length,
      'restore recovers pre-import records and labels',
    );
    $('users').querySelector('button').click();
    $('edit-content').querySelector('textarea').value = '需要撤销的修改';
    $('edit-content').querySelector('form').requestSubmit();
    await wait(100);
    assert(!$('undo').disabled, 'saved edit exposes undo');
    $('undo').click();
    await wait(100);
    assert(
      testState().users[0].note === saved.users[0].note && $('undo').disabled,
      'undo reverts only the last edit',
    );
    $('rules').value = '[{"host":"forum.example.com","prefix":"/u/","selector":"a["}]';
    $('rules-save').click();
    await wait(100);
    assert(
      $('status').textContent.includes('不合法') && !testState().settings.rules.length,
      'rule editor reports selector errors',
    );
    report.textContent = 'ALL PASS\n' + results.join('\n');
  } catch (error) {
    report.textContent = 'FAILED ' + error.message + '\n' + results.join('\n');
  }
})();
