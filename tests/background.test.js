import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';
import { webcrypto } from 'node:crypto';
function worker() {
  let listener;
  const stored = {};
  const context = vm.createContext({
    URL,
    structuredClone,
    crypto: webcrypto,
    chrome: {
      runtime: {
        id: 'test-extension',
        getManifest: () =>
          JSON.parse(readFileSync(new URL('../extension/manifest.json', import.meta.url), 'utf8')),
        onMessage: {
          addListener: (callback) => {
            listener = callback;
          },
        },
      },
      storage: {
        local: {
          get: async () => {
            await new Promise((resolve) => setTimeout(resolve, 2));
            return structuredClone(stored);
          },
          set: async (values) => {
            await new Promise((resolve) => setTimeout(resolve, 2));
            Object.assign(stored, structuredClone(values));
          },
        },
      },
    },
  });
  context.importScripts = (...files) =>
    files.forEach((file) =>
      vm.runInContext(
        readFileSync(new URL('../extension/' + file, import.meta.url), 'utf8'),
        context,
      ),
    );
  vm.runInContext(
    readFileSync(new URL('../extension/background.js', import.meta.url), 'utf8'),
    context,
  );
  return {
    send: (message, sender = { id: 'test-extension' }) =>
      new Promise((resolve) => listener(message, sender, resolve)),
    state: () => stored.userTagsState,
  };
}
const record = (id) => ({
  site: 'v2ex.com',
  id: 'member/' + id,
  name: 'User ' + id,
  levelId: 'level-1',
  tagIds: [],
  note: '',
  sourceUrl: '',
});
test('concurrent tabs do not lose records', async () => {
  const workerInstance = worker();
  const results = await Promise.all(
    Array.from({ length: 10 }, (_, id) =>
      workerInstance.send(
        { type: 'SET_USER', user: record(id) },
        { id: 'test-extension', tab: { id }, url: 'https://www.v2ex.com/t/1' },
      ),
    ),
  );
  assert.ok(results.every((result) => result.ok));
  assert.equal(workerInstance.state().users.length, 10);
  assert.equal(workerInstance.state().revision, 10);
});
test('queue recovers after an invalid write', async () => {
  const w = worker();
  assert.equal((await w.send({ type: 'SAVE_TAG', tag: { name: 'bad', color: 'bad' } })).ok, false);
  assert.equal(
    (await w.send({ type: 'SAVE_TAG', tag: { name: 'new', color: '#123456' } })).ok,
    true,
  );
  assert.equal(w.state().tags.length, 1);
});
test('higher-version imports are rejected using the actual manifest version', async () => {
  const w = worker();
  const before = (await w.send({ type: 'SET_USER', user: record(1) })).state;
  const result = await w.send({
    type: 'IMPORT',
    expectedRevision: before.revision,
    currentVersion: '99.0.0',
    backup: { format: 'f-tag', formatVersion: 2, appVersion: '0.4.0', state: before },
  });
  assert.equal(result.ok, false);
  assert.match(result.error, /升级/);
  assert.deepEqual(w.state(), structuredClone(before));
});
test('content scripts cannot change settings, read recovery or write another site', async () => {
  const w = worker(),
    sender = { id: 'test-extension', tab: { id: 1 }, url: 'https://www.v2ex.com/t/1' };
  for (const type of ['GET_STATUS', 'RESTORE_SNAPSHOT', 'SET_ENABLED'])
    assert.equal((await w.send({ type }, sender)).ok, false);
  assert.equal(
    (await w.send({ type: 'SET_USER', user: { ...record(1), site: 'zhihu.com' } }, sender)).ok,
    false,
  );
});

test('page tag deletion requires a current confirmation and updates all records', async () => {
  const w = worker();
  const sender = { id: 'test-extension', tab: { id: 1 }, url: 'https://www.v2ex.com/t/1' };
  const created = await w.send(
    { type: 'SAVE_TAG', tag: { name: '页面新增', color: '#123456' } },
    sender,
  );
  const id = created.state.tags[0].id;
  await w.send({ type: 'SET_USER', user: { ...record(1), tagIds: [id] } }, sender);
  const current = await w.send({
    type: 'SET_USER',
    user: { ...record(2), site: 'zhihu.com', tagIds: [id] },
  });
  assert.equal((await w.send({ type: 'DELETE_TAG', id }, sender)).ok, false);
  const stale = await w.send(
    { type: 'DELETE_TAG', id, expectedRevision: created.state.revision },
    sender,
  );
  assert.equal(stale.ok, false);
  assert.match(stale.error, /重新确认/);
  assert.deepEqual(w.state(), structuredClone(current.state));
  const deleted = await w.send(
    { type: 'DELETE_TAG', id, expectedRevision: current.state.revision },
    sender,
  );
  assert.equal(deleted.ok, true);
  assert.equal(deleted.state.tags.length, 0);
  assert.ok(deleted.state.users.every((user) => user.tagIds.length === 0));
  const status = await w.send({ type: 'GET_STATUS' });
  assert.equal(status.recovery.reason, 'delete-tag');
  const restored = await w.send({
    type: 'RESTORE_SNAPSHOT',
    expectedRevision: deleted.state.revision,
  });
  assert.equal(restored.ok, true);
  assert.ok(restored.state.users.every((user) => user.tagIds.includes(id)));
});

test('extension settings in a browser tab keep access to management actions', async () => {
  const w = worker();
  const sender = {
    id: 'test-extension',
    tab: { id: 1 },
    url: 'chrome-extension://test-extension/options.html',
  };
  assert.equal((await w.send({ type: 'GET_STATUS' }, sender)).ok, true);
  assert.equal((await w.send({ type: 'SET_ENABLED', enabled: false }, sender)).ok, true);
  assert.equal(w.state().settings.enabled, false);
  for (const url of [
    'https://example.com/?next=chrome-extension://test-extension/options.html',
    'chrome-extension://test-extension.evil/options.html',
  ]) {
    assert.equal((await w.send({ type: 'GET_STATUS' }, { ...sender, url })).ok, false);
  }
});
