import test from 'node:test';
import assert from 'node:assert/strict';
import { webcrypto } from 'node:crypto';
import { legacyState } from './legacy.js';
import '../extension/core.js';
import '../extension/adapters.js';
import '../extension/adapters/zhihu.js';
import '../extension/adapters/v2ex.js';
import '../extension/adapters/generic.js';
globalThis.crypto ??= webcrypto;
const C = UserTagsCore,
  A = UserTagsAdapters;
const now = '2026-10-13T00:00:00.000Z';
const user = (site = 'v2ex.com', id = 'member/alice') => ({
  site,
  id,
  name: 'Alice',
  levelId: 'level-1',
  tagIds: [],
  note: '重复广告',
  sourceUrl: 'https://www.v2ex.com/t/1',
});
const mark = (state, record = user()) => C.reduce(state, { type: 'SET_USER', user: record }, now);

test('levels and tags are independent, with exactly one level per user', () => {
  let state = C.reduce(C.fresh(), { type: 'SAVE_TAG', tag: { name: '广告', color: '#123456' } });
  state = mark(state, { ...user(), tagIds: [state.tags[0].id] });
  assert.equal(state.users[0].levelId, 'level-1');
  assert.equal(state.users[0].tagIds.length, 1);
  assert.throws(() => mark(state, { ...user(), levelId: ['level-1', 'level-2'] }), /等级/);
});
test('same nickname on different accounts/sites remains distinct', () => {
  let state = mark(C.fresh());
  state = mark(state, user('zhihu.com', 'people/alice'));
  state = mark(state, user('v2ex.com', 'member/other'));
  assert.equal(state.users.length, 3);
});
test('record times are maintained by writes, and missing legacy times stay unknown', () => {
  const first = mark(C.fresh());
  const second = C.reduce(
    first,
    { type: 'SET_USER', user: { ...user(), createdAt: '2030-01-01T00:00:00.000Z' } },
    '2026-10-14T00:00:00.000Z',
  );
  assert.equal(second.users[0].createdAt, now);
  assert.equal(second.users[0].updatedAt, '2026-10-14T00:00:00.000Z');
  const old = legacyState();
  old.users.push({ site: 'v2ex.com', id: 'member/alice', name: 'Alice', tagIds: ['level-1'] });
  assert.equal(C.migrate(old).users[0].createdAt, null);
});
test('legacy multiple levels migrate to highest, retaining original selection in notes', () => {
  const old = legacyState();
  old.tags[2].name = '严重';
  old.users.push({
    site: 'v2ex.com',
    id: 'member/alice',
    name: 'Alice',
    tagIds: ['level-1', 'level-3', 'custom'],
  });
  const loaded = C.readBackup(
    { format: 'f-tag', formatVersion: 1, appVersion: '0.2.0', state: old },
    '0.3.0',
  );
  assert.equal(loaded.users[0].levelId, 'level-3');
  assert.deepEqual(loaded.users[0].tagIds, ['custom']);
  assert.match(loaded.users[0].note, /严重/);
  assert.equal(loaded.levels[2].name, '严重');
  assert.equal(loaded.tags.length, 1);
  assert.deepEqual(C.migrate(loaded), loaded);
});
test('known www aliases merge without dropping labels, notes or unknown sites', () => {
  let state = mark(C.fresh(), user('www.nodeseek.com', 'space/9'));
  state = mark(state, {
    ...user('nodeseek.com', 'space/9'),
    levelId: 'level-3',
    note: '另一次标记',
    sourceUrl: 'https://www.nodeseek.com/post-2-1',
  });
  state = mark(state, user('unknown.example', 'profile/9'));
  const migrated = C.migrate(state);
  assert.equal(migrated.users.length, 2);
  const record = migrated.users.find((item) => item.site === 'nodeseek.com');
  assert.equal(record.levelId, 'level-3');
  assert.match(record.note, /重复广告/);
  assert.match(record.note, /另一次标记/);
  assert.match(record.note, /post-2-1/);
  assert.equal(migrated.users[1].site, 'unknown.example');
  assert.equal(C.canonicalSite('other.nodeseek.com'), 'other.nodeseek.com');
});
test('descriptive tag deletion leaves level and note intact', () => {
  let state = C.reduce(C.fresh(), { type: 'SAVE_TAG', tag: { name: 'spam', color: '#123456' } });
  state = mark(state, { ...user(), tagIds: [state.tags[0].id] });
  state = C.reduce(state, { type: 'DELETE_TAG', id: state.tags[0].id });
  assert.equal(state.users[0].tagIds.length, 0);
  assert.equal(state.users[0].levelId, 'level-1');
  state = C.reduce(state, { type: 'DELETE_USER', user: state.users[0] });
  assert.equal(state.users.length, 0);
  assert.equal(state.levels.length, 3);
});
test('stale editors cannot overwrite a later record', () => {
  const state = mark(C.fresh());
  const token = C.recordToken(state.users[0]);
  const changed = mark(state, { ...user(), note: 'new' });
  assert.throws(
    () => C.reduce(changed, { type: 'SET_USER', user: user(), expectedRecord: token }),
    /其他页面/,
  );
  assert.throws(
    () => C.reduce(changed, { type: 'DELETE_USER', user: user(), expectedRecord: token }),
    /其他页面/,
  );
});
test('saving an empty existing mark removes it, while ungraded tags and notes remain valid', () => {
  const library = C.reduce(C.fresh(), {
    type: 'SAVE_TAG',
    tag: { name: '广告', color: '#123456' },
  });
  let state = mark(library);
  const previous = state.users[0];
  state = C.reduce(state, {
    type: 'SET_USER',
    user: { ...previous, levelId: null, tagIds: [], note: '  ' },
    expectedRecord: C.recordToken(previous),
  });
  assert.equal(state.users.length, 0);
  assert.deepEqual(state.tags, library.tags);
  state = mark(state, { ...user(), levelId: null, tagIds: [state.tags[0].id], note: '' });
  assert.equal(state.users[0].levelId, null);
  assert.equal(state.users[0].tagIds.length, 1);
  state = mark(state, { ...user(), levelId: null, tagIds: [], note: '保留备注' });
  assert.equal(state.users[0].note, '保留备注');
  const token = C.recordToken(state.users[0]);
  const changed = mark(state, { ...user(), note: '另一页的修改' });
  assert.throws(
    () =>
      C.reduce(changed, {
        type: 'SET_USER',
        user: { ...user(), levelId: null, tagIds: [], note: '' },
        expectedRecord: token,
      }),
    /其他页面/,
  );
  assert.throws(
    () => mark(C.fresh(), { ...user(), levelId: null, tagIds: [], note: '' }),
    /请选择/,
  );
});
test('invalid references, unsafe sources, dates and duplicate tags are rejected', () => {
  const state = C.fresh();
  const before = structuredClone(state);
  assert.throws(() => mark(state, { ...user(), tagIds: ['missing'] }), /不存在/);
  assert.throws(() => mark(state, { ...user(), sourceUrl: 'javascript:alert(1)' }), /来源/);
  assert.throws(
    () => mark(state, { ...user(), sourceUrl: 'https://secret:password@example.com/' }),
    /来源/,
  );
  const raw = mark(state);
  raw.users[0].createdAt = 'nonsense';
  assert.throws(() => C.validate(raw), /时间/);
  assert.deepEqual(state, before);
});
test('higher app or format versions fail before changing data', () => {
  const state = mark(C.fresh());
  assert.throws(() => C.readBackup(C.backup(state, '0.4.0'), '0.3.0'), /升级/);
  const file = C.backup(state, '0.3.0');
  file.formatVersion = 3;
  assert.throws(() => C.readBackup(file, '0.3.0'), /升级/);
  assert.equal(C.compareVersions('0.10.0', '0.9.0'), 1);
  assert.throws(() => C.readBackup({}, '0.3.0'), /备份/);
});
test('exports round trip Unicode remarks and unknown site records', () => {
  const state = mark(C.fresh(), {
    ...user('not-supported.example', 'account/42'),
    note: '昵称 <script>test</script>',
  });
  assert.deepEqual(
    C.readBackup(JSON.parse(JSON.stringify(C.backup(state, '0.3.0'))), '1.0.0'),
    state,
  );
});
test('whitelist matches subdomains but not lookalikes', () => {
  const settings = { excludedSites: ['zhihu.com'] };
  assert.equal(C.excluded('www.zhihu.com', settings), true);
  assert.equal(C.excluded('fakezhihu.com', settings), false);
  assert.equal(C.excluded('zhihu.com.evil.test', settings), false);
  for (const invalid of ['https://zhihu.com/a', '-invalid.com', 'a..com', null])
    assert.throws(() => C.host(invalid), /域名/);
});
test('Zhihu and V2EX stable IDs reject unrelated and external links', () => {
  assert.deepEqual(A.identity('/people/abc?from=answer', 'https://www.zhihu.com/question/123'), {
    site: 'zhihu.com',
    id: 'people/abc',
  });
  assert.equal(A.identity('/people/abc/answers', 'https://www.zhihu.com/'), null);
  assert.equal(
    A.identity('https://zhihu.com.evil.test/people/abc', 'https://www.zhihu.com/'),
    null,
  );
  assert.deepEqual(A.identity('https://v2ex.com/member/Alice/', 'https://www.v2ex.com/t/1'), {
    site: 'v2ex.com',
    id: 'member/alice',
  });
});
test('generic/custom rules share IDs and reject cross-site profiles', () => {
  const page = 'https://forum.example.com/t/1';
  assert.deepEqual(
    A.identity('/u/alice', page, [{ host: 'forum.example.com', prefix: '/u/' }]),
    A.identity('/u/alice', page),
  );
  assert.equal(A.identity('https://other.example.com/u/alice', page), null);
});

test('record conflict tokens ignore Chrome object property ordering', () => {
  const original = mark(C.fresh()).users[0];
  const reordered = Object.fromEntries(Object.entries(original).reverse());
  assert.equal(C.recordToken(original), C.recordToken(reordered));
  assert.equal(C.stableStringify({ users: [original] }), C.stableStringify({ users: [reordered] }));
});

test('legacy deleted grades and renamed grades do not create duplicate fallback names', () => {
  const old = legacyState();
  old.tags = old.tags.filter((tag) => tag.id !== 'level-2');
  old.tags.find((tag) => tag.id === 'level-1').name = '二级 · 低质量';
  old.users.push({ site: 'v2ex.com', id: 'member/alice', name: 'Alice', tagIds: ['level-1'] });
  const migrated = C.migrate(old);
  assert.equal(migrated.users[0].levelId, 'level-1');
  assert.equal(migrated.levels[0].name, '二级 · 低质量');
  assert.equal(new Set(migrated.levels.map((level) => level.name)).size, 3);
});
