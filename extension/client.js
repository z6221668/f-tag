globalThis.FTagClient = {
  async call(message) {
    let result;
    try {
      result = await chrome.runtime.sendMessage(message);
    } catch {
      throw new Error('插件连接已失效，请重新打开设置页');
    }
    if (!result?.ok) throw new Error(result?.error || '操作失败，请重试');
    return result;
  },
  async request(message) {
    return (await this.call(message)).state;
  },
  validateRules(rules) {
    for (const rule of rules) {
      try {
        document.querySelector(rule.selector);
      } catch {
        throw new Error('站点 ' + rule.host + ' 的选择器不合法：' + rule.selector);
      }
    }
  },
  element(tag, text, className) {
    const node = document.createElement(tag);
    if (text !== undefined) node.textContent = text;
    if (className) node.className = className;
    return node;
  },
  chip(tag) {
    const node = this.element('span', tag.name, 'chip');
    node.style.backgroundColor = tag.color + '22';
    node.style.color = '#262332';
    node.style.border = '1px solid ' + tag.color;
    return node;
  },
};
