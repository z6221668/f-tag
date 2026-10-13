UserTagsAdapters.register({
  name: 'LINUX DO',
  domain: 'linux.do',
  preserveHost: true,
  selector: 'a[data-user-card][href*="/u/"], .names a[href*="/u/"], a.username[href*="/u/"]',
  resolve(url) {
    const match = url.pathname.match(/^\/u\/([a-zA-Z0-9_.-]+)(?:\/(?:summary|activity))?\/?$/);
    // Preserve the original username spelling used by 0.1.0 generic records.
    return match && !match[1].endsWith('.json') ? 'u/' + match[1] : null;
  },
});
