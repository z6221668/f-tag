UserTagsAdapters.register({
  name: 'V2EX',
  domain: 'v2ex.com',
  selector: 'a[href*="/member/"]',
  resolve(url) {
    const match = url.pathname.match(/^\/member\/([^/]+)\/?$/);
    return match ? 'member/' + match[1].toLowerCase() : null;
  },
});
