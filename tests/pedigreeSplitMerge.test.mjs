// Splitting and merging pedigrees (serialized graphs, as saved by the editor)
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  listPeople, getPartners, selectPart, extractPart, splitPedigree, mergePedigrees, validate, getProbandId, countPeople
} from '../src/script/model/pedigreeSplitMerge.js';

/**
 * Tiny builder: people { key: props }, couples [[p1, p2, [children]]] -> serialized GG.
 * Returns { gg, id: key -> node id }.
 */
function build(people, couples) {
  const gg = [];
  const id = {};
  Object.keys(people).forEach((k) => {
    id[k] = gg.length;
    gg.push({ id: gg.length, prop: Object.assign({ gender: 'U' }, people[k]) });
  });
  couples.forEach(([p1, p2, kids]) => {
    const rel = gg.length;
    gg.push({ id: rel, rel: true, hub: true, prop: {}, outedges: [{ to: rel + 1 }] });
    gg.push({ id: rel + 1, chhub: true, prop: {}, outedges: kids.map((c) => ({ to: id[c] })) });
    [p1, p2].filter((p) => p !== null).forEach((p) => {
      const n = gg[id[p]];
      n.outedges = (n.outedges || []).concat([{ to: rel }]);
    });
  });
  return { gg, id };
}

const names = (gg) => listPeople(gg).map((p) => p.name).sort();

// Proband P (0) with parents F, M; F's parents GF, GM; P married to S whose parents are SF, SM;
// P and S have kids K1 and K2; K1 married to K1S with grandchild G.
function family() {
  return build({
    P: { fName: 'P', gender: 'F', hpoTerms: ['HP:0001250'] },
    F: { fName: 'F', gender: 'M' }, M: { fName: 'M', gender: 'F' },
    GF: { fName: 'GF', gender: 'M' }, GM: { fName: 'GM', gender: 'F' },
    S: { fName: 'S', gender: 'M' }, SF: { fName: 'SF', gender: 'M' }, SM: { fName: 'SM', gender: 'F' },
    K1: { fName: 'K1', gender: 'M', twinGroup: 0 }, K2: { fName: 'K2', gender: 'F', twinGroup: 0 },
    K1S: { fName: 'K1S', gender: 'F' }, G: { fName: 'G', gender: 'U' }
  }, [
    ['F', 'M', ['P']], ['GF', 'GM', ['F']], ['SF', 'SM', ['S']], ['P', 'S', ['K1', 'K2']], ['K1', 'K1S', ['G']]
  ]);
}

test('the test family is a valid pedigree', () => {
  const { gg } = family();
  assert.equal(validate(gg), true);
  assert.equal(countPeople(gg), 12);
  assert.equal(getProbandId(gg), 0);
});

test('family of origin: parents and ancestors, without partner and children', () => {
  const { gg, id } = family();
  const part = splitPedigree(gg, 'origin', id.P);
  assert.deepEqual(names(part), ['F', 'GF', 'GM', 'M', 'P']);
  assert.equal(listPeople(part).find((p) => p.isProband).name, 'P');
  assert.equal(validate(part), true);
  // clinical data travels with the person
  assert.deepEqual(part[0].prop.hpoTerms, ['HP:0001250']);
});

test('descendants: partners are kept alone, without their own families', () => {
  const { gg, id } = family();
  const part = splitPedigree(gg, 'descendants', id.P);
  assert.deepEqual(names(part), ['G', 'K1', 'K1S', 'K2', 'P', 'S']);
  const p0 = listPeople(part).find((p) => p.name === 'P');
  assert.equal(p0.hasParents, false);
  assert.equal(p0.isProband, true);
  // twins stay twins
  const k = part.filter((n) => n.prop && (n.prop.fName === 'K1' || n.prop.fName === 'K2'));
  assert.deepEqual(k.map((n) => n.prop.twinGroup), [0, 0]);
});

test('side of a couple: the partner and the children stay, the partner\'s family goes', () => {
  const { gg, id } = family();
  const mine = splitPedigree(gg, 'side', id.P, id.S);
  assert.deepEqual(names(mine), ['F', 'G', 'GF', 'GM', 'K1', 'K1S', 'K2', 'M', 'P', 'S']);
  const theirs = splitPedigree(gg, 'side', id.S, id.P);
  assert.deepEqual(names(theirs), ['G', 'K1', 'K1S', 'K2', 'P', 'S', 'SF', 'SM']);
  // the proband was kept in both parts, so stays proband in both
  assert.equal(listPeople(theirs).find((p) => p.isProband).name, 'P');
  assert.throws(() => splitPedigree(gg, 'side', id.P, id.F), /not a couple/);
});

test('when the proband is left out, the chosen person becomes node 0 / proband', () => {
  const { gg, id } = family();
  const part = splitPedigree(gg, 'origin', id.F);
  assert.deepEqual(names(part), ['F', 'GF', 'GM']);
  assert.equal(part[0].prop.fName, 'F');
  assert.ok(part.every((n) => !n.prop || n.prop.probandFlag === undefined));
});

test('a marked proband (not node 0) is moved to node 0 when kept', () => {
  const { gg, id } = family();
  gg[0].prop.probandFlag = false;
  gg[id.K1].prop.probandFlag = true;
  const part = splitPedigree(gg, 'descendants', id.P);
  assert.equal(part[0].prop.fName, 'K1');
  assert.equal(listPeople(part).find((p) => p.isProband).name, 'K1');
});

test('ids are renumbered and every edge points to a kept node', () => {
  const { gg, id } = family();
  const keep = selectPart(gg, 'origin', id.P);
  const part = extractPart(gg, keep, id.P);
  part.forEach((n, i) => {
    assert.equal(n.id, i);
    (n.outedges || []).forEach((e) => assert.ok(e.to >= 0 && e.to < part.length));
  });
});

test('getPartners lists the couples of a person', () => {
  const { gg, id } = family();
  assert.deepEqual(getPartners(gg, id.P).map((c) => c.partnerId), [id.S]);
  assert.deepEqual(getPartners(gg, id.K2), []);
});

// Maternal side drawn separately: the mother (again) with her parents and twin siblings
function maternalFamily() {
  return build({
    MM: { fName: 'M2', gender: 'F', comments: 'from the other file', probandFlag: true },
    MGF: { fName: 'MGF', gender: 'M' }, MGM: { fName: 'MGM', gender: 'F' },
    T1: { fName: 'T1', twinGroup: 0 }, T2: { fName: 'T2', twinGroup: 0 }
  }, [
    ['MGF', 'MGM', ['MM', 'T1', 'T2']]
  ]);
}

test('merge as the same person: data are combined and the current proband stays', () => {
  // current: proband with partner and children; incoming: an aunt line drawn around the mother
  const cur = build({ P: { fName: 'P', gender: 'F' }, S: { fName: 'S', gender: 'M' }, K: { fName: 'K' } },
    [['P', 'S', ['K']]]);
  const other = build({ M: { fName: 'M', gender: 'F', lName: 'Silva' }, A: { fName: 'A' }, GF: { fName: 'GF', gender: 'M' }, GM: { fName: 'GM', gender: 'F' }, P2: { fName: 'P', gender: 'F', comments: 'hearing loss', probandFlag: true } },
    [['GF', 'GM', ['M', 'A']], ['M', null, ['P2']]]);
  const { gg } = mergePedigrees(cur.gg, other.gg, { type: 'same', baseId: cur.id.P, incomingId: other.id.P2 });
  assert.equal(validate(gg), true);
  assert.deepEqual(names(gg), ['A', 'GF', 'GM', 'K', 'M Silva', 'P', 'S']);
  assert.equal(gg[0].prop.comments, 'hearing loss');      // filled in from the other file
  assert.equal(listPeople(gg).find((p) => p.isProband).name, 'P');
  assert.equal(listPeople(gg).filter((p) => p.isProband).length, 1);
  assert.equal(listPeople(gg).find((p) => p.name === 'P').hasParents, true);
});

test('merge as the same person keeps current data and refuses two sets of parents', () => {
  const pat = family();
  const mat = maternalFamily();
  // in the current pedigree the mother has no parents drawn: fusing works
  const { gg, incomingMap } = mergePedigrees(pat.gg, mat.gg, { type: 'same', baseId: pat.id.M, incomingId: mat.id.MM });
  assert.equal(validate(gg), true);
  assert.equal(incomingMap[mat.id.MM], pat.id.M);
  assert.equal(gg[pat.id.M].prop.comments, 'from the other file');
  assert.equal(gg[pat.id.M].prop.fName, 'M');
  assert.equal(listPeople(gg).find((p) => p.isProband).name, 'P');
  assert.equal(countPeople(gg), 12 + 4);
  // existing ids are untouched
  for (let v = 0; v < pat.gg.length; v++) assert.equal(gg[v].prop.fName, pat.gg[v].prop.fName);
  // twins of the other file keep their (per-sibship) twin group
  const twins = gg.filter((n) => n.prop && /^T[12]$/.test(n.prop.fName));
  assert.deepEqual(twins.map((n) => n.prop.twinGroup), [0, 0]);
  // P has parents in the current pedigree, M2 in the other one: refused
  assert.throws(() => mergePedigrees(pat.gg, mat.gg, { type: 'same', baseId: pat.id.P, incomingId: mat.id.MM }),
    /Both copies of this person have parents/);
});

test('merge as the same person refuses different sexes', () => {
  const pat = family();
  const mat = maternalFamily();
  assert.throws(() => mergePedigrees(pat.gg, mat.gg, { type: 'same', baseId: pat.id.S, incomingId: mat.id.MM }), /different sexes/);
});

test('merge as partners: a couple with a placeholder child links the two families', () => {
  const a = build({ H: { fName: 'H', gender: 'M' }, HF: { fName: 'HF', gender: 'M' }, HM: { fName: 'HM', gender: 'F' } }, [['HF', 'HM', ['H']]]);
  const b = build({ W: { fName: 'W', gender: 'F', probandFlag: true }, WF: { fName: 'WF', gender: 'M' }, WM: { fName: 'WM', gender: 'F' } }, [['WF', 'WM', ['W']]]);
  const { gg, incomingMap } = mergePedigrees(a.gg, b.gg, { type: 'partners', baseId: a.id.H, incomingId: b.id.W });
  assert.equal(validate(gg), true);
  assert.deepEqual(names(gg), ['H', 'HF', 'HM', 'W', 'WF', 'WM']);
  assert.deepEqual(getPartners(gg, a.id.H).map((c) => c.partnerId), [incomingMap[b.id.W]]);
  assert.equal(listPeople(gg).find((p) => p.isProband).name, 'H');
  assert.equal(countPeople(gg), 6);   // the placeholder child is not a person
  // and splitting the couple gives each family back
  const back = splitPedigree(gg, 'side', incomingMap[b.id.W], a.id.H);
  assert.deepEqual(names(back), ['H', 'W', 'WF', 'WM']);
});

test('split then merge restores the whole family', () => {
  const { gg, id } = family();
  const up = splitPedigree(gg, 'origin', id.P);
  const down = splitPedigree(gg, 'descendants', id.P);
  const { gg: whole } = mergePedigrees(up, down, { type: 'same', baseId: 0, incomingId: 0 });
  assert.deepEqual(names(whole), ['F', 'G', 'GF', 'GM', 'K1', 'K1S', 'K2', 'M', 'P']
    .concat(['S']).sort());
  assert.equal(countPeople(whole), countPeople(gg) - 2);   // S's parents were not in either part
});

test('validate catches broken data', () => {
  const { gg } = family();
  const broken = JSON.parse(JSON.stringify(gg));
  broken.push({ id: broken.length, prop: { gender: 'M' } });   // disconnected person
  assert.throws(() => validate(broken), /disconnected/);
});

test('the result loads into the editor graph (BaseGraph)', async () => {
  let PedigreeImport;
  try {
    PedigreeImport = (await import('../src/script/model/import.js')).default;
  } catch (e) {
    return;   // browser-only dependencies: structural validate() above covers the same rules
  }
  const pat = family();
  const mat = maternalFamily();
  const { gg } = mergePedigrees(pat.gg, mat.gg, { type: 'same', baseId: pat.id.M, incomingId: mat.id.MM });
  const G = PedigreeImport.initFromPhenotipsInternal(gg);
  G.validate();
  const part = splitPedigree(gg, 'side', pat.id.S, pat.id.P);
  PedigreeImport.initFromPhenotipsInternal(part).validate();
  // and round-trips through serialize()
  assert.equal(G.serialize().length, gg.length);
});
