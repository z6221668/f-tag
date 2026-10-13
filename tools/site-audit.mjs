// Read-only checks on public pages in the isolated browser. No user markers are saved.
import { connect } from './cdp.mjs';
const targets = await (await fetch('http://127.0.0.1:9478/json/list')).json();
const target = targets.find((item) => item.type === 'page');
if (!target) throw new Error('Isolated test browser is not running');
const cdp = await connect(target);
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const pages = ['https://www.v2ex.com/t/1', 'https://www.52pojie.cn/', 'https://www.zhihu.com/'];
try {
  for (const url of pages) {
    const navigation = await cdp.send('Page.navigate', { url });
    if (navigation.errorText) {
      console.log(JSON.stringify({ url, status: 'unavailable', error: navigation.errorText }));
      continue;
    }
    let details;
    for (let i = 0; i < 60; i++) {
      await wait(200);
      try {
        const result = await cdp.send('Runtime.evaluate', {
          expression:
            '({title: document.title, ready: document.readyState, buttons: document.querySelectorAll("[data-user-tags-host]").length})',
          returnByValue: true,
        });
        details = result.result.value;
      } catch {
        continue;
      }
      if (
        details?.buttons > 0 ||
        /Just a moment|验证码|访问验证|提示信息|Privacy error|隐私错误/i.test(details?.title || '')
      )
        break;
    }
    console.log(
      JSON.stringify({
        url,
        status: details?.buttons > 0 ? 'profile-buttons-present' : 'not-verified',
        ...details,
      }),
    );
  }
} finally {
  cdp.close();
}
