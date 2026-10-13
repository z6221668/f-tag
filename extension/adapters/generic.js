globalThis.UserTagsGeneric = {
  resolve(url, rule) {
    if (rule) {
      if (!url.pathname.startsWith(rule.prefix)) return null;
      const suffix = url.pathname.slice(rule.prefix.length).replace(/\/$/, '');
      return suffix && !suffix.includes('/') ? rule.prefix.slice(1) + suffix : null;
    }
    const match = url.pathname.match(/^\/(member|users|user|u)\/([^/]+)\/?$/);
    return match ? match[1] + '/' + match[2] : null;
  },
};
