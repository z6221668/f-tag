(() => {
  const state = UserTagsCore.fresh();
  state.users = Array.from({ length: 10000 }, (_, id) => ({
    site: location.hostname,
    id: 'member/' + id,
    name: 'User ' + id,
    levelId: 'level-1',
    tagIds: [],
    note: '',
    sourceUrl: '',
    createdAt: null,
    updatedAt: null,
  }));
  testSetState(state);
  globalThis.stressLink = (id) => {
    const row = document.createElement('p');
    const link = document.createElement('a');
    link.href = '/member/' + id;
    link.textContent = 'User ' + id;
    link.id = 'user-' + id;
    row.append(link);
    return row;
  };
  document
    .getElementById('authors')
    .append(...Array.from({ length: 500 }, (_, id) => stressLink(id)));
})();
