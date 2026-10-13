UserTagsAdapters.register({
  name: '知乎',
  domain: 'zhihu.com',
  selector: 'a[href*="/people/"],a[href*="/org/"]',
  resolve(url) {
    const match = url.pathname.match(/^\/(people|org)\/([^/]+)\/?$/);
    return match ? match[1] + '/' + match[2] : null;
  },
});
