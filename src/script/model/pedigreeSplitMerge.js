/**
 * Splitting and merging pedigrees ("dividir e unir heredogramas").
 *
 * Works on the serialized graph produced by BaseGraph.serialize() of a graph WITHOUT virtual
 * nodes (makeGWithCollapsedMultiRankEdges()): an array of
 *   { id, prop, outedges: [{to, weight}], rel/hub (relationship), chhub (childhub) }
 * where id == array index. The result has the same shape and can be loaded with
 * PedigreeImport.initFromPhenotipsInternal() and laid out from scratch.
 *
 * The editor needs one connected pedigree, so:
 *  - merging links the two pedigrees through a person present in both ("same person")
 *    or by making a couple of one person from each pedigree;
 *  - splitting keeps one part of the pedigree around a chosen person: the family of origin,
 *    the descendants, or one side of a couple.
 */

function isRel(n) { return !!(n && (n.rel || n.relationship)); }
function isChhub(n) { return !!(n && n.chhub); }
function isVirt(n) { return !!(n && (n.virt || n.virtual)); }
function isPersonNode(n) { return !!n && !isRel(n) && !isChhub(n) && !isVirt(n); }

function clone(x) { return JSON.parse(JSON.stringify(x)); }

function outOf(n) {
  return (n.outedges || []).map(function(e) { return e.to; });
}

/** in-edge lists for every node */
function inEdges(gg) {
  var ins = gg.map(function() { return []; });
  for (var v = 0; v < gg.length; v++) {
    var out = outOf(gg[v]);
    for (var i = 0; i < out.length; i++) {
      ins[out[i]].push(v);
    }
  }
  return ins;
}

function checkInput(gg) {
  if (!Array.isArray(gg) || gg.length == 0) {
    throw 'Empty pedigree';
  }
  for (var v = 0; v < gg.length; v++) {
    if (gg[v].id !== v) {
      throw 'Invalid pedigree data (node ids must match their position)';
    }
    if (isVirt(gg[v])) {
      throw 'Invalid pedigree data (virtual nodes must be collapsed first)';
    }
  }
}

function isPlaceholderProps(p) {
  return !!(p && (p.isPlaceholder || p.isVirtualDummyChild));
}

/** id of the proband: the person marked as proband, otherwise node 0 */
export function getProbandId(gg) {
  for (var v = 0; v < gg.length; v++) {
    if (isPersonNode(gg[v]) && gg[v].prop && gg[v].prop.probandFlag === true) {
      return v;
    }
  }
  return 0;
}

/**
 * Real people of a pedigree (no placeholder children), for pickers.
 * @return [{id, name, gender, birthYear, externalID, isProband, hasParents}]
 */
export function listPeople(gg) {
  var ins = inEdges(gg);
  var proband = getProbandId(gg);
  var result = [];
  for (var v = 0; v < gg.length; v++) {
    if (!isPersonNode(gg[v])) {
      continue;
    }
    var p = gg[v].prop || {};
    if (isPlaceholderProps(p)) {
      continue;
    }
    var name = ((p.fName || '') + ' ' + (p.lName || '')).trim() || (p.name || '').trim();
    var year = '';
    var dob = p.dob;
    if (dob) {
      var m = String(typeof dob === 'object' ? (dob.year || dob.decade || '') : dob).match(/\d{4}/);
      year = m ? m[0] : '';
    }
    result.push({
      id: v,
      name: name,
      gender: p.gender || 'U',
      birthYear: year,
      externalID: p.externalID || p.externalId || '',
      isProband: v === proband,
      hasParents: ins[v].length > 0
    });
  }
  return result;
}

/** couples a person belongs to: [{relId, partnerId (null for a single parent)}] */
export function getPartners(gg, personId) {
  var ins = inEdges(gg);
  var result = [];
  var rels = outOf(gg[personId]);
  for (var i = 0; i < rels.length; i++) {
    var r = rels[i];
    if (!isRel(gg[r])) continue;
    var partner = null;
    for (var j = 0; j < ins[r].length; j++) {
      if (ins[r][j] !== personId) partner = ins[r][j];
    }
    result.push({ relId: r, partnerId: partner });
  }
  return result;
}

/**
 * Collects all nodes connected to the seeds; nodes in "blocked" are kept but not expanded
 * (only the edges to other kept nodes are preserved).
 */
function collect(gg, ins, seeds, blocked) {
  var keep = {};
  var queue = [];
  seeds.forEach(function(s) { if (!keep[s]) { keep[s] = true; queue.push(s); } });
  while (queue.length) {
    var v = queue.shift();
    if (blocked[v]) continue;
    var nb = outOf(gg[v]).concat(ins[v]);
    for (var i = 0; i < nb.length; i++) {
      if (!keep[nb[i]]) {
        keep[nb[i]] = true;
        queue.push(nb[i]);
      }
    }
  }
  return keep;
}

/**
 * Which nodes form the chosen part of the pedigree.
 *
 * @param mode 'origin'      the person with parents, siblings and the rest of the family
 *                           above, without the person's partners and children;
 *             'descendants' the person with partners, children and further descendants
 *                           (partners are kept without their own families);
 *             'side'        the person's side of the couple with partnerId: the partner and
 *                           the couple's children stay, the partner's own family does not.
 * @return {Object} set of kept node ids (id -> true)
 */
export function selectPart(gg, mode, personId, partnerId) {
  checkInput(gg);
  if (!isPersonNode(gg[personId])) {
    throw 'Choose a person';
  }
  var ins = inEdges(gg);
  var blocked = {};

  if (mode === 'origin') {
    // the person stays, but not the families started by the person
    blocked[personId] = true;
    var seeds = [personId].concat(ins[personId]);
    var keep = collect(gg, ins, seeds, blocked);
    // the person's own couples only come back if reached another way (consanguinity)
    return keep;
  }

  if (mode === 'descendants') {
    // descendants: the person and everyone below
    var desc = {};
    desc[personId] = true;
    var stack = [personId];
    while (stack.length) {
      var p = stack.pop();
      var rels = outOf(gg[p]);
      for (var i = 0; i < rels.length; i++) {
        var hub = outOf(gg[rels[i]])[0];
        var kids = hub !== undefined ? outOf(gg[hub]) : [];
        for (var k = 0; k < kids.length; k++) {
          if (!desc[kids[k]]) {
            desc[kids[k]] = true;
            stack.push(kids[k]);
          }
        }
      }
    }
    var keepD = {};
    Object.keys(desc).forEach(function(d) {
      d = parseInt(d, 10);
      keepD[d] = true;
      var rels = outOf(gg[d]);
      for (var i = 0; i < rels.length; i++) {
        var r = rels[i];
        keepD[r] = true;
        ins[r].forEach(function(partner) { keepD[partner] = true; });   // partners: kept alone
        var hub = outOf(gg[r])[0];
        if (hub !== undefined) {
          keepD[hub] = true;
          outOf(gg[hub]).forEach(function(c) { keepD[c] = true; });
        }
      }
    });
    return keepD;
  }

  if (mode === 'side') {
    var couple = getPartners(gg, personId).filter(function(c) { return c.partnerId === partnerId; });
    if (!couple.length || partnerId === null || partnerId === undefined) {
      throw 'These two people are not a couple';
    }
    blocked[partnerId] = true;
    return collect(gg, ins, [personId], blocked);
  }

  throw 'Unknown split mode: ' + mode;
}

/**
 * Builds a stand-alone pedigree from a set of node ids (only edges between kept nodes stay).
 * The proband stays the proband when kept; otherwise firstId (the chosen person) becomes it.
 * Node ids are renumbered from 0 with the proband first.
 */
export function extractPart(gg, keep, firstId) {
  checkInput(gg);
  var proband = getProbandId(gg);
  var first = keep[proband] ? proband : firstId;
  var order = [first];
  for (var v = 0; v < gg.length; v++) {
    if (keep[v] && v !== first) order.push(v);
  }
  var newId = {};
  order.forEach(function(old, i) { newId[old] = i; });

  var result = order.map(function(old, i) {
    var n = clone(gg[old]);
    n.id = i;
    if (n.prop) delete n.prop.probandFlag;
    var out = (n.outedges || []).filter(function(e) { return newId.hasOwnProperty(e.to); })
      .map(function(e) { var c = clone(e); c.to = newId[e.to]; return c; });
    if (out.length) n.outedges = out; else delete n.outedges;
    return n;
  });

  // a couple without any child kept gets the placeholder child the editor uses for childless couples
  var extra = [];
  result.forEach(function(n) {
    if (isRel(n) && !n.outedges) {
      var hubId = result.length + extra.length;
      extra.push({ id: hubId, chhub: true, prop: {}, outedges: [{ to: hubId + 1 }] });
      extra.push({ id: hubId + 1, prop: placeholderChild() });
      n.outedges = [{ to: hubId }];
    }
  });
  result = result.concat(extra);
  validate(result);
  return result;
}

/** shortcut: selectPart + extractPart */
export function splitPedigree(gg, mode, personId, partnerId) {
  return extractPart(gg, selectPart(gg, mode, personId, partnerId), personId);
}

function placeholderChild() {
  return { 'gender': 'U', 'comments': '', 'isVirtualDummyChild': true, 'isPlaceholder': true };
}

function countPeople(gg) {
  return gg.filter(function(n) { return isPersonNode(n) && !isPlaceholderProps(n.prop); }).length;
}
export { countPeople };

/**
 * Joins two pedigrees into one.
 *
 * @param link { type: 'same'|'partners', baseId, incomingId }
 *   'same':     baseId and incomingId are the same individual drawn in both pedigrees;
 *               the two nodes become one (data recorded in the current pedigree wins, the
 *               other pedigree only fills in what is missing).
 *   'partners': baseId and incomingId become a couple (with a placeholder child).
 * The proband of the current pedigree stays the proband. Ids of the current pedigree are kept;
 * the other pedigree's nodes are appended.
 * @return { gg, incomingMap } incomingMap: old incoming id -> new id
 */
export function mergePedigrees(baseGG, incomingGG, link) {
  checkInput(baseGG);
  checkInput(incomingGG);
  link = link || {};
  var a = link.baseId, b = link.incomingId;
  if (!isPersonNode(baseGG[a]) || !isPersonNode(incomingGG[b])) {
    throw 'Choose one person in each pedigree';
  }
  var base = clone(baseGG);
  var inc = clone(incomingGG);
  var baseIns = inEdges(base);
  var incIns = inEdges(inc);

  inc.forEach(function(n) { if (n.prop) delete n.prop.probandFlag; });

  var map = {};
  var next = base.length;
  if (link.type === 'same') {
    var pa = base[a].prop || {}, pb = inc[b].prop || {};
    var ga = pa.gender || 'U', gb = pb.gender || 'U';
    if (ga !== 'U' && gb !== 'U' && ga !== gb) {
      throw 'The two people have different sexes';
    }
    if (baseIns[a].length && incIns[b].length) {
      throw 'Both copies of this person have parents: keep the parents in only one of the pedigrees';
    }
    if (isPlaceholderProps(pa) || isPlaceholderProps(pb)) {
      throw 'Choose one person in each pedigree';
    }
    for (var v = 0; v < inc.length; v++) {
      if (v === b) { map[v] = a; } else { map[v] = next++; }
    }
  } else if (link.type === 'partners') {
    for (var w = 0; w < inc.length; w++) { map[w] = next++; }
  } else {
    throw 'Unknown merge type: ' + link.type;
  }

  var result = base.slice();
  for (var u = 0; u < inc.length; u++) {
    var n = inc[u];
    var out = (n.outedges || []).map(function(e) { var c = clone(e); c.to = map[e.to]; return c; });
    if (link.type === 'same' && u === b) {
      // the fused person: keep the current data, fill in what is missing, add the other couples
      var props = result[a].prop || (result[a].prop = {});
      Object.keys(n.prop || {}).forEach(function(k) {
        var cur = props[k];
        var empty = cur === undefined || cur === null || cur === '' || (Array.isArray(cur) && cur.length == 0);
        if (empty) props[k] = n.prop[k];
      });
      if (props.gender === 'U' && n.prop && n.prop.gender && n.prop.gender !== 'U') props.gender = n.prop.gender;
      if (out.length) result[a].outedges = (result[a].outedges || []).concat(out);
      continue;
    }
    n.id = map[u];
    if (out.length) n.outedges = out; else delete n.outedges;
    result[n.id] = n;
  }

  if (link.type === 'partners') {
    var relId = result.length;
    var hubId = relId + 1;
    var childId = relId + 2;
    result.push({ id: relId, rel: true, hub: true, prop: {}, outedges: [{ to: hubId }] });
    result.push({ id: hubId, chhub: true, prop: {}, outedges: [{ to: childId }] });
    result.push({ id: childId, prop: placeholderChild() });
    result[a].outedges = (result[a].outedges || []).concat([{ to: relId }]);
    var nb = map[b];
    result[nb].outedges = (result[nb].outedges || []).concat([{ to: relId }]);
  }

  validate(result);
  return { gg: result, incomingMap: map };
}

/**
 * Structural checks of BaseGraph.validate() (so errors can be reported before loading).
 */
export function validate(gg) {
  checkInput(gg);
  var ins = inEdges(gg);
  for (var v = 0; v < gg.length; v++) {
    var n = gg[v];
    var out = outOf(n);
    if (isPersonNode(n)) {
      if (ins[v].length > 1) throw 'A person can only have one set of parents';
      out.forEach(function(t) { if (!isRel(gg[t])) throw 'Invalid pedigree data (person edge)'; });
    } else if (isRel(n)) {
      if (out.length != 1 || !isChhub(gg[out[0]])) throw 'Invalid pedigree data (relationship without children)';
      if (ins[v].length < 1 || ins[v].length > 2) throw 'Invalid pedigree data (relationship partners)';
    } else if (isChhub(n)) {
      if (out.length < 1) throw 'Invalid pedigree data (no children)';
      out.forEach(function(t) { if (!isPersonNode(gg[t])) throw 'Invalid pedigree data (child edge)'; });
    }
  }
  // connected
  var seen = {}, queue = [0], count = 0;
  seen[0] = true;
  while (queue.length) {
    var x = queue.shift();
    count++;
    outOf(gg[x]).concat(ins[x]).forEach(function(y) {
      if (!seen[y]) { seen[y] = true; queue.push(y); }
    });
  }
  if (count !== gg.length) throw 'The pedigree would be split into disconnected parts';
  // no cycles (a person cannot be their own ancestor)
  var state = {};
  var visit = function(s) {
    state[s] = 1;
    var o = outOf(gg[s]);
    for (var i = 0; i < o.length; i++) {
      if (state[o[i]] === 1) throw 'A person cannot be their own ancestor';
      if (!state[o[i]]) visit(o[i]);
    }
    state[s] = 2;
  };
  for (var s = 0; s < gg.length; s++) {
    if (!state[s]) visit(s);
  }
  return true;
}
