// Run only against an isolated browser profile opened on the local native fixture.
import assert from 'node:assert/strict';
import { writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { connect } from './cdp.mjs';
import { legacyState } from '../tests/legacy.js';
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const targets = await (await fetch('http://127.0.0.1:9478/json/list')).json();
const target =
  targets.find((item) => item.type === 'page' && item.url.includes('/tests/native-fixture.html')) ||
  (process.argv.includes('--diagnose') &&
    targets.find((item) => item.type === 'page' && item.url.startsWith('chrome-extension://')));
if (!target) throw new Error('Open the native fixture in the isolated test browser first');
const cdp = await connect(target);
const contexts = new Map();
cdp.on('Runtime.executionContextCreated', (event) => contexts.set(event.context.id, event.context));
cdp.on('Runtime.executionContextsCleared', () => contexts.clear());
async function evaluate(expression, contextId) {
  const result = await cdp.send('Runtime.evaluate', {
    expression,
    contextId,
    awaitPromise: true,
    returnByValue: true,
  });
  if (result.exceptionDetails)
    throw new Error(result.exceptionDetails.exception?.description || result.exceptionDetails.text);
  return result.result.value;
}
async function extensionContext() {
  for (let attempt = 0; attempt < 50; attempt++) {
    for (const id of contexts.keys()) {
      try {
        if (await evaluate("typeof UserTagsCore === 'object' && Boolean(chrome.runtime?.id)", id))
          return id;
      } catch {
        contexts.delete(id);
      }
    }
    await wait(100);
  }
  throw new Error('The extension isolated world was not loaded');
}
const attributes = (node) =>
  Object.fromEntries(
    Array.from({ length: (node.attributes?.length || 0) / 2 }, (_, i) => [
      node.attributes[i * 2],
      node.attributes[i * 2 + 1],
    ]),
  );
async function nodes() {
  await cdp.send('DOM.enable');
  return (await cdp.send('DOM.getFlattenedDocument', { depth: -1, pierce: true })).nodes;
}
async function click(node) {
  const { model } = await cdp.send('DOM.getBoxModel', { nodeId: node.nodeId });
  const quad = model.content;
  const x = (quad[0] + quad[2] + quad[4] + quad[6]) / 4,
    y = (quad[1] + quad[3] + quad[5] + quad[7]) / 4;
  await cdp.send('Input.dispatchMouseEvent', {
    type: 'mousePressed',
    x,
    y,
    button: 'left',
    clickCount: 1,
  });
  await cdp.send('Input.dispatchMouseEvent', {
    type: 'mouseReleased',
    x,
    y,
    button: 'left',
    clickCount: 1,
  });
}
async function setValue(node, value, contextId) {
  const { object } = await cdp.send('DOM.resolveNode', {
    nodeId: node.nodeId,
    executionContextId: contextId,
  });
  await cdp.send('Runtime.callFunctionOn', {
    objectId: object.objectId,
    functionDeclaration:
      'function(value) { this.value = value; this.dispatchEvent(new Event("change", { bubbles: true })); }',
    arguments: [{ value }],
    returnByValue: true,
  });
}
try {
  await cdp.send('Runtime.enable');
  await cdp.send('Emulation.setDeviceMetricsOverride', {
    width: 1280,
    height: 1200,
    deviceScaleFactor: 1,
    mobile: false,
  });
  const context = await extensionContext();
  if (process.argv.includes('--diagnose') && target.url.startsWith('chrome-extension://')) {
    console.log(
      'Options status:',
      await evaluate('document.getElementById("status").textContent', context),
    );
    console.log(
      'Grade forms:',
      await evaluate('document.querySelectorAll("#levels form").length', context),
    );
    cdp.close();
    process.exit(0);
  }
  const api = async (message) => {
    const result = await evaluate(
      'chrome.runtime.sendMessage(' + JSON.stringify(message) + ')',
      context,
    );
    assert.equal(result.ok, true, result.error);
    return result;
  };
  for (let attempt = 0; attempt < 50; attempt++) {
    if (
      (await evaluate('document.getElementById("result").textContent', context)).startsWith(
        'NATIVE ALL PASS',
      )
    )
      break;
    await wait(100);
  }
  assert.match(
    await evaluate('document.getElementById("result").textContent', context),
    /^NATIVE ALL PASS/,
  );
  const initial = (await api({ type: 'GET_STATE' })).state;
  const site = new URL(target.url).hostname;
  const identity = { site, id: 'member/alice', name: 'Alice' };
  if (process.argv.includes('--reload')) {
    const currentTargets = await (await fetch('http://127.0.0.1:9478/json/list')).json();
    const worker = currentTargets.find(
      (item) => item.type === 'service_worker' && item.url.startsWith('chrome-extension://'),
    );
    if (!worker) throw new Error('Extension worker is not active');
    const workerCDP = await connect(worker);
    try {
      await workerCDP.send('Runtime.evaluate', { expression: 'chrome.runtime.reload()' });
    } catch {
      /* Reload destroys the worker execution context. */
    }
    workerCDP.close();
    await wait(1000);
    await cdp.send('Page.reload', { ignoreCache: true });
    await wait(2000);
    console.log('Reloaded unpacked extension and fixture');
  } else if (process.argv.includes('--diagnose')) {
    console.log(
      'Content token implementation:',
      await evaluate('UserTagsCore.recordToken.toString()', context),
    );
    const currentTargets = await (await fetch('http://127.0.0.1:9478/json/list')).json();
    const worker = currentTargets.find(
      (item) => item.type === 'service_worker' && item.url.startsWith('chrome-extension://'),
    );
    if (worker) {
      const workerCDP = await connect(worker);
      const details = await workerCDP.send('Runtime.evaluate', {
        expression: 'UserTagsCore.recordToken.toString()',
        returnByValue: true,
      });
      console.log('Worker token implementation:', details.result.value);
      workerCDP.close();
    }
  } else if (process.argv.includes('--restore-check')) {
    const saved = initial.users.find((user) => user.site === site && user.id === identity.id);
    assert.equal(saved?.note, 'native API save');
    assert.equal(saved.levelId, 'level-2');
    assert.ok((await nodes()).some((node) => attributes(node).class === 'tag'));
    console.log('NATIVE PERSISTENCE PASS: record restored after browser restart');
  } else {
    const previous = initial.users.find((user) => user.site === site && user.id === identity.id);
    await api({
      type: 'SET_USER',
      user: {
        ...identity,
        levelId: 'level-2',
        tagIds: [],
        note: 'native API save',
        sourceUrl: target.url,
      },
      expectedRecord: await evaluate(
        'UserTagsCore.recordToken(' + JSON.stringify(previous || null) + ')',
        context,
      ),
    });
    await wait(300);
    let dom = await nodes();
    assert.ok(dom.some((node) => attributes(node).class === 'tag'));
    await click(
      dom.find(
        (node) =>
          attributes(node).class === 'trigger' &&
          attributes(node)['aria-label'] === '标记用户 Alice',
      ),
    );
    await wait(150);
    dom = await nodes();
    assert.ok(dom.some((node) => attributes(node).role === 'dialog'));
    await setValue(
      dom.find((node) => node.nodeName === 'SELECT'),
      'level-3',
      context,
    );
    await setValue(
      dom.find((node) => node.nodeName === 'TEXTAREA'),
      'native page editor',
      context,
    );
    await click(
      dom.find((node) => node.nodeName === 'BUTTON' && attributes(node).type === 'submit'),
    );
    await wait(350);
    const edited = (await api({ type: 'GET_STATE' })).state.users.find(
      (user) => user.id === identity.id && user.site === site,
    );
    if (edited.note !== 'native page editor') {
      const currentDOM = await nodes();
      for (const node of currentDOM.filter((item) => attributes(item).class === 'error')) {
        const { object } = await cdp.send('DOM.resolveNode', {
          nodeId: node.nodeId,
          executionContextId: context,
        });
        const details = await cdp.send('Runtime.callFunctionOn', {
          objectId: object.objectId,
          functionDeclaration: 'function(){ return this.textContent; }',
          returnByValue: true,
        });
        console.log('Editor error:', details.result.value);
      }
    }
    assert.equal(edited.note, 'native page editor');
    assert.equal(edited.levelId, 'level-3');
    assert.ok(edited.createdAt && edited.updatedAt);
    dom = await nodes();
    assert.ok(!dom.some((node) => attributes(node).role === 'dialog'));
    await click(
      dom.find((node) => node.nodeName === 'BUTTON' && attributes(node).class === 'secondary'),
    );
    await wait(250);
    assert.equal(
      (await api({ type: 'GET_STATE' })).state.users.find(
        (user) => user.id === identity.id && user.site === site,
      ).note,
      'native API save',
    );
    console.log('NATIVE EDITOR PASS: mouse interaction, single grade, remarks and undo');
    const optionsURL = await evaluate('chrome.runtime.getURL("options.html")', context);
    await cdp.send('Page.navigate', { url: optionsURL });
    await wait(350);
    const optionsContext = await extensionContext();
    const call = async (message) => {
      const result = await evaluate(
        'FTagClient.call(' + JSON.stringify(message) + ')',
        optionsContext,
      );
      return result;
    };
    assert.equal(
      await evaluate('document.querySelectorAll("#levels form").length', optionsContext),
      3,
    );
    const before = (await call({ type: 'GET_STATUS' })).state;
    const old = legacyState();
    old.users.push({ ...identity, tagIds: ['level-1', 'level-3', 'custom'] });
    const backup = { format: 'f-tag', formatVersion: 1, appVersion: '0.2.0', state: old };
    const imported = await call({ type: 'IMPORT', expectedRevision: before.revision, backup });
    assert.equal(imported.state.users[0].levelId, 'level-3');
    assert.equal(imported.state.users[0].createdAt, null);
    assert.equal((await call({ type: 'GET_STATUS' })).recovery.reason, 'import');
    const restored = await call({
      type: 'RESTORE_SNAPSHOT',
      expectedRevision: imported.state.revision,
    });
    assert.equal(
      restored.state.users.find((user) => user.id === identity.id && user.site === site).note,
      'native API save',
    );
    assert.ok(restored.state.revision > imported.state.revision);
    await wait(200);
    const screenshot = await cdp.send('Page.captureScreenshot', { format: 'png' });
    const screenshotPath = join(tmpdir(), 'f-tag-settings-0.3.png');
    writeFileSync(screenshotPath, Buffer.from(screenshot.data, 'base64'));
    console.log(
      'NATIVE RECOVERY PASS: real extension options, legacy import and local snapshot restore',
    );
    console.log('Screenshot:', screenshotPath);
  }
} finally {
  cdp.close();
}
