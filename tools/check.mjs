import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { resolve, extname } from 'node:path';
import { spawnSync } from 'node:child_process';
const root = fileURLToPath(new URL('../', import.meta.url));
function files(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) =>
    entry.isDirectory() ? files(resolve(directory, entry.name)) : [resolve(directory, entry.name)],
  );
}
const manifest = JSON.parse(readFileSync(resolve(root, 'extension/manifest.json'), 'utf8'));
assert.equal(
  manifest.version,
  JSON.parse(readFileSync(resolve(root, 'package.json'), 'utf8')).version,
);
assert.equal(manifest.manifest_version, 3);
assert.deepEqual(manifest.permissions, ['storage', 'activeTab']);
assert.match(manifest.content_security_policy.extension_pages, /connect-src 'none'/);
const scripts = [
  ...files(resolve(root, 'extension')),
  ...files(resolve(root, 'tests')),
  ...files(resolve(root, 'tools')),
].filter((path) => ['.js', '.mjs'].includes(extname(path)));
for (const path of scripts) {
  const result = spawnSync(process.execPath, ['--check', path], { encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr);
}
for (const path of manifest.content_scripts[0].js) readFileSync(resolve(root, 'extension', path));
for (const size of [16, 32, 48, 128]) {
  const png = readFileSync(resolve(root, 'extension/icons', size + '.png'));
  assert.equal(png.subarray(0, 8).toString('hex'), '89504e470d0a1a0a');
  assert.equal(png.readUInt32BE(16), size);
  assert.equal(png.readUInt32BE(20), size);
}
for (const path of files(resolve(root, 'extension')).filter((path) => extname(path) === '.html')) {
  const html = readFileSync(path, 'utf8');
  for (const match of html.matchAll(/(?:src|href)="([^"]+\.(?:js|css|png))"/g))
    readFileSync(resolve(root, 'extension', match[1]));
}
console.log(`Checked ${scripts.length} JavaScript files, manifest references and four icon sizes`);
