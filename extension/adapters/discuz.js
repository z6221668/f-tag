/* Shared URL grammar; each supported forum registers its own domain separately. */
globalThis.UserTagsDiscuz = {
  selector: 'a[href*="space-uid-"],a[href*="home.php?"][href*="uid="]',
  resolve(url) {
    const rewritten = url.pathname.match(/^\/space-uid-([1-9]\d*)\.html$/);
    if (rewritten) return 'uid/' + rewritten[1];
    if (url.pathname !== '/home.php' || url.searchParams.get('mod') !== 'space') return null;
    const action = url.searchParams.get('do');
    if (action && action !== 'profile') return null;
    const values = url.searchParams.getAll('uid');
    if (values.length !== 1 || !/^[1-9]\d*$/.test(values[0])) return null;
    if (url.searchParams.getAll('mod').length !== 1) return null;
    return 'uid/' + values[0];
  },
};
