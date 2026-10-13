/* Persistence contracts are independent of site adapters and extension versions. */
(() => {
  const SCHEMA_VERSION = 2;
  const FORMAT_VERSION = 2;
  const DEFAULT_LEVELS = [
    { id: 'level-1', name: '一级 · 留意', color: '#e4c05c', rank: 1 },
    { id: 'level-2', name: '二级 · 低质量', color: '#e58c50', rank: 2 },
    { id: 'level-3', name: '三级 · 避雷', color: '#ca5266', rank: 3 },
  ];
  const aliases = new Map(
    ['nodeseek.com', 'linux.do', 'chiphell.com', '52pojie.cn', 'hostloc.com'].map((domain) => [
      'www.' + domain,
      domain,
    ]),
  );
  const fresh = () => ({
    schemaVersion: SCHEMA_VERSION,
    revision: 0,
    levels: structuredClone(DEFAULT_LEVELS),
    tags: [],
    users: [],
    settings: { enabled: true, excludedSites: [], rules: [] },
  });
  const userKey = (site, id) => JSON.stringify([site, id]);
  const within = (hostname, base) => hostname === base || hostname.endsWith('.' + base);
  const excluded = (hostname, settings) =>
    settings.excludedSites.some((base) => within(hostname, base));
  function host(value) {
    if (typeof value !== 'string') throw new Error('请输入域名');
    const hostname = value.trim().toLowerCase().replace(/\.$/, '');
    if (
      !hostname ||
      hostname.length > 253 ||
      hostname.split('.').some((label) => !/^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/.test(label))
    )
      throw new Error('请输入有效域名，不包含协议、路径或端口');
    return hostname;
  }
  const canonicalSite = (hostname) => aliases.get(hostname) || hostname;
  function text(value, max, label, optional = false) {
    if (typeof value !== 'string' || value.length > max || (!optional && !value.trim()))
      throw new Error(label + '格式不正确');
    return value.trim();
  }
  function date(value, label) {
    if (value === null) return null;
    if (
      typeof value !== 'string' ||
      !/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z$/.test(value) ||
      !Number.isFinite(Date.parse(value)) ||
      new Date(value).toISOString() !== value
    )
      throw new Error(label + '格式不正确');
    return value;
  }
  function source(value) {
    const input = text(value, 2048, '来源链接', true);
    if (!input) return '';
    let url;
    try {
      url = new URL(input);
    } catch {
      throw new Error('来源链接需要是完整的 HTTP 或 HTTPS 地址');
    }
    if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password)
      throw new Error('来源链接需要是无账号密码的 HTTP 或 HTTPS 地址');
    if (url.href.length > 2048) throw new Error('来源链接过长');
    return url.href;
  }
  function definition(raw, label) {
    if (!raw || typeof raw !== 'object') throw new Error(label + '格式不正确');
    const color = text(raw.color, 7, '颜色');
    if (!/^#[0-9a-f]{6}$/i.test(color)) throw new Error('颜色需要为六位十六进制格式');
    return {
      id: text(raw.id, 100, label + ' ID'),
      name: text(raw.name, 30, label + '名称'),
      color,
    };
  }
  function unique(items, field, label) {
    if (new Set(items.map((item) => item[field])).size !== items.length)
      throw new Error(label + '重复');
  }
  function validate(raw) {
    if (
      !raw ||
      raw.schemaVersion !== SCHEMA_VERSION ||
      !Array.isArray(raw.levels) ||
      !Array.isArray(raw.tags) ||
      !Array.isArray(raw.users) ||
      !raw.settings
    )
      throw new Error('数据结构或版本不正确');
    if (raw.levels.length !== 3 || raw.tags.length > 1000 || raw.users.length > 50000)
      throw new Error('等级或记录数量不正确');
    const levels = raw.levels
      .map((level) => {
        if (![1, 2, 3].includes(level.rank)) throw new Error('等级顺序不正确');
        return { ...definition(level, '等级'), rank: level.rank };
      })
      .sort((a, b) => a.rank - b.rank);
    const tags = raw.tags.map((tag) => definition(tag, '标签'));
    for (const [items, label] of [
      [levels, '等级'],
      [tags, '标签'],
    ]) {
      unique(items, 'id', label + ' ID');
      unique(items, 'name', label + '名称');
    }
    unique(levels, 'rank', '等级顺序');
    const levelIds = new Set(levels.map((level) => level.id));
    const tagIds = new Set(tags.map((tag) => tag.id));
    const users = raw.users
      .map((user) => {
        if (!user || !Array.isArray(user.tagIds) || user.tagIds.some((id) => !tagIds.has(id)))
          throw new Error('用户引用了不存在的标签');
        if (user.levelId !== null && !levelIds.has(user.levelId))
          throw new Error('用户引用了不存在的等级');
        const record = {
          site: host(user.site),
          id: text(user.id, 300, '用户 ID'),
          name: text(user.name, 120, '用户名称'),
          levelId: user.levelId,
          tagIds: [...new Set(user.tagIds)],
          note: text(user.note, 2000, '备注', true),
          sourceUrl: source(user.sourceUrl),
          createdAt: date(user.createdAt, '创建时间'),
          updatedAt: date(user.updatedAt, '更新时间'),
        };
        if (record.createdAt && record.updatedAt && record.createdAt > record.updatedAt)
          throw new Error('更新时间早于创建时间');
        return record;
      })
      .filter((user) => user.levelId || user.tagIds.length || user.note);
    unique(
      users.map((user) => ({ key: userKey(user.site, user.id) })),
      'key',
      '用户记录',
    );
    const settings = raw.settings;
    if (
      typeof settings.enabled !== 'boolean' ||
      !Array.isArray(settings.excludedSites) ||
      !Array.isArray(settings.rules) ||
      settings.excludedSites.length > 1000 ||
      settings.rules.length > 200
    )
      throw new Error('站点设置格式不正确');
    const rules = settings.rules.map((rule) => {
      if (!rule || typeof rule !== 'object') throw new Error('站点规则格式不正确');
      const prefix = text(rule.prefix, 150, '账号路径前缀');
      if (!/^\/[a-zA-Z0-9_/-]+\/$/.test(prefix) || prefix.includes('//'))
        throw new Error('账号路径前缀应类似 /profile/');
      return { host: host(rule.host), prefix, selector: text(rule.selector, 300, '用户名选择器') };
    });
    unique(rules, 'host', '站点规则');
    const revision = raw.revision ?? 0;
    if (!Number.isSafeInteger(revision) || revision < 0) throw new Error('数据修订号不正确');
    return {
      schemaVersion: SCHEMA_VERSION,
      revision,
      levels,
      tags,
      users,
      settings: {
        enabled: settings.enabled,
        excludedSites: [...new Set(settings.excludedSites.map(host))],
        rules,
      },
    };
  }
  function mergeAliases(state) {
    const records = new Map();
    const ranks = new Map(state.levels.map((level) => [level.id, level.rank]));
    for (const original of state.users) {
      const user = { ...original, site: canonicalSite(original.site) };
      const key = userKey(user.site, user.id),
        previous = records.get(key);
      if (!previous) {
        records.set(key, user);
        continue;
      }
      const notes = [...new Set([previous.note, user.note].filter(Boolean))];
      const sources = [...new Set([previous.sourceUrl, user.sourceUrl].filter(Boolean))];
      if (previous.levelId && user.levelId && previous.levelId !== user.levelId)
        notes.push(
          '合并前的等级：' +
            [previous.levelId, user.levelId]
              .map((id) => state.levels.find((level) => level.id === id).name)
              .join('、'),
        );
      if (sources.length > 1) notes.push('合并前的其他来源：' + sources.slice(1).join('；'));
      const note = notes.join('\n');
      if (note.length > 2000) throw new Error('同一账号的合并备注超过上限，请先整理旧记录');
      const times = [previous.createdAt, user.createdAt].filter(Boolean).sort();
      const updates = [previous.updatedAt, user.updatedAt].filter(Boolean).sort();
      records.set(key, {
        ...previous,
        tagIds: [...new Set([...previous.tagIds, ...user.tagIds])],
        levelId:
          (ranks.get(user.levelId) || 0) > (ranks.get(previous.levelId) || 0)
            ? user.levelId
            : previous.levelId,
        note,
        sourceUrl: sources[0] || '',
        createdAt: times[0] || null,
        updatedAt: updates.at(-1) || null,
      });
    }
    return validate({ ...state, users: [...records.values()] });
  }
  function migrate(raw) {
    if (!raw || ![1, SCHEMA_VERSION].includes(raw.schemaVersion))
      throw new Error('不支持的数据版本，请升级插件');
    if (raw.schemaVersion === SCHEMA_VERSION) return mergeAliases(validate(raw));
    if (!Array.isArray(raw.tags) || !Array.isArray(raw.users)) throw new Error('旧数据格式不正确');
    const legacyTags = raw.tags.map((tag) => definition(tag, '标签'));
    unique(legacyTags, 'id', '标签 ID');
    unique(legacyTags, 'name', '标签名称');
    const next = fresh();
    next.settings = raw.settings;
    const namedLevels = new Map(
      legacyTags
        .filter((tag) => DEFAULT_LEVELS.some((level) => level.id === tag.id))
        .map((tag) => [tag.id, tag]),
    );
    const usedNames = new Set([...namedLevels.values()].map((tag) => tag.name));
    next.levels = DEFAULT_LEVELS.map((level) => {
      if (namedLevels.has(level.id)) return { ...level, ...namedLevels.get(level.id) };
      let name = level.name;
      let suffix = 1;
      while (usedNames.has(name)) name = level.name + '（' + suffix++ + '）';
      usedNames.add(name);
      return { ...level, name };
    });
    const ids = new Set(legacyTags.map((tag) => tag.id));
    const ranks = new Map(next.levels.map((level) => [level.id, level.rank]));
    next.tags = legacyTags.filter((tag) => !ranks.has(tag.id));
    next.users = raw.users.map((user) => {
      if (!user || !Array.isArray(user.tagIds) || user.tagIds.some((id) => !ids.has(id)))
        throw new Error('旧记录引用了不存在的标签');
      const selected = [...new Set(user.tagIds)]
        .filter((id) => ranks.has(id))
        .sort((a, b) => ranks.get(a) - ranks.get(b));
      return {
        site: user.site,
        id: user.id,
        name: user.name,
        levelId: selected.at(-1) || null,
        tagIds: user.tagIds.filter((id) => !ranks.has(id)),
        note:
          selected.length > 1
            ? '旧版本选择的等级：' +
              selected.map((id) => next.levels.find((level) => level.id === id).name).join('、')
            : '',
        sourceUrl: '',
        createdAt: null,
        updatedAt: null,
      };
    });
    // Validate duplicates before alias merging so corrupted backups are not silently repaired.
    return mergeAliases(validate(next));
  }
  function index(state) {
    return {
      users: new Map(state.users.map((user) => [userKey(user.site, user.id), user])),
      tags: new Map(state.tags.map((tag) => [tag.id, tag])),
      levels: new Map(state.levels.map((level) => [level.id, level])),
    };
  }
  function stableStringify(value) {
    return JSON.stringify(value, (_, item) => {
      if (item && typeof item === 'object' && !Array.isArray(item))
        return Object.fromEntries(
          Object.keys(item)
            .sort()
            .map((key) => [key, item[key]]),
        );
      return item;
    });
  }
  const recordToken = (user) => stableStringify(user || null);
  function reduce(state, message, now = new Date().toISOString()) {
    const next = structuredClone(state);
    switch (message.type) {
      case 'SAVE_TAG': {
        if (!message.tag || typeof message.tag !== 'object') throw new Error('标签格式不正确');
        const { id, name, color } = message.tag;
        if (id && !next.tags.some((tag) => tag.id === id))
          throw new Error('标签已被删除，请重新选择');
        const tag = { id: id || crypto.randomUUID(), name, color };
        const position = next.tags.findIndex((item) => item.id === tag.id);
        if (position < 0) next.tags.push(tag);
        else next.tags[position] = tag;
        break;
      }
      case 'SAVE_LEVEL': {
        if (!message.level || typeof message.level !== 'object') throw new Error('等级格式不正确');
        const position = next.levels.findIndex((level) => level.id === message.level.id);
        if (position < 0) throw new Error('等级不存在');
        next.levels[position] = {
          ...next.levels[position],
          name: message.level.name,
          color: message.level.color,
        };
        break;
      }
      case 'DELETE_TAG':
        if (message.expectedRevision !== undefined && message.expectedRevision !== state.revision)
          throw new Error('数据已更新，请重新确认删除标签');
        if (!next.tags.some((tag) => tag.id === message.id))
          throw new Error('标签已被删除，请重新选择');
        next.tags = next.tags.filter((tag) => tag.id !== message.id);
        next.users = next.users.map((user) => ({
          ...user,
          tagIds: user.tagIds.filter((id) => id !== message.id),
        }));
        break;
      case 'SET_USER':
      case 'DELETE_USER': {
        const identity = message.user;
        if (!identity || typeof identity !== 'object') throw new Error('用户记录格式不正确');
        const previous = next.users.find(
          (user) => user.site === identity.site && user.id === identity.id,
        );
        if (
          message.expectedRecord !== undefined &&
          message.expectedRecord !== recordToken(previous)
        )
          throw new Error('该用户的标记已在其他页面更新，请重新打开编辑器');
        next.users = next.users.filter(
          (user) => !(user.site === identity.site && user.id === identity.id),
        );
        if (message.type === 'SET_USER') {
          if (
            !identity.levelId &&
            Array.isArray(identity.tagIds) &&
            !identity.tagIds.length &&
            !identity.note?.trim()
          ) {
            if (previous) break;
            throw new Error('请选择等级、标签或填写备注');
          }
          next.users.push({
            ...identity,
            createdAt: previous ? previous.createdAt : now,
            updatedAt: now,
          });
        }
        break;
      }
      case 'SET_ENABLED':
        next.settings.enabled = message.enabled;
        break;
      case 'SET_EXCLUDED': {
        const hostname = host(message.host);
        next.settings.excludedSites = next.settings.excludedSites.filter(
          (item) => item !== hostname,
        );
        if (message.excluded) next.settings.excludedSites.push(hostname);
        break;
      }
      case 'SET_RULES':
        next.settings.rules = message.rules;
        break;
      case 'IMPORT':
        return readBackup(message.backup, message.currentVersion);
      default:
        throw new Error('未知操作');
    }
    return validate(next);
  }
  function compareVersions(a, b) {
    const parse = (value) => {
      if (typeof value !== 'string' || !/^\d+\.\d+\.\d+(?:\.\d+)?$/.test(value))
        throw new Error('备份的插件版本格式不正确');
      const parts = value.split('.').map(Number);
      if (parts.some((part) => !Number.isSafeInteger(part)))
        throw new Error('备份的插件版本格式不正确');
      return parts;
    };
    const left = parse(a),
      right = parse(b);
    for (let i = 0; i < 4; i++)
      if ((left[i] || 0) !== (right[i] || 0)) return (left[i] || 0) > (right[i] || 0) ? 1 : -1;
    return 0;
  }
  function backup(state, appVersion) {
    compareVersions(appVersion, appVersion);
    return {
      format: 'f-tag',
      formatVersion: FORMAT_VERSION,
      appVersion,
      exportedAt: new Date().toISOString(),
      state: validate(state),
    };
  }
  function readBackup(raw, appVersion) {
    if (!raw || raw.format !== 'f-tag') throw new Error('请选择 f-tag 导出的备份文件');
    if (compareVersions(raw.appVersion, appVersion) > 0)
      throw new Error('备份来自 f-tag ' + raw.appVersion + '，请升级插件后再导入');
    if (raw.formatVersion > FORMAT_VERSION || raw.state?.schemaVersion > SCHEMA_VERSION)
      throw new Error('备份格式版本较高，请升级插件后再导入');
    if (
      ![1, FORMAT_VERSION].includes(raw.formatVersion) ||
      raw.formatVersion !== raw.state?.schemaVersion
    )
      throw new Error('备份格式不正确');
    return migrate(raw.state);
  }
  globalThis.UserTagsCore = {
    SCHEMA_VERSION,
    FORMAT_VERSION,
    fresh,
    host,
    canonicalSite,
    userKey,
    within,
    excluded,
    validate,
    migrate,
    reduce,
    index,
    stableStringify,
    recordToken,
    compareVersions,
    backup,
    readBackup,
  };
})();
