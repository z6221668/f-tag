export function legacyState() {
  return {
    schemaVersion: 1,
    tags: [
      { id: 'level-1', name: '一级 · 留意', color: '#e4c05c' },
      { id: 'level-2', name: '二级 · 低质量', color: '#e58c50' },
      { id: 'level-3', name: '三级 · 避雷', color: '#ca5266' },
      { id: 'custom', name: '广告', color: '#456789' },
    ],
    users: [],
    settings: { enabled: true, excludedSites: [], rules: [] },
  };
}
