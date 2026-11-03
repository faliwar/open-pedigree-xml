import test from 'node:test';
import assert from 'node:assert/strict';
import { parsePenetranceCurve, curveValue, curveFraction } from '../src/script/model/penetrance.js';

test('parses and sorts age:% points', () => {
  assert.deepEqual(parsePenetranceCurve('50:25 30:3, 40:10; 70:55%'), [[30, 3], [40, 10], [50, 25], [70, 55]]);
  assert.deepEqual(parsePenetranceCurve('40=10 60=30,5'), [[40, 10], [60, 30.5]]);
  assert.equal(parsePenetranceCurve(''), null);
  assert.equal(parsePenetranceCurve('nonsense'), null);
  assert.equal(parsePenetranceCurve('30:0'), null);
});

test('keeps the curve non-decreasing', () => {
  assert.deepEqual(parsePenetranceCurve('30:20 40:10'), [[30, 20], [40, 20]]);
});

test('interpolates linearly from 0 at birth and is flat after the last point', () => {
  const c = parsePenetranceCurve('40:10 60:30');
  assert.equal(curveValue(c, 0), 0);
  assert.equal(curveValue(c, 20), 5);
  assert.equal(curveValue(c, 40), 10);
  assert.equal(curveValue(c, 50), 20);
  assert.equal(curveValue(c, 90), 30);
  assert.equal(curveFraction(c, 50), 20 / 30);
  assert.equal(curveFraction(c, 90), 1);
});
