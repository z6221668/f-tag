import assert from 'node:assert/strict';
import { performance } from 'node:perf_hooks';
import '../extension/core.js';
const Core = UserTagsCore;
const state = Core.fresh();
state.users = Array.from({ length: 10000 }, (_, id) => ({
  site: 'forum.example.com',
  id: 'member/' + id,
  name: 'User ' + id,
  levelId: 'level-1',
  tagIds: [],
  note: '',
  sourceUrl: '',
  createdAt: null,
  updatedAt: null,
}));
let start = performance.now();
const valid = Core.validate(state);
const validation = performance.now() - start;
start = performance.now();
const index = Core.index(valid);
const build = performance.now() - start;
start = performance.now();
for (let i = 0; i < 100000; i++)
  assert.ok(index.users.get(Core.userKey('forum.example.com', 'member/' + (i % 10000))));
const lookup = performance.now() - start;
start = performance.now();
const changed = Core.reduce(valid, {
  type: 'SET_USER',
  user: { ...valid.users[0], note: 'Updated' },
});
const mutation = performance.now() - start;
assert.equal(changed.users.length, 10000);
assert.equal(changed.users.at(-1).note, 'Updated');
console.log(
  JSON.stringify(
    {
      records: 10000,
      validationMs: +validation.toFixed(2),
      indexMs: +build.toFixed(2),
      lookups: 100000,
      lookupMs: +lookup.toFixed(2),
      mutationMs: +mutation.toFixed(2),
    },
    null,
    2,
  ),
);
