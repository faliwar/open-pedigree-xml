import test from 'node:test';
import assert from 'node:assert/strict';
import { sexOf, sexOfProperties, canShareSex, sharedSex, sexAtBirthFor } from '../src/script/model/twinSex.js';

test('sex comes from the sex at birth when recorded, else from the symbol', () => {
  assert.equal(sexOf('M', ''), 'M');
  assert.equal(sexOf('F', 'AMAB'), 'M');   // trans woman
  assert.equal(sexOf('U', 'AFAB'), 'F');   // non-binary person assigned female
  assert.equal(sexOf('M', 'UAAB'), 'U');
  assert.equal(sexOf('U', ''), 'U');
  assert.equal(sexOfProperties({ gender: 'F', sexAtBirth: 'AMAB' }), 'M');
  assert.equal(sexOfProperties(undefined), 'U');
});

test('monozygotic twins may differ in gender identity but not in sex', () => {
  // a man and a trans woman (circle, AMAB): same sex
  assert.equal(canShareSex([sexOf('M', ''), sexOf('F', 'AMAB')]), true);
  // a man and a woman, nothing else recorded: different sexes
  assert.equal(canShareSex([sexOf('M', ''), sexOf('F', '')]), false);
  // unknown or unassigned sex does not conflict
  assert.equal(canShareSex(['M', 'U', 'M']), true);
  assert.equal(canShareSex(['U', 'U']), true);
});

test('shared sex and its sex-at-birth annotation', () => {
  assert.equal(sharedSex(['U', 'F', 'F']), 'F');
  assert.equal(sharedSex(['U']), null);
  assert.equal(sexAtBirthFor('M'), 'AMAB');
  assert.equal(sexAtBirthFor('F'), 'AFAB');
  assert.equal(sexAtBirthFor('U'), '');
});
