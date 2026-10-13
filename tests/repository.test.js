import test from 'node:test';
import assert from 'node:assert/strict';
import { webcrypto } from 'node:crypto';
import { legacyState } from './legacy.js';
import '../extension/core.js';
import '../extension/repository.js';
globalThis.crypto ??= webcrypto;
const C = UserTagsCore;
function setup(seed = {}) {
  const stored = structuredClone(seed);
  let failingKey;
  const storage = {
    get: async () => JSON.parse(C.stableStringify(stored)),
    set: async (values) => {
      if (Object.hasOwn(values, failingKey)) throw new Error('QUOTA_BYTES');
      Object.assign(stored, structuredClone(values));
    },
  };
  return {
    repository: new UserTagsRepository.Repository(storage, '0.3.0'),
    stored,
    fail: (key) => {
      failingKey = key;
    },
  };
}
const user = {
  site: 'v2ex.com',
  id: 'member/alice',
  name: 'Alice',
  levelId: 'level-1',
  tagIds: [],
  note: '',
  sourceUrl: '',
};
test('first load migrates old storage with a durable original snapshot', async () => {
  const old = legacyState();
  old.users.push({ site: user.site, id: user.id, name: user.name, tagIds: ['level-2'] });
  const { repository, stored } = setup({ userTagsState: old });
  const result = await repository.dispatch({ type: 'GET_STATE' });
  assert.equal(result.state.schemaVersion, 2);
  assert.equal(result.state.users[0].levelId, 'level-2');
  assert.deepEqual(stored.userTagsRecovery.state, old);
  await repository.dispatch({ type: 'GET_STATE' });
  assert.deepEqual(stored.userTagsRecovery.state, old);
});
test('import and restore preserve a snapshot and keep revisions increasing', async () => {
  const { repository, stored } = setup();
  const initial = (await repository.dispatch({ type: 'SET_USER', user })).state;
  const imported = await repository.dispatch({
    type: 'IMPORT',
    expectedRevision: initial.revision,
    backup: C.backup(C.fresh(), '0.3.0'),
  });
  assert.equal(imported.state.users.length, 0);
  assert.deepEqual(stored.userTagsRecovery.state, initial);
  const restored = await repository.dispatch({
    type: 'RESTORE_SNAPSHOT',
    expectedRevision: imported.state.revision,
  });
  assert.equal(restored.state.users.length, 1);
  assert.ok(restored.state.revision > imported.state.revision);
  assert.equal(stored.userTagsRecovery.state.users.length, 0);
});
test('failure to persist snapshot prevents destructive import', async () => {
  const { repository, stored, fail } = setup();
  const initial = (await repository.dispatch({ type: 'SET_USER', user })).state;
  fail('userTagsRecovery');
  await assert.rejects(
    repository.dispatch({
      type: 'IMPORT',
      expectedRevision: initial.revision,
      backup: C.backup(C.fresh(), '0.3.0'),
    }),
    /保存失败/,
  );
  assert.deepEqual(stored.userTagsState, initial);
});
test('failure to persist replacement retains both current data and its snapshot', async () => {
  const { repository, stored, fail } = setup();
  const initial = (await repository.dispatch({ type: 'SET_USER', user })).state;
  fail('userTagsState');
  await assert.rejects(
    repository.dispatch({
      type: 'IMPORT',
      expectedRevision: initial.revision,
      backup: C.backup(C.fresh(), '0.3.0'),
    }),
    /保存失败/,
  );
  assert.deepEqual(stored.userTagsState, initial);
  assert.deepEqual(stored.userTagsRecovery.state, initial);
});
test('confirmation revisions prevent replacing changes made in another tab', async () => {
  const { repository } = setup();
  await repository.dispatch({ type: 'SET_USER', user });
  await assert.rejects(
    repository.dispatch({
      type: 'IMPORT',
      expectedRevision: 0,
      backup: C.backup(C.fresh(), '0.3.0'),
    }),
    /重新确认/,
  );
});
test('undo tokens revert only the corresponding edit and cannot be reused', async () => {
  const { repository } = setup();
  const first = await repository.dispatch({ type: 'SET_USER', user });
  const second = await repository.dispatch({ type: 'SET_USER', user: { ...user, note: 'new' } });
  await assert.rejects(
    repository.dispatch({ type: 'UNDO_USER', token: first.undo.token }),
    /无法撤销/,
  );
  const reverted = await repository.dispatch({ type: 'UNDO_USER', token: second.undo.token });
  assert.equal(reverted.state.users[0].note, '');
  await assert.rejects(
    repository.dispatch({ type: 'UNDO_USER', token: second.undo.token }),
    /无法撤销/,
  );
});
test('deleting a tag saves a snapshot and invalidates old user undo references', async () => {
  const { repository, stored } = setup();
  const tags = await repository.dispatch({
    type: 'SAVE_TAG',
    tag: { name: 'spam', color: '#123456' },
  });
  const marked = await repository.dispatch({
    type: 'SET_USER',
    user: { ...user, tagIds: [tags.state.tags[0].id] },
  });
  await repository.dispatch({ type: 'DELETE_TAG', id: tags.state.tags[0].id });
  assert.deepEqual(stored.userTagsRecovery.state, marked.state);
  assert.equal((await repository.dispatch({ type: 'GET_STATUS' })).undo, null);
});

test('sorted Chrome storage keys do not trigger repeated migrations or conflicts', async () => {
  const { repository, stored } = setup();
  const first = await repository.dispatch({ type: 'SET_USER', user });
  const originalRevision = first.state.revision;
  for (let i = 0; i < 3; i++) {
    const current = await repository.dispatch({ type: 'GET_STATE' });
    assert.equal(current.state.revision, originalRevision);
  }
  assert.equal(stored.userTagsRecovery, undefined);
  const reordered = Object.fromEntries(Object.entries(first.state.users[0]).reverse());
  const saved = await repository.dispatch({
    type: 'SET_USER',
    user: { ...user, note: 'Updated' },
    expectedRecord: C.recordToken(reordered),
  });
  assert.equal(saved.state.users[0].note, 'Updated');
});
