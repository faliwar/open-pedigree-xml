// Kinship, inbreeding and relationship coefficients against analytical values.
import test from 'node:test';
import assert from 'node:assert/strict';
import { makeGraph, P, close } from './helpers.mjs';
import { makeInbreeding, describeKinship } from '../src/script/model/kinship.js';

const A = makeGraph({
  1: P('M'), 2: P('F'), 3: P('M', 1, 2), 4: P('F', 1, 2), 5: P('F'), 6: P('M'),
  7: P('M', 3, 5), 8: P('F', 6, 4), 9: P('M', 1, 10), 10: P('F'), 11: P('M', 7, 12), 12: P('F'),
  13: P('F', 14, 8), 14: P('M'), 15: P('F', 7, 8), 16: P('M', 3, 8), 17: P('F', 3, 4), 18: P('M', 1, 4)
});

const relationships = [
  ['full siblings', 3, 4, 1 / 4, 1], ['parent and offspring', 1, 3, 1 / 4, 1], ['half siblings', 3, 9, 1 / 8, 2],
  ['grandparent and grandchild', 1, 7, 1 / 8, 2], ['uncle and niece', 3, 8, 1 / 8, 2], ['first cousins', 7, 8, 1 / 16, 3],
  ['first cousins once removed', 11, 8, 1 / 32, 4], ['second cousins', 11, 13, 1 / 64, 5]
];

test('kinship coefficient, relationship coefficient and degree in an outbred pedigree', () => {
  const k = makeInbreeding(A);
  relationships.forEach(([name, a, b, phi, degree]) => {
    close(assert, k.kinship(a, b), phi, 1e-15, `phi ${name}:`);
    const d = describeKinship(A, a, b, {});
    close(assert, d.r, 2 * phi, 1e-15, `r ${name}:`);
    assert.equal(d.degree, degree, `degree ${name}`);
  });
});

test('inbreeding coefficient of children of related couples', () => {
  const k = makeInbreeding(A);
  close(assert, k.inbreeding(15), 1 / 16, 1e-15, 'first cousins:');
  close(assert, k.inbreeding(16), 1 / 8, 1e-15, 'uncle and niece:');
  close(assert, k.inbreeding(17), 1 / 4, 1e-15, 'full siblings:');
  close(assert, k.inbreeding(18), 1 / 4, 1e-15, 'parent and offspring:');
});

test('double first cousins', () => {
  const B = makeGraph({
    1: P('M'), 2: P('F'), 20: P('M'), 21: P('F'),
    3: P('M', 1, 2), 4: P('M', 1, 2), 5: P('F', 20, 21), 6: P('F', 20, 21),
    7: P('M', 3, 5), 8: P('F', 4, 6), 9: P('F', 7, 8)
  });
  const k = makeInbreeding(B);
  close(assert, k.kinship(7, 8), 1 / 8, 1e-15);
  close(assert, describeKinship(B, 7, 8, {}).r, 1 / 4, 1e-15);
  close(assert, k.inbreeding(9), 1 / 8, 1e-15);
});

// repeated full-sib mating: F_t = (1 + 2 F_{t-1} + F_{t-2}) / 4
const C = makeGraph({
  1: P('M'), 2: P('F'), 3: P('M', 1, 2), 4: P('F', 1, 2), 5: P('M', 3, 4), 6: P('F', 3, 4),
  7: P('M', 5, 6), 8: P('F', 5, 6), 9: P('M', 7, 8), 10: P('F', 7, 8), 11: P('F', 9, 10)
});

test('inbred ancestors: repeated full-sibling mating', () => {
  const k = makeInbreeding(C);
  [[5, 1 / 4], [7, 3 / 8], [9, 1 / 2], [11, 19 / 32]].forEach(([id, F]) => close(assert, k.inbreeding(id), F, 1e-15, `F of ${id}:`));
});

test("relationship coefficient follows Wright's formula when common ancestors are inbred", () => {
  const k = makeInbreeding(C);
  const expected = 2 * k.kinship(9, 10) / Math.sqrt((1 + k.inbreeding(9)) * (1 + k.inbreeding(10)));
  close(assert, describeKinship(C, 9, 10, {}).r, expected, 1e-12);
});

test('monozygotic twins share their genotype', () => {
  const T = makeGraph({
    1: P('M'), 2: P('F'),
    3: P('F', 1, 2, { twinGroup: 0, monozygotic: true }), 4: P('F', 1, 2, { twinGroup: 0, monozygotic: true }),
    5: P('M'), 6: P('M'), 7: P('F', 5, 3), 8: P('M', 6, 4), 9: P('M', 1, 2)
  });
  const k = makeInbreeding(T);
  close(assert, k.kinship(3, 4), 1 / 2, 1e-15, 'MZ twins:');
  close(assert, k.kinship(4, 7), 1 / 4, 1e-15, 'twin and co-twin child:');
  close(assert, k.kinship(7, 8), 1 / 8, 1e-15, 'children of MZ twins:');
  close(assert, k.kinship(3, 9), 1 / 4, 1e-15, 'twin and ordinary sibling:');
  close(assert, describeKinship(T, 3, 4, {}).r, 1, 1e-15, 'r of MZ twins:');
});
