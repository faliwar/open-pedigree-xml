// Layout tests for gamete donors and single-parent relationships.
import test from 'node:test';
import assert from 'node:assert/strict';

globalThis.Class = {
  create(methods) {
    const fn = function() {
      if (this.initialize) {
        this.initialize.apply(this, arguments);
      }
    };
    fn.prototype = methods;
    return fn;
  }
};

const { default: PedigreeImport } = await import('../src/script/model/import.js');
const { default: PositionedGraph } = await import('../src/script/model/positionedGraph.js');
const { default: DynamicPositionedGraph } = await import('../src/script/model/dynamicGraph.js');

function makeDG(nodes) {
  const baseG = PedigreeImport.initFromPhenotipsInternal(nodes);
  return new DynamicPositionedGraph(new PositionedGraph(baseG));
}

function addMaleDonor(dg, motherId, childId) {
  const newRelInfo = dg.addNewRelationship(motherId, {}, false, 1, []);
  const relId = newRelInfo['new'][0];
  const donorId = newRelInfo['new'][1];
  dg.setProperties(donorId, { gender: 'M', artRole: 'donor' });
  dg.setProperties(relId, Object.assign({}, dg.getProperties(relId), { artLink: true }));
  dg.setProperties(childId, Object.assign({}, dg.getProperties(childId), { artLinks: [donorId] }));
  return donorId;
}

test('infertile couple with single-parent child on mother and male sperm donor keeps child under mother and donor on right', () => {
  const dg = makeDG([{ name: 'p0', gender: 'M' }]);
  dg.addNewParents(0);
  const parentRel = dg.getParentRelationship(0);
  const rightBro = dg.addNewChild(parentRel, { gender: 'M' }, 1)['new'][0];

  // Couple: rightBro (M, left) + fem5 (F, right), infertile
  const relInfo = dg.addNewRelationship(rightBro, { gender: 'F' }, false, 1);
  const relId = relInfo['new'][0];
  const fem5 = relInfo['new'][1];
  dg.setProperties(relId, { childlessStatus: 'infertile' });

  // Single-parent child of fem5 + male donor
  const childRes = dg.addNewChildWithoutPartner(fem5, { gender: 'F' }, 1);
  const realChild = childRes['new'][1];
  const donorId = addMaleDonor(dg, fem5, realChild);

  assert.equal(dg.getPosition(realChild).x, dg.getPosition(fem5).x, 'child stays directly below mother');
  assert.ok(dg.getPosition(donorId).x > dg.getPosition(fem5).x, 'male donor is placed to the right of mother');

  // Also verify after full relayout
  const baseG = dg.DG.GG.makeGWithCollapsedMultiRankEdges();
  dg._recreateUsingBaseGraph(baseG);
  assert.equal(dg.getPosition(realChild).x, dg.getPosition(fem5).x, 'after relayout: child stays directly below mother');
  assert.ok(dg.getPosition(donorId).x > dg.getPosition(fem5).x, 'after relayout: male donor stays to the right of mother');
});

test('single mother with child and male donor keeps male donor on the right (both interactive and after relayout)', () => {
  const dg = makeDG([{ name: 'm0', gender: 'F' }]);
  const childRes = dg.addNewChildWithoutPartner(0, { gender: 'F' }, 1);
  const realChild = childRes['new'][1];
  const donorId = addMaleDonor(dg, 0, realChild);

  assert.equal(dg.getPosition(realChild).x, dg.getPosition(0).x, 'interactive: child directly below mother');
  assert.ok(dg.getPosition(donorId).x > dg.getPosition(0).x, 'interactive: male donor to the right of mother');

  const baseG = dg.DG.GG.makeGWithCollapsedMultiRankEdges();
  dg._recreateUsingBaseGraph(baseG);
  assert.equal(dg.getPosition(realChild).x, dg.getPosition(0).x, 'after relayout: child directly below mother');
  assert.ok(dg.getPosition(donorId).x > dg.getPosition(0).x, 'after relayout: male donor to the right of mother');
});

test('mother with parents and artLink created before single-parent relationship keeps male donor on the right after relayout', () => {
  const dg = makeDG([{ name: 'm0', gender: 'F' }]);
  dg.addNewParents(0);
  const newRelInfo = dg.addNewRelationship(0, {}, false, 1, []);
  const relId = newRelInfo['new'][0];
  const donorId = newRelInfo['new'][1];
  dg.setProperties(donorId, { gender: 'M', artRole: 'donor' });
  dg.setProperties(relId, Object.assign({}, dg.getProperties(relId), { artLink: true }));
  const childRes = dg.addNewChildWithoutPartner(0, { gender: 'F', artLinks: [donorId] }, 1);
  const realChild = childRes['new'][1];

  const baseG = dg.DG.GG.makeGWithCollapsedMultiRankEdges();
  dg._recreateUsingBaseGraph(baseG);
  assert.equal(dg.getPosition(realChild).x, dg.getPosition(0).x, 'child directly below mother');
  assert.ok(dg.getPosition(donorId).x > dg.getPosition(0).x, 'male donor to the right of mother');
});
