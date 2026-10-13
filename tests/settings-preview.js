/* Synthetic accounts for the local visual preview; no real user's records are read. */
(async () => {
  async function send(message) {
    const result = await chrome.runtime.sendMessage(message);
    if (!result.ok) throw new Error(result.error);
    return result.state;
  }
  const definitions = [
    { name: '广告刷屏', color: '#dfec8b' },
    { name: '偷换概念', color: '#eeaa91' },
    { name: '认真讨论', color: '#9fc5ad' },
  ];
  for (const tag of definitions) await send({ type: 'SAVE_TAG', tag });
  const state = await send({ type: 'GET_STATE' });
  const records = [
    {
      site: 'v2ex.com',
      id: 'member/example-a',
      name: '示例用户 A',
      levelId: 'level-3',
      note: '重复发布推广内容。',
    },
    { site: 'zhihu.com', id: 'people/example-b', name: '示例用户 B', levelId: 'level-2', note: '' },
    {
      site: 'linux.do',
      id: 'u/example-c',
      name: '示例用户 C',
      levelId: 'level-1',
      note: '保留这次讨论的印象。',
    },
  ];
  for (const [index, record] of records.entries())
    await send({
      type: 'SET_USER',
      user: { ...record, tagIds: [state.tags[index].id], sourceUrl: '' },
    });
})();
