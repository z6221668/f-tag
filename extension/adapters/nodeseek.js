UserTagsAdapters.register({
  name: 'NodeSeek',
  domain: 'nodeseek.com',
  preserveHost: true,
  selector: 'a[href*="/space/"]',
  resolve(url) {
    const match = url.pathname.match(/^\/space\/([1-9]\d*)\/?$/);
    return match ? 'space/' + match[1] : null;
  },
});
