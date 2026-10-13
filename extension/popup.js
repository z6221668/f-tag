(() => {
  const $ = (id) => document.getElementById(id);
  let state, hostname;
  function render() {
    $('enabled').checked = state.settings.enabled;
    $('enabled').disabled = false;
    $('excluded').checked = hostname ? UserTagsCore.excluded(hostname, state.settings) : false;
    const parentExclusion =
      hostname &&
      state.settings.excludedSites.find((h) => h !== hostname && UserTagsCore.within(hostname, h));
    $('excluded').disabled = !hostname || Boolean(parentExclusion);
    const adapter =
      hostname && UserTagsAdapters.adapters.find((a) => UserTagsCore.within(hostname, a.domain));
    $('support').textContent = parentExclusion
      ? '已被父域名白名单排除，可在设置页移除 ' + parentExclusion
      : adapter
        ? adapter.name + ' · 已内置适配'
        : hostname
          ? '通用账号链接识别 · 可在设置中添加站点规则'
          : '此页面无法使用用户标签';
    $('count').textContent =
      `${state.users.length} 位已标记用户 · ${state.tags.length} 个标签 · 仅本地存储`;
  }
  async function change(message) {
    try {
      state = await FTagClient.request(message);
      $('status').textContent = '已保存';
      render();
    } catch (e) {
      $('status').textContent = e.message;
      $('status').classList.add('error');
      render();
    }
  }
  $('enabled').addEventListener('change', () =>
    change({ type: 'SET_ENABLED', enabled: $('enabled').checked }),
  );
  $('excluded').addEventListener('change', () =>
    change({ type: 'SET_EXCLUDED', host: hostname, excluded: $('excluded').checked }),
  );
  $('options').addEventListener('click', () => chrome.runtime.openOptionsPage());
  Promise.all([
    FTagClient.request({ type: 'GET_STATE' }),
    chrome.tabs.query({ active: true, currentWindow: true }),
  ])
    .then(([data, tabs]) => {
      state = data;
      try {
        const url = new URL(tabs[0]?.url);
        if (['https:', 'http:'].includes(url.protocol)) hostname = url.hostname;
      } catch {
        /* Restricted browser page. */
      }
      $('site').textContent = hostname || '浏览器内部页面';
      render();
    })
    .catch((e) => {
      $('status').textContent = e.message;
      $('status').classList.add('error');
    });
})();
