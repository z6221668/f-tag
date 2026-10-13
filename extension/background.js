importScripts(
  'core.js',
  'adapters.js',
  'adapters/zhihu.js',
  'adapters/v2ex.js',
  'adapters/nodeseek.js',
  'adapters/linuxdo.js',
  'adapters/discuz.js',
  'adapters/chiphell.js',
  'adapters/52pojie.js',
  'adapters/hostloc.js',
  'adapters/generic.js',
  'repository.js',
);
const repository = new UserTagsRepository.Repository(
  chrome.storage.local,
  chrome.runtime.getManifest().version,
);
const CONTENT_ACTIONS = new Set([
  'GET_STATE',
  'SAVE_TAG',
  'DELETE_TAG',
  'SET_USER',
  'DELETE_USER',
  'UNDO_USER',
]);
chrome.runtime.onMessage.addListener((message, sender, respond) => {
  if (sender.id !== chrome.runtime.id) return;
  if (!message || typeof message.type !== 'string') {
    respond({ ok: false, error: '请求格式不正确' });
    return;
  }
  const extensionPage = sender.url?.startsWith('chrome-extension://' + chrome.runtime.id + '/');
  if (sender.tab && !extensionPage) {
    if (!CONTENT_ACTIONS.has(message.type)) {
      respond({ ok: false, error: '请从插件设置中进行此操作' });
      return;
    }
    if (message.type === 'DELETE_TAG' && !Number.isSafeInteger(message.expectedRevision)) {
      respond({ ok: false, error: '请重新确认删除标签' });
      return;
    }
    if (['SET_USER', 'DELETE_USER'].includes(message.type)) {
      let site;
      try {
        site = UserTagsAdapters.site(new URL(sender.url).hostname);
      } catch {
        /* Invalid sender URL. */
      }
      if (!site || message.user?.site !== site) {
        respond({ ok: false, error: '用户所属站点不正确' });
        return;
      }
    }
  }
  repository.dispatch(message).then(
    (result) => respond({ ok: true, ...result }),
    (error) => respond({ ok: false, error: error.message }),
  );
  return true;
});
