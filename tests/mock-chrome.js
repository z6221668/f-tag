/* Browser fixtures use the real repository with an in-memory Chrome storage boundary. */
(() => {
  const stored = { userTagsState: UserTagsCore.fresh() };
  const listeners = [];
  const shadows = new WeakMap();
  const attach = Element.prototype.attachShadow;
  Element.prototype.attachShadow = function (options) {
    const root = attach.call(this, options);
    shadows.set(this, root);
    return root;
  };
  const storage = {
    get: async () => structuredClone(stored),
    set: async (values) => {
      const changes = {};
      for (const [key, value] of Object.entries(values)) {
        changes[key] = { oldValue: stored[key], newValue: structuredClone(value) };
        stored[key] = structuredClone(value);
      }
      for (const listener of listeners) listener(changes, 'local');
    },
  };
  const repository = new UserTagsRepository.Repository(storage, '0.3.0');
  globalThis.testShadow = (host) => shadows.get(host);
  globalThis.testState = () => structuredClone(stored.userTagsState);
  globalThis.testSetState = (state) =>
    storage.set({
      userTagsState: { ...state, revision: (stored.userTagsState?.revision || 0) + 1 },
    });
  globalThis.testEmitStale = (state) =>
    listeners.forEach((listener) => listener({ userTagsState: { newValue: state } }, 'local'));
  if (new URLSearchParams(location.search).has('restore')) {
    stored.userTagsState = UserTagsCore.reduce(stored.userTagsState, {
      type: 'SET_USER',
      user: {
        site: location.hostname,
        id: 'member/alice',
        name: 'Alice',
        levelId: 'level-1',
        tagIds: [],
        note: '',
        sourceUrl: '',
      },
    });
  }
  globalThis.chrome = {
    runtime: {
      getManifest: () => ({ version: '0.3.0' }),
      async sendMessage(message) {
        try {
          return { ok: true, ...(await repository.dispatch(message)) };
        } catch (error) {
          return { ok: false, error: error.message };
        }
      },
      openOptionsPage: () => {
        location.href = '/preview/options';
      },
    },
    storage: { local: storage, onChanged: { addListener: (listener) => listeners.push(listener) } },
    tabs: { query: async () => [{ url: location.origin + '/tests/fixture.html' }] },
  };
})();
