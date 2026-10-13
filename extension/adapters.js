/* Adapter IDs form the persistence contract; preserve them when expanding support. */
(() => {
  const within = UserTagsCore.within;
  const adapters = [];
  function register(adapter) {
    if (
      !adapter.domain ||
      typeof adapter.resolve !== 'function' ||
      adapters.some((a) => a.domain === adapter.domain)
    )
      throw new Error('Invalid or duplicate site adapter');
    adapters.push(adapter);
  }
  const adapterFor = (h) => adapters.find((a) => within(h, a.domain));
  // New adapters retain the host used by generic/custom rules in older backups.
  const site = (h) => {
    const adapter = adapterFor(h);
    return adapter && !adapter.preserveHost ? adapter.domain : UserTagsCore.canonicalSite(h);
  };
  function identity(href, pageURL, rules = []) {
    if (!href) return null;
    let page, link;
    try {
      page = new URL(pageURL);
      link = new URL(href, page);
    } catch {
      return null;
    }
    if (!['http:', 'https:'].includes(link.protocol) || site(link.hostname) !== site(page.hostname))
      return null;
    const adapter = adapterFor(page.hostname);
    const id = adapter
      ? adapter.resolve(link)
      : UserTagsGeneric.resolve(
          link,
          rules.find((r) => r.host === page.hostname),
        );
    return id ? { site: site(page.hostname), id } : null;
  }
  function selector(host, rules = []) {
    return adapterFor(host)?.selector || rules.find((r) => r.host === host)?.selector || 'a[href]';
  }
  globalThis.UserTagsAdapters = { adapters, register, site, identity, selector };
})();
