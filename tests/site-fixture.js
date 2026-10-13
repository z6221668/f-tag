(async () => {
  const results = [],
    wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
  const assert = (condition, text) => {
    if (!condition) throw new Error(text);
    results.push('PASS ' + text);
  };
  const shadow = (id) => testShadow(document.getElementById(id).nextElementSibling);
  try {
    await wait(240);
    assert(
      document.querySelectorAll('[data-user-tags-host]').length === 2,
      'only valid profile URLs receive buttons',
    );
    assert(
      shadow('author').querySelectorAll('.tag').length === 1 &&
        shadow('reply').querySelectorAll('.tag').length === 1,
      'old backup marks match both profile URL variants',
    );
    shadow('author').querySelector('button').click();
    const panel = testShadow(document.querySelector('[data-user-tags-panel]'));
    panel.querySelector('select').value = 'level-2';
    panel.querySelector('textarea').value = '测试标记原因';
    [...panel.querySelectorAll('button')].find((n) => n.textContent === '保存标记').click();
    await wait(220);
    assert(
      shadow('reply').querySelectorAll('.tag').length === 1,
      'mark edit propagates between profile URL variants',
    );
    document.getElementById('authors').append(fixtureLink(profiles[1], 'dynamic'));
    await wait(240);
    assert(
      shadow('dynamic').querySelectorAll('.tag').length === 1,
      'dynamic reply inherits saved marks',
    );
    document.getElementById('result').textContent =
      'ALL PASS ' + domain + '\n' + results.join('\n');
  } catch (error) {
    document.getElementById('result').textContent =
      'FAILED ' + domain + ': ' + error.message + '\n' + results.join('\n');
  }
})();
