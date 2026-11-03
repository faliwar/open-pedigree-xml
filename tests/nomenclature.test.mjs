import test from 'node:test';
import assert from 'node:assert/strict';
import { computeStandardNumbering } from '../src/script/model/nomenclature.js';

// minimal editor: persons with drawing positions and graph generations
function makeEditor(persons) {
  const ids = Object.keys(persons).map(Number);
  return {
    getGraph: () => ({
      getMaxNodeId: () => Math.max(...ids),
      isPerson: (id) => Object.prototype.hasOwnProperty.call(persons, id),
      isPlaceholder: () => false,
      isVirtualDummyChild: () => false,
      isVirtualParent: () => false,
      getGeneration: (id) => persons[id].gen
    }),
    getNode: (id) => (persons[id] ? { getX: () => persons[id].x, getY: () => persons[id].y } : null)
  };
}

test('generations follow the graph rank, not the drawing height', () => {
  // person 3 is drawn 80 px lower than its generation, beyond the old 50 px tolerance
  const ed = makeEditor({
    1: { gen: 1, x: 0, y: 100 }, 2: { gen: 1, x: 100, y: 100 },
    3: { gen: 2, x: -50, y: 330 }, 4: { gen: 2, x: 50, y: 250 }, 5: { gen: 3, x: 0, y: 400 }
  });
  const n = computeStandardNumbering(ed);
  assert.equal(n.byId[3].label, 'II-1');
  assert.equal(n.byId[4].label, 'II-2');
  assert.equal(n.byId[5].label, 'III-1');
  assert.equal(n.tiers.length, 3);
});

test('falls back to drawing height when the rank is unavailable', () => {
  const ed = makeEditor({
    1: { gen: undefined, x: 0, y: 100 }, 2: { gen: undefined, x: 100, y: 120 }, 3: { gen: undefined, x: 0, y: 250 }
  });
  const n = computeStandardNumbering(ed);
  assert.equal(n.byId[2].label, 'I-2');
  assert.equal(n.byId[3].label, 'II-1');
});
