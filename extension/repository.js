/* All mutations pass through one repository queue in the service worker. */
(() => {
  const Core = UserTagsCore;
  const KEYS = { state: 'userTagsState', recovery: 'userTagsRecovery', undo: 'userTagsUndo' };
  class Repository {
    constructor(storage, appVersion) {
      this.storage = storage;
      this.appVersion = appVersion;
      this.queue = Promise.resolve();
    }
    dispatch(message) {
      const operation = () => this.execute(message);
      const pending = this.queue.then(operation, operation);
      this.queue = pending.catch(() => {});
      return pending;
    }
    async write(values) {
      try {
        await this.storage.set(values);
      } catch (error) {
        throw new Error(
          '本地保存失败，现有记录未替换。请导出备份并检查存储空间。' +
            (error?.message ? ' ' + error.message : ''),
        );
      }
    }
    async load() {
      const stored = await this.storage.get(Object.values(KEYS));
      const raw = stored[KEYS.state];
      const state = raw ? Core.migrate(raw) : Core.fresh();
      if (raw && Core.stableStringify(raw) !== Core.stableStringify(state)) {
        await this.write({
          [KEYS.recovery]: { state: raw, createdAt: new Date().toISOString(), reason: 'migration' },
        });
        state.revision =
          (Number.isSafeInteger(raw.revision) && raw.revision >= 0 ? raw.revision : 0) + 1;
        await this.write({ [KEYS.state]: state, [KEYS.undo]: null });
        return {
          state,
          recovery: { state: raw, createdAt: new Date().toISOString(), reason: 'migration' },
          undo: null,
        };
      }
      return { state, recovery: stored[KEYS.recovery], undo: stored[KEYS.undo] };
    }
    async execute(message) {
      const { state, recovery, undo } = await this.load();
      const response = (extra) => ({ state, ...extra });
      if (message.type === 'GET_STATE') return response();
      if (message.type === 'GET_STATUS')
        return response({
          recovery: recovery ? { createdAt: recovery.createdAt, reason: recovery.reason } : null,
          undo: undo ? { token: undo.token, name: undo.name } : null,
        });
      let next,
        nextUndo = undo;
      let snapshotReason = null;
      if (message.type === 'RESTORE_SNAPSHOT') {
        if (!recovery) throw new Error('没有可恢复的本地快照');
        if (message.expectedRevision !== state.revision)
          throw new Error('数据已更新，请重新查看快照后恢复');
        next = Core.migrate(recovery.state);
        snapshotReason = 'restore';
        nextUndo = null;
      } else if (message.type === 'UNDO_USER') {
        if (!undo || message.token !== undo.token)
          throw new Error('这次标记已无法撤销，请从用户记录中修改');
        const current = state.users.find((user) => user.site === undo.site && user.id === undo.id);
        if (Core.recordToken(current) !== undo.after) throw new Error('标记已被再次修改，无法撤销');
        next = Core.validate({
          ...state,
          users: [
            ...state.users.filter((user) => !(user.site === undo.site && user.id === undo.id)),
            ...(undo.before ? [undo.before] : []),
          ],
        });
        nextUndo = null;
      } else {
        next = Core.reduce(state, { ...message, currentVersion: this.appVersion });
        if (message.type === 'IMPORT') {
          if (message.expectedRevision !== state.revision)
            throw new Error('数据已更新，请重新确认导入');
          snapshotReason = 'import';
          nextUndo = null;
        }
        if (message.type === 'DELETE_TAG') {
          snapshotReason = 'delete-tag';
          nextUndo = null;
        }
        if (['SET_USER', 'DELETE_USER'].includes(message.type)) {
          const { site, id, name } = message.user;
          const previous = state.users.find((user) => user.site === site && user.id === id);
          const current = next.users.find((user) => user.site === site && user.id === id);
          nextUndo = {
            token: crypto.randomUUID(),
            site,
            id,
            name: name || previous?.name || id,
            before: previous || null,
            after: Core.recordToken(current),
          };
        }
      }
      next.revision = state.revision + 1;
      // Snapshot must be durable before a destructive write is allowed to proceed.
      if (snapshotReason)
        await this.write({
          [KEYS.recovery]: { state, createdAt: new Date().toISOString(), reason: snapshotReason },
        });
      await this.write({ [KEYS.state]: next, [KEYS.undo]: nextUndo });
      return {
        state: next,
        undo: nextUndo ? { token: nextUndo.token, name: nextUndo.name } : null,
      };
    }
  }
  globalThis.UserTagsRepository = { Repository, KEYS };
})();
