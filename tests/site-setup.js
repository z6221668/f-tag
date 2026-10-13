// Reuse a production site's resolver and selector on the local fixture host.
const domain = new URLSearchParams(location.search).get('site');
const adapter = UserTagsAdapters.adapters.find((a) => a.domain === domain);
if (!adapter) throw new Error('Unknown fixture site');
UserTagsAdapters.register({ ...adapter, domain: location.hostname, preserveHost: true });
const profiles =
  domain === 'nodeseek.com'
    ? ['/space/9', '/space/9#/comments']
    : domain === 'linux.do'
      ? ['/u/Alice_1', '/u/Alice_1/summary']
      : ['/space-uid-12345.html', '/home.php?mod=space&uid=12345'];
function fixtureLink(href, id, name = 'Alice') {
  const link = document.createElement('a');
  link.href = href;
  link.textContent = name;
  link.id = id;
  link.className = 'username';
  link.setAttribute('data-user-card', 'Alice_1');
  return link;
}
document
  .getElementById('authors')
  .append(fixtureLink(profiles[0], 'author'), fixtureLink(profiles[1], 'reply'));
document
  .getElementById('authors')
  .append(
    fixtureLink(
      domain === 'linux.do' ? '/u/Alice_1.json' : '/thread-123-1-1.html',
      'unrelated',
      'Unrelated',
    ),
  );
const old = UserTagsCore.fresh();
const user = UserTagsAdapters.identity(profiles[0], location.href);
old.users.push({
  ...user,
  name: 'Alice',
  levelId: 'level-1',
  tagIds: [],
  note: '',
  sourceUrl: '',
  createdAt: null,
  updatedAt: null,
});
testSetState(UserTagsCore.readBackup(UserTagsCore.backup(old, '0.3.0'), '0.3.0'));
