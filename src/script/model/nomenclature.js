import { romanize } from 'pedigree/model/helpers';

/**
 * Standard pedigree nomenclature: generations numbered with Roman numerals (I, II, III...)
 * from top to bottom, and individuals numbered 1, 2, 3... from left to right within each
 * generation, giving identifiers such as "II-3".
 *
 * Shared by the on-canvas overlay, the cascade testing list and the PDF export so that
 * every place shows the same identifier for the same person.
 */

var TIER_TOLERANCE = 50; // persons whose Y differs by less than this belong to the same generation

/**
 * Returns the real (non-placeholder, non-virtual) person nodes currently drawn.
 */
var getNumberablePersons = function(ed) {
  var result = [];
  if (!ed || !ed.getGraph || !ed.getNode) {
    return result;
  }
  var graph = ed.getGraph();
  var maxId = graph.getMaxNodeId ? graph.getMaxNodeId() : -1;
  for (var id = 0; id <= maxId; id++) {
    try {
      if (!graph.isPerson(id) || graph.isPlaceholder(id) || graph.isVirtualDummyChild(id) || graph.isVirtualParent(id)) {
        continue;
      }
    } catch (e) {
      continue;
    }
    var node = ed.getNode(id);
    if (!node || (node.isVirtual && node.isVirtual())) {
      continue;
    }
    result.push({ id: id, x: node.getX(), y: node.getY() });
  }
  return result;
};

/**
 * Computes the standard numbering for the current pedigree.
 *
 * @return {Object} {
 *   byId: { nodeId: { generation: 2, index: 3, label: 'II-3' } },
 *   tiers: [ { roman: 'I', y: 120, minX: -300, persons: [{id, x, y}, ...] }, ... ]
 * }
 */
var computeStandardNumbering = function(ed) {
  var persons = getNumberablePersons(ed || (typeof editor !== 'undefined' ? editor : null));
  var tiers = [];

  persons.sort(function(a, b) { return a.y - b.y; });
  persons.forEach(function(p) {
    var tier = null;
    for (var t = 0; t < tiers.length; t++) {
      if (Math.abs(tiers[t].y - p.y) < TIER_TOLERANCE) {
        tier = tiers[t];
        break;
      }
    }
    if (!tier) {
      tier = { y: p.y, persons: [] };
      tiers.push(tier);
    }
    tier.persons.push(p);
    tier.y = tier.persons.reduce(function(sum, q) { return sum + q.y; }, 0) / tier.persons.length;
  });

  tiers.sort(function(a, b) { return a.y - b.y; });

  var byId = {};
  tiers.forEach(function(tier, g) {
    tier.roman = romanize(g + 1);
    tier.persons.sort(function(a, b) { return a.x - b.x; });
    tier.minX = tier.persons.length ? tier.persons[0].x : 0;
    tier.persons.forEach(function(p, i) {
      byId[p.id] = { generation: g + 1, index: i + 1, label: tier.roman + '-' + (i + 1) };
    });
  });

  return { byId: byId, tiers: tiers };
};

/**
 * Convenience: returns the "II-3" style identifier of a node, or '' when not numbered.
 */
var getStandardLabel = function(nodeId, numbering) {
  numbering = numbering || computeStandardNumbering();
  return (numbering.byId[nodeId] && numbering.byId[nodeId].label) || '';
};

export { computeStandardNumbering, getStandardLabel };
