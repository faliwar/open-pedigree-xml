import { isRealPerson, getBiologicalParents, findBloodRelatives } from 'pedigree/model/kinship';
import { testResult, normalizeAncestry } from 'pedigree/model/clinicalData';

/**
 * Finds the people of the pedigree who match a list of filters, combined with AND ("all") or
 * OR ("any"). Each filter is { field, op, value, value2, value3 }:
 *
 *   name       op contains | notcontains     value: text (name, last name, external ID, comments)
 *   sex        op is | isnot                 value: M | F | U
 *   life       op is | isnot                 value: alive | deceased | stillborn | miscarriage | unborn | aborted
 *   clinical   op is | isnot                 value: affected | carrier | presymptomatic | evaluated
 *   condition  op has | hasnot               value: '' (any condition) or a disorder id
 *   phenotype  op has | hasnot               value: '' (any phenotype) or an HPO id
 *   age        op gte | lte | between | unknown   value, value2: years (age at death if deceased)
 *   agediag    op lte | gte                  value: years, value2: '' (any condition) or a disorder id
 *   test       op = result: any | positive | negative | vus | pending | declined | none
 *                                            value: '' (any gene) or a gene symbol
 *   ancestry   op has | hasnot               value: ancestry text
 *   relation   op ancestor | descendant | blood | sibling | partner   value: person id,
 *                                            value2: maximum degree for 'blood' (1-3, or 99)
 *   flag       op is | isnot                 value: proband | adopted | nocontact | twin | comments
 *
 * Works on the live editor nodes; incomplete filters (no value where one is needed) are ignored.
 */

var YEAR_MS = 365.25 * 24 * 3600 * 1000;

var str = function(v) {
  return (v === undefined || v === null) ? '' : String(v).trim();
};

var num = function(v) {
  var n = parseFloat(String(v === undefined || v === null ? '' : v).replace(',', '.'));
  return isNaN(n) ? null : n;
};

// "51", "51 yrs", "51y" -> 51
var parseAge = function(v) {
  var m = str(v).match(/^(\d{1,3}(?:[.,]\d+)?)/);
  return m ? num(m[1]) : null;
};

var getPersonIds = function(graph) {
  var ids = [];
  for (var id = 0; id <= graph.getMaxNodeId(); id++) {
    if (isRealPerson(graph, id)) ids.push(id);
  }
  return ids;
};

/** Current age in years, or the age at death; null when unknown */
var personAge = function(node) {
  var birth = node.getBirthDate && node.getBirthDate();
  var death = node.getDeathDate && node.getDeathDate();
  if (birth && birth.getTime) {
    var end = (death && death.getTime) ? death : new Date();
    return (end.getTime() - birth.getTime()) / YEAR_MS;
  }
  if (node.getAgeAtDeath) {
    var a = parseAge(node.getAgeAtDeath());
    if (a !== null) return a;
  }
  return null;
};

var disordersOf = function(node) {
  return ((node.getDisorders && node.getDisorders()) || []).filter(function(d) { return d !== 'affected'; });
};

var isAffected = function(node) {
  return (node.getCarrierStatus && node.getCarrierStatus() === 'affected') || disordersOf(node).length > 0;
};

// Ages at diagnosis recorded for the person: [{disorder, age}]
var diagnosisAges = function(node) {
  var out = [];
  disordersOf(node).forEach(function(d) {
    var detail = node.getDisorderDetail ? node.getDisorderDetail(d) : null;
    var age = detail ? parseAge(detail.atdiag) : null;
    if (age === null && detail) age = parseAge(detail.onset);
    if (age !== null) out.push({ disorder: d, age: age });
  });
  return out;
};

/** Result of the person's tests for a gene ('' = any gene): array of results found */
var testResults = function(node, gene) {
  var tests = (node.getGeneticTests && node.getGeneticTests()) || [];
  return tests.filter(function(t) { return !gene || t.gene === gene; })
    .map(function(t) { return testResult(t) || 'pending'; });
};

var Query = Class.create({

  initialize: function(graph) {
    this.graph = graph;
    this.ids = getPersonIds(graph);
    this._ancestors = {};
  },

  // biological ancestors of id (not including id)
  ancestorsOf: function(id) {
    if (this._ancestors[id]) return this._ancestors[id];
    var graph = this.graph;
    var seen = {};
    var stack = getBiologicalParents(graph, id).slice();
    while (stack.length) {
      var p = stack.pop();
      if (seen[p]) continue;
      seen[p] = true;
      getBiologicalParents(graph, p).forEach(function(q) { if (!seen[q]) stack.push(q); });
    }
    this._ancestors[id] = seen;
    return seen;
  },

  _relationSet: function(op, refId, maxDegree) {
    var graph = this.graph;
    var set = {};
    var _this = this;
    if (op === 'ancestor') {
      Object.keys(this.ancestorsOf(refId)).forEach(function(id) { set[id] = true; });
    } else if (op === 'descendant') {
      this.ids.forEach(function(id) {
        if (id !== refId && _this.ancestorsOf(id)[refId]) set[id] = true;
      });
    } else if (op === 'blood') {
      findBloodRelatives(graph, refId, maxDegree || 99).forEach(function(k) { set[k.id] = true; });
    } else if (op === 'sibling') {
      var parents = getBiologicalParents(graph, refId).map(String);
      if (parents.length) {
        this.ids.forEach(function(id) {
          if (id === refId) return;
          var ps = getBiologicalParents(graph, id).map(String);
          if (ps.some(function(p) { return parents.indexOf(p) !== -1; })) set[id] = true;
        });
      }
    } else if (op === 'partner') {
      try {
        (graph.DG.GG.getAllPartners(refId) || []).forEach(function(id) {
          if (isRealPerson(graph, id)) set[id] = true;
        });
      } catch (e) {}
    }
    return set;
  },

  /** Whether the filter can be evaluated (has the values it needs) */
  isComplete: function(f) {
    if (!f || !f.field) return false;
    switch (f.field) {
      case 'name':
      case 'ancestry':
        return str(f.value) !== '';
      case 'age':
        if (f.op === 'unknown') return true;
        if (f.op === 'between') return num(f.value) !== null && num(f.value2) !== null;
        return num(f.value) !== null;
      case 'agediag':
        return num(f.value) !== null;
      case 'relation':
        return f.value !== '' && f.value !== null && f.value !== undefined && isRealPerson(this.graph, parseInt(f.value, 10));
      default:
        return true;
    }
  },

  /** Ids of the people who match one filter */
  matchFilter: function(f) {
    var _this = this;
    var set = null;
    if (f.field === 'relation') {
      set = this._relationSet(f.op, parseInt(f.value, 10), parseInt(f.value2, 10));
    }
    return this.ids.filter(function(id) {
      var node = editor.getNode(id);
      if (!node) return false;
      return set ? !!set[id] : _this._test(node, id, f);
    });
  },

  _test: function(node, id, f) {
    var positive = f.op !== 'isnot' && f.op !== 'hasnot' && f.op !== 'notcontains';
    var hit;
    switch (f.field) {
      case 'name':
        var text = [node.getFirstName && node.getFirstName(), node.getLastName && node.getLastName(),
          node.getExternalID && node.getExternalID(),
          node.getComments && node.getComments()].map(str).join(' ').toLowerCase();
        hit = text.indexOf(str(f.value).toLowerCase()) !== -1;
        break;
      case 'sex':
        hit = ((node.getGender && node.getGender()) || 'U') === f.value;
        break;
      case 'life':
        hit = ((node.getLifeStatus && node.getLifeStatus()) || 'alive') === f.value;
        break;
      case 'clinical':
        if (f.value === 'affected') hit = isAffected(node);
        else if (f.value === 'evaluated') hit = !!(node.getEvaluated && node.getEvaluated());
        else hit = !!(node.getCarrierStatus && node.getCarrierStatus() === f.value);
        break;
      case 'condition':
        var ds = disordersOf(node);
        hit = f.value ? ds.indexOf(f.value) !== -1 : ds.length > 0;
        break;
      case 'phenotype':
        var hpo = (node.getHPO && node.getHPO()) || [];
        hit = f.value ? hpo.indexOf(f.value) !== -1 : hpo.length > 0;
        break;
      case 'age':
        var age = personAge(node);
        if (f.op === 'unknown') return age === null;
        if (age === null) return false;
        var a = Math.floor(age + 1e-9);
        if (f.op === 'gte') return a >= num(f.value);
        if (f.op === 'lte') return a <= num(f.value);
        var lo = Math.min(num(f.value), num(f.value2)), hi = Math.max(num(f.value), num(f.value2));
        return a >= lo && a <= hi;
      case 'agediag':
        var limit = num(f.value);
        return diagnosisAges(node).some(function(d) {
          if (f.value2 && d.disorder !== f.value2) return false;
          return f.op === 'gte' ? d.age >= limit : d.age <= limit;
        });
      case 'test':
        var results = testResults(node, f.value);
        if (f.op === 'none') return results.length === 0;
        if (f.op === 'any' || !f.op) return results.length > 0;
        return results.indexOf(f.op) !== -1;
      case 'ancestry':
        var wanted = str(f.value).toLowerCase();
        var list = normalizeAncestry(node.getAncestry ? node.getAncestry() : []);
        hit = list.some(function(a) { return a.toLowerCase() === wanted; });
        break;
      case 'flag':
        if (f.value === 'proband') hit = id === this.graph.getProbandId();
        else if (f.value === 'adopted') hit = !!(node.isAdopted && node.isAdopted()) || !!(node.isAdoptedOut && node.isAdoptedOut()) || this._isAdopted(id);
        else if (f.value === 'nocontact') hit = !!(node.getLostContact && node.getLostContact());
        else if (f.value === 'twin') hit = this._isTwin(id);
        else if (f.value === 'comments') hit = str(node.getComments && node.getComments()) !== '';
        break;
      default:
        return false;
    }
    return positive ? !!hit : !hit;
  },

  _isAdopted: function(id) {
    try { return !!this.graph.isAdopted(id); } catch (e) { return false; }
  },

  _isTwin: function(id) {
    try { return this.graph.getAllTwinsSortedByOrder(id).length > 1; } catch (e) { return false; }
  },

  /**
   * @param {Array} filters
   * @param {String} match 'all' | 'any'
   * @return {Array} matching ids, or null when no filter is complete
   */
  run: function(filters, match) {
    var _this = this;
    var usable = (filters || []).filter(function(f) { return _this.isComplete(f); });
    if (!usable.length) return null;
    var sets = usable.map(function(f) {
      var s = {};
      _this.matchFilter(f).forEach(function(id) { s[id] = true; });
      return s;
    });
    return this.ids.filter(function(id) {
      return match === 'any' ? sets.some(function(s) { return s[id]; }) : sets.every(function(s) { return s[id]; });
    });
  }
});

/** Values present in the pedigree, to fill the filter selectors */
var collectValues = function(graph) {
  var out = { disorders: {}, hpo: {}, genes: {}, ancestry: {} };
  getPersonIds(graph).forEach(function(id) {
    var node = editor.getNode(id);
    if (!node) return;
    disordersOf(node).forEach(function(d) { out.disorders[d] = true; });
    ((node.getHPO && node.getHPO()) || []).forEach(function(h) { out.hpo[h] = true; });
    ((node.getGeneticTests && node.getGeneticTests()) || []).forEach(function(t) { if (t.gene) out.genes[t.gene] = true; });
    normalizeAncestry(node.getAncestry ? node.getAncestry() : []).forEach(function(a) { out.ancestry[a] = true; });
  });
  return {
    disorders: Object.keys(out.disorders),
    hpo: Object.keys(out.hpo),
    genes: Object.keys(out.genes).sort(),
    ancestry: Object.keys(out.ancestry).sort()
  };
};

export { Query, collectValues, personAge, getPersonIds, isAffected, disordersOf };
