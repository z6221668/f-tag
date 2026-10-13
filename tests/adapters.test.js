import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import '../extension/core.js';
import { legacyState } from './legacy.js';
import '../extension/adapters.js';
import '../extension/adapters/zhihu.js';
import '../extension/adapters/v2ex.js';
import '../extension/adapters/nodeseek.js';
import '../extension/adapters/linuxdo.js';
import '../extension/adapters/discuz.js';
import '../extension/adapters/chiphell.js';
import '../extension/adapters/52pojie.js';
import '../extension/adapters/hostloc.js';
import '../extension/adapters/generic.js';
const A = UserTagsAdapters,
  C = UserTagsCore;

test('NodeSeek resolves numeric account paths and ignores posts/external links', () => {
  const page = 'https://www.nodeseek.com/post-123-1';
  assert.deepEqual(A.identity('/space/9#/comments', page), { site: 'nodeseek.com', id: 'space/9' });
  for (const path of [
    '/space/9/posts',
    '/space/alice',
    '/post-9-1',
    'https://other.example/space/9',
  ])
    assert.equal(A.identity(path, page), null);
});
test('LINUX DO profiles share identity with summary/activity links', () => {
  const page = 'https://linux.do/t/topic/123';
  const user = { site: 'linux.do', id: 'u/Alice_1' };
  for (const path of ['/u/Alice_1', '/u/Alice_1/', '/u/Alice_1/summary', '/u/Alice_1/activity'])
    assert.deepEqual(A.identity(path, page), user);
  for (const path of ['/u', '/u/Alice_1.json', '/u/Alice_1/preferences', '/t/topic/1'])
    assert.equal(A.identity(path, page), null);
});
for (const host of ['www.chiphell.com', 'www.52pojie.cn', 'hostloc.com']) {
  test(host + ' normalizes rewritten and query-based Discuz profiles', () => {
    const page = 'https://' + host + '/forum.php';
    const expected = { site: C.canonicalSite(host), id: 'uid/12345' };
    for (const path of [
      '/space-uid-12345.html',
      '/home.php?mod=space&uid=12345',
      '/home.php?uid=12345&do=profile&mod=space',
      '/home.php?mod=space&uid=12345&mobile=2',
    ])
      assert.deepEqual(A.identity(path, page), expected);
    for (const path of [
      '/home.php?mod=spacecp&uid=12345',
      '/home.php?mod=space&uid=12345&do=blog',
      '/home.php?mod=space&uid=12345&uid=54321',
      '/home.php?mod=space&mod=spacecp&uid=12345',
      '/home.php?mod=space&uid=-1',
      '/space-uid-Alice.html',
      '/thread-12345-1-1.html',
    ])
      assert.equal(A.identity(path, page), null);
  });
}
test('Discuz users on different forums never share marks', () => {
  assert.notDeepEqual(
    A.identity('/space-uid-42.html', 'https://hostloc.com/'),
    A.identity('/space-uid-42.html', 'https://www.chiphell.com/'),
  );
  assert.equal(
    A.identity('https://www.chiphell.com/space-uid-42.html', 'https://hostloc.com/'),
    null,
  );
  assert.equal(
    A.identity('https://hostloc.com.evil.test/space-uid-42.html', 'https://hostloc.com/'),
    null,
  );
});
test('new adapters match old records after schema and www migration', () => {
  const state = legacyState();
  state.users = [
    { site: 'www.nodeseek.com', id: 'space/9', name: 'old NodeSeek', tagIds: ['level-1'] },
    { site: 'linux.do', id: 'u/Alice_1', name: 'old Linux', tagIds: ['level-2'] },
    { site: 'unknown.example', id: 'u/42', name: 'unknown', tagIds: ['custom'] },
  ];
  const loaded = C.readBackup(
    { format: 'f-tag', formatVersion: 1, appVersion: '0.2.0', state },
    '0.3.0',
  );
  for (const [url, page] of [
    ['/space/9', 'https://www.nodeseek.com/'],
    ['/u/Alice_1', 'https://linux.do/'],
  ]) {
    const identity = A.identity(url, page);
    assert.ok(loaded.users.some((user) => user.site === identity.site && user.id === identity.id));
  }
  assert.equal(loaded.users.length, 3);
  assert.equal(A.site('www.linux.do'), 'linux.do');
});
test('all runtime contexts load the same adapters in dependency order', () => {
  const read = (path) => readFileSync(new URL('../' + path, import.meta.url), 'utf8');
  const manifest = JSON.parse(read('extension/manifest.json'));
  assert.equal(manifest.version, JSON.parse(read('package.json')).version);
  const files = manifest.content_scripts[0].js.filter((f) => f.startsWith('adapters/'));
  for (const context of ['extension/background.js', 'extension/popup.html', 'tests/fixture.html']) {
    const source = read(context);
    let previous = -1;
    for (const file of files) {
      const position = source.indexOf(file);
      assert.ok(position > previous, context + ': ' + file);
      previous = position;
    }
  }
  assert.ok(files.indexOf('adapters/discuz.js') < files.indexOf('adapters/chiphell.js'));
});
