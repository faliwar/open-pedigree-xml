// Sibships whose parents are not all drawn: the children are still full siblings.
import test from 'node:test';
import assert from 'node:assert/strict';
import { makeGraph, P, carrier, close } from './helpers.mjs';
import { findBloodRelatives, withMissingParents } from '../src/script/model/kinship.js';
import { computeVariantRisks } from '../src/script/model/inheritance.js';

// 1 = father (drawn), no mother drawn; 2, 3 = his children in one sibship; 4 = child of 2
const single = makeGraph({ 1: P('M'), 2: P('F', 1), 3: P('M', 1), 5: P('M'), 4: P('F', 5, 2) });

test('children of a single drawn parent are full siblings', () => {
  const rel = findBloodRelatives(single, 2, 3);
  const sib = rel.find((k) => k.id === 3);
  assert.equal(sib.degree, 1);
  assert.equal(sib.full, true);
  close(assert, sib.r, 0.5, 1e-12, 'r of the siblings:');
  // the parent who is not drawn is not listed
  assert.deepEqual(rel.map((k) => k.id).sort(), [1, 3, 4]);
});

test('a variant from the parent who is not drawn reaches the siblings', () => {
  const res = computeVariantRisks(single, 2, 'AD', 'het', 0.005, { deNovo: 0 });
  close(assert, carrier(res, 3), 0.5, 1e-12, 'sibling:');
  close(assert, carrier(res, 1), 0.5, 1e-12, 'drawn father:');
  close(assert, carrier(res, 4), 0.5, 1e-12, 'child:');
});

test('X-linked: the missing parent of a single father is the mother', () => {
  // a son cannot inherit an X-linked variant from his father: it came from the mother, not drawn
  const res = computeVariantRisks(single, 3, 'XLR', 'het', 0.005, { deNovo: 0 });
  close(assert, carrier(res, 1), 0, 1e-12, 'father:');
  close(assert, carrier(res, 2), 0.5, 1e-12, 'sister:');
});

test('one child, or both parents drawn: nothing is added', () => {
  const g = makeGraph({ 1: P('M'), 2: P('F'), 3: P('M', 1, 2), 4: P('F', 1, 2), 5: P('M', 1) });
  assert.equal(withMissingParents(g), g);
});
