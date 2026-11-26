import test from 'node:test';
import assert from 'node:assert/strict';

const domById = new Map();

function registerSubtree(el) {
  if (!el) return;
  if (el.id) domById.set(el.id, el);
  for (const ch of el.children || []) registerSubtree(ch);
}

class FakeElement {
  constructor(tagName, attrs = {}) {
    this.tagName = String(tagName || 'div').toUpperCase();
    this.attributes = { ...attrs };
    this.id = attrs.id || '';
    this.className = attrs.class || '';
    this.title = attrs.title || '';
    this.value = attrs.value || '';
    this.selected = false;
    this.style = { display: '' };
    this.children = [];
    this.parentNode = null;
    this.textContent = '';
    this._listeners = {};
    if (this.id) domById.set(this.id, this);
  }
  update(html) {
    this.children = [];
    this.textContent = String(html ?? '');
    return this;
  }
  insert(arg) {
    if (arg && typeof arg === 'object' && !(arg instanceof FakeElement) && arg.top) {
      arg.top.parentNode = this;
      this.children.unshift(arg.top);
      registerSubtree(arg.top);
      return this;
    }
    if (arg instanceof FakeElement) {
      arg.parentNode = this;
      this.children.push(arg);
      registerSubtree(arg);
    }
    return this;
  }
  remove() {
    if (this.parentNode) {
      this.parentNode.children = this.parentNode.children.filter((c) => c !== this);
      this.parentNode = null;
    }
    if (this.id && domById.get(this.id) === this) {
      domById.delete(this.id);
    }
  }
  setStyle(styles) {
    Object.assign(this.style, styles);
    return this;
  }
  observe(eventName, handler) {
    (this._listeners[eventName] = this._listeners[eventName] || []).push(handler);
    return this;
  }
  trigger(eventName, eventObj = {}) {
    for (const fn of this._listeners[eventName] || []) {
      fn(eventObj);
    }
  }
  hasClassName(cls) {
    return String(this.className || '').split(/\s+/).includes(cls);
  }
  down(selector) {
    const cls = selector.startsWith('.') ? selector.slice(1) : null;
    const queue = [...this.children];
    while (queue.length) {
      const cur = queue.shift();
      if (cls && cur.hasClassName(cls)) return cur;
      queue.push(...cur.children);
    }
    return null;
  }
  queryAll(predicate) {
    const out = [];
    const walk = (n) => {
      if (predicate(n)) out.push(n);
      for (const c of n.children || []) walk(c);
    };
    walk(this);
    return out;
  }
}

globalThis.Class = {
  create(parentOrMethods, maybeMethods) {
    const hasParent = typeof parentOrMethods === 'function';
    const parent = hasParent ? parentOrMethods : null;
    const methods = hasParent ? maybeMethods : parentOrMethods;

    const ctor = function () {
      if (this.initialize) {
        this.initialize.apply(this, arguments);
      }
    };

    if (parent) {
      ctor.prototype = Object.create(parent.prototype);
      ctor.prototype.constructor = ctor;
    }

    for (const [name, fn] of Object.entries(methods)) {
      if (typeof fn === 'function' && parent && typeof parent.prototype[name] === 'function') {
        const superFn = parent.prototype[name];
        const params = fn.toString().match(/^[^(]*\(([^)]*)\)/);
        const firstArg = params && params[1] ? params[1].split(',')[0].trim() : '';
        if (firstArg === '$super') {
          ctor.prototype[name] = function (...args) {
            return fn.call(this, superFn.bind(this), ...args);
          };
          continue;
        }
      }
      ctor.prototype[name] = fn;
    }
    if (!ctor.addMethods) {
      ctor.addMethods = function (extra) {
        Object.assign(ctor.prototype, extra);
      };
    }
    return ctor;
  }
};

if (!String.prototype.escapeHTML) {
  String.prototype.escapeHTML = function () {
    return String(this).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  };
}

globalThis.Element = FakeElement;
globalThis.$ = (id) => (typeof id === 'string' ? domById.get(id) || null : id);
globalThis.localStorage = {
  _store: new Map(),
  getItem(k) { return this._store.has(k) ? this._store.get(k) : null; },
  setItem(k, v) { this._store.set(k, String(v)); }
};
globalThis.document = {
  documentElement: { getAttribute: () => 'en' },
  querySelectorAll: () => [],
  querySelector: () => null,
  observe: () => {},
  fire: () => {},
  addEventListener: () => {},
  removeEventListener: () => {}
};
globalThis.window = { innerWidth: 1280 };

const { default: PedigreeImport } = await import('../src/script/model/import.js');
const { default: PositionedGraph } = await import('../src/script/model/positionedGraph.js');
const { default: DynamicPositionedGraph } = await import('../src/script/model/dynamicGraph.js');
const { default: PartnershipVisuals } = await import('../src/script/view/partnershipVisuals.js');
const { default: PedigreeOverlay } = await import('../src/script/view/pedigreeOverlay.js');

function buildFromPED(pedLines) {
  const baseG = PedigreeImport.initFromPED(pedLines.join('\n'), true, false, true);
  const dg = new DynamicPositionedGraph(new PositionedGraph(baseG));
  const byExternalId = {};
  for (let v = 0; v <= dg.getMaxNodeId(); v++) {
    if (dg.isPerson(v) && dg.getProperties(v).externalID) {
      byExternalId[dg.getProperties(v).externalID] = v;
    }
  }
  return { dg, idOf: (ext) => byExternalId[ext] };
}

function makeFakePaper() {
  const elements = [];
  const makeEl = (kind, extra = {}) => {
    const attrs = {};
    const nodeAttrs = {};
    const el = {
      kind,
      ...extra,
      attrs,
      removed: false,
      hidden: false,
      node: {
        style: {},
        setAttribute(k, v) { nodeAttrs[k] = v; },
        getAttribute(k) { return nodeAttrs[k] ?? null; },
        removeAttribute(k) { delete nodeAttrs[k]; }
      },
      attr(k, v) {
        if (typeof k === 'object' && k !== null) Object.assign(attrs, k);
        else if (v !== undefined) attrs[k] = v;
        else return attrs[k];
        return el;
      },
      hide() { el.hidden = true; el.node.style.display = 'none'; return el; },
      show() { el.hidden = false; el.node.style.display = ''; return el; },
      toBack() { return el; },
      toFront() { return el; },
      insertAfter() { return el; },
      insertBefore() { return el; },
      transform() { return el; },
      flatten() { return el; },
      clone() { return makeEl(kind, extra); },
      glow() { return makeEl('glow'); },
      hover() { return el; },
      click() { return el; },
      mousedown() { return el; },
      drag() { return el; },
      getBBox() { return { x: (extra.x || 0) - 10, y: (extra.y || 0) - 8, x2: (extra.x || 0) + 10, y2: (extra.y || 0) + 8, width: 20, height: 16 }; },
      remove() { el.removed = true; }
    };
    elements.push(el);
    return el;
  };

  let captureStack = null;
  const makeSet = (initial = []) => {
    const items = [...initial];
    const s = {
      items,
      push(...args) { items.push(...args); return s; },
      concat(other) { if (other && other.items) items.push(...other.items); return s; },
      exclude(target) {
        const idx = items.indexOf(target);
        if (idx >= 0) items.splice(idx, 1);
      },
      forEach(fn) { items.forEach(fn); },
      hide() { items.forEach((i) => i && i.hide && i.hide()); return s; },
      show() { items.forEach((i) => i && i.show && i.show()); return s; },
      toBack() { return s; },
      toFront() { return s; },
      attr(a, b) { items.forEach((i) => i && i.attr && i.attr(a, b)); return s; },
      transform() { return s; },
      flatten() { return items[0] || makeEl('empty'); },
      remove() { items.forEach((i) => i && i.remove && i.remove()); }
    };
    return s;
  };

  const track = (el) => {
    if (captureStack) captureStack.push(el);
    return el;
  };

  return {
    elements,
    circle: (x, y, r) => track(makeEl('circle', { x, y, r })),
    rect: (x, y, w, h, r) => track(makeEl('rect', { x, y, w, h, r })),
    path: (d) => track(makeEl('path', { d })),
    text: (x, y, txt) => track(makeEl('text', { x, y, text: txt })),
    set: (...initial) => makeSet(initial),
    setStart() { captureStack = []; },
    setFinish() {
      const captured = captureStack || [];
      captureStack = null;
      return makeSet(captured);
    }
  };
}

test('branch collapsing works across first-cousin consanguinity loops and restores cleanly', () => {
  // First-cousin marriage:
  // GreatGF (ggf) x GreatGM (ggm) -> PatGF (pgf), MatGM (mgm), GreatUncle (gu)
  // PatGF x PatGM (pgm) -> Father (dad), PatAunt (paunt)
  // MatGF (mgf) x MatGM -> Mother (mom)
  // GreatUncle x GUWife (guw) -> CousinOnceRemoved (cor)
  // Father x Mother (first cousins!) -> Proband (prob)
  const ped = [
    'FAM prob dad mom 1 2',
    'FAM dad pgf pgm 1 1',
    'FAM paunt pgf pgm 2 1',
    'FAM mom mgf mgm 2 1',
    'FAM pgf ggf ggm 1 1',
    'FAM mgm ggf ggm 2 1',
    'FAM gu ggf ggm 1 1',
    'FAM guw 0 0 2 1',
    'FAM cor gu guw 1 1',
    'FAM pgm 0 0 2 1',
    'FAM mgf 0 0 1 1',
    'FAM ggf 0 0 1 1',
    'FAM ggm 0 0 2 1'
  ];
  const { dg, idOf } = buildFromPED(ped);
  // Make proband the branch root
  dg.setProperties(idOf('prob'), { ...dg.getProperties(idOf('prob')), probandFlag: true });

  const dad = idOf('dad');
  const mom = idOf('mom');
  const pgf = idOf('pgf');
  const pgm = idOf('pgm');
  const paunt = idOf('paunt');
  const mgf = idOf('mgf');
  const mgm = idOf('mgm');
  const ggf = idOf('ggf');
  const ggm = idOf('ggm');
  const gu = idOf('gu');
  const guw = idOf('guw');
  const cor = idOf('cor');

  // Previously all loop members returned 0; now each has a collapsible branch
  assert.equal(dg.getBranchSize(dad), 3, 'collapsing father hides pgf, pgm, and paunt despite loop');
  assert.ok(dg.getBranchSize(pgf) >= 5, 'collapsing paternal grandfather cuts the ancestral loop and hides great-grandparents + great-uncle branch');
  assert.equal(dg.getBranchSize(gu), 2, 'collapsing great-uncle hides his wife and child');

  // Collapse Father -> pgf, pgm, paunt hidden; mom and maternal side stay visible
  dg.setProperties(dad, { ...dg.getProperties(dad), collapsed: true });
  dg.relayout();

  assert.equal(dg.isHiddenBranch(dad), false, 'collapsed anchor father stays visible');
  assert.equal(dg.isHiddenBranch(pgf), true, 'pgf hidden');
  assert.equal(dg.isHiddenBranch(pgm), true, 'pgm hidden');
  assert.equal(dg.isHiddenBranch(paunt), true, 'paunt hidden');
  assert.equal(dg.isHiddenBranch(mom), false, 'mother remains visible');
  assert.equal(dg.isHiddenBranch(mgm), false, 'maternal grandmother remains visible');
  assert.equal(dg.isHiddenBranch(ggf), false, 'shared great-grandfather remains reachable via maternal path');

  // All coordinates remain finite after relayout with collapsed loop branch
  for (let v = 0; v <= dg.getMaxNodeId(); v++) {
    if (dg.isValidID(v)) {
      const pos = dg.getPosition(v);
      assert.ok(Number.isFinite(pos.x) && Number.isFinite(pos.y), `finite position for vertex ${v}`);
    }
  }

  // Expand Father, then collapse PatGF -> cuts ancestral loop above pgf/mgm
  dg.setProperties(dad, { ...dg.getProperties(dad), collapsed: false });
  dg.setProperties(pgf, { ...dg.getProperties(pgf), collapsed: true });
  dg.relayout();

  assert.equal(dg.isHiddenBranch(pgf), false, 'pgf anchor stays visible');
  assert.equal(dg.isHiddenBranch(ggf), true, 'shared great-grandfather hidden when pgf is collapsed');
  assert.equal(dg.isHiddenBranch(ggm), true, 'shared great-grandmother hidden when pgf is collapsed');
  assert.equal(dg.isHiddenBranch(gu), true, 'great-uncle hidden');
  assert.equal(dg.isHiddenBranch(guw), true, 'great-uncle wife hidden');
  assert.equal(dg.isHiddenBranch(cor), true, 'cousin once removed hidden');

  // Expand PatGF -> everyone visible again
  dg.setProperties(pgf, { ...dg.getProperties(pgf), collapsed: false });
  dg.relayout();
  for (const ext of ['prob', 'dad', 'mom', 'pgf', 'pgm', 'paunt', 'mgf', 'mgm', 'ggf', 'ggm', 'gu', 'guw', 'cor']) {
    assert.equal(dg.isHiddenBranch(idOf(ext)), false, `${ext} visible after expand`);
  }
});

test('branch collapsing works on collateral cousin marriage, double first cousins, and uncle-niece loops', () => {
  // Collateral cousin marriage:
  // Proband's father (dad) has siblings uncle1 and aunt1; uncle1's son c1 marries aunt1's daughter c2 -> child inb
  const collateralPed = [
    'FAM prob dad mom 1 2',
    'FAM mom 0 0 2 1',
    'FAM dad gf gm 1 1',
    'FAM u1 gf gm 1 1',
    'FAM a1 gf gm 2 1',
    'FAM gf 0 0 1 1',
    'FAM gm 0 0 2 1',
    'FAM u1w 0 0 2 1',
    'FAM a1h 0 0 1 1',
    'FAM c1 u1 u1w 1 1',
    'FAM c2 a1h a1 2 1',
    'FAM inb c1 c2 1 1'
  ];
  const col = buildFromPED(collateralPed);
  col.dg.setProperties(col.idOf('prob'), { ...col.dg.getProperties(col.idOf('prob')), probandFlag: true });

  // Collapsing dad hides the entire paternal collateral consanguinity loop (9 people)
  assert.equal(col.dg.getBranchSize(col.idOf('dad')), 9);
  // Collapsing u1 hides u1w and c1 even though c1 is married to cousin c2!
  assert.equal(col.dg.getBranchSize(col.idOf('u1')), 2);
  // Collapsing c1 hides inbred child inb
  assert.equal(col.dg.getBranchSize(col.idOf('c1')), 1);

  col.dg.setProperties(col.idOf('u1'), { ...col.dg.getProperties(col.idOf('u1')), collapsed: true });
  col.dg.relayout();
  assert.equal(col.dg.isHiddenBranch(col.idOf('u1w')), true);
  assert.equal(col.dg.isHiddenBranch(col.idOf('c1')), true);
  assert.equal(col.dg.isHiddenBranch(col.idOf('c2')), false, 'c2 stays visible via aunt1');
  assert.equal(col.dg.isHiddenBranch(col.idOf('inb')), false, 'inb stays visible under c2 as single visible parent');

  // Uncle-niece union (multi-rank edge chain!)
  const uncleNiecePed = [
    'FAM prob u niece 1 2',
    'FAM u gf gm 1 1',
    'FAM sis gf gm 2 1',
    'FAM sish 0 0 1 1',
    'FAM niece sish sis 2 1',
    'FAM gf 0 0 1 1',
    'FAM gm 0 0 2 1'
  ];
  const un = buildFromPED(uncleNiecePed);
  un.dg.setProperties(un.idOf('prob'), { ...un.dg.getProperties(un.idOf('prob')), probandFlag: true });

  assert.ok(un.dg.getBranchSize(un.idOf('u')) > 0, 'uncle has collapsible ancestral branch');
  assert.ok(un.dg.getBranchSize(un.idOf('niece')) > 0, 'niece has collapsible parent branch');

  un.dg.setProperties(un.idOf('niece'), { ...un.dg.getProperties(un.idOf('niece')), collapsed: true });
  un.dg.relayout();
  assert.equal(un.dg.isHiddenBranch(un.idOf('sish')), true);
  assert.equal(un.dg.isHiddenBranch(un.idOf('sis')), true);
  assert.equal(un.dg.isHiddenBranch(un.idOf('prob')), false);
});

test('Focus Mode filters any consanguineous pedigree by degree radius and survives relayout and node deletions', () => {
  const ped = [
    'FAM prob dad mom 1 2',
    'FAM sib dad mom 2 1',
    'FAM dad pgf pgm 1 1',
    'FAM paunt pgf pgm 2 1',
    'FAM cousin paunth paunt 1 1',
    'FAM paunth 0 0 1 1',
    'FAM mom mgf mgm 2 1',
    'FAM pgf ggf ggm 1 1',
    'FAM mgm ggf ggm 2 1',
    'FAM pgm 0 0 2 1',
    'FAM mgf 0 0 1 1',
    'FAM ggf 0 0 1 1',
    'FAM ggm 0 0 2 1'
  ];
  const { dg, idOf } = buildFromPED(ped);
  const prob = idOf('prob');

  // 1° focus around proband: only prob, dad, mom, sib (4 visible, 9 hidden)
  assert.equal(dg.setFocusMode(prob, 1), true);
  dg.relayout();
  assert.equal(dg.isFocusMode(), true);
  assert.deepEqual(dg.getFocusMode(), { personId: prob, maxDegree: 1 });
  assert.equal(dg.getFocusHiddenCount(), 9);
  for (const vis of ['prob', 'dad', 'mom', 'sib']) {
    assert.equal(dg.isHiddenBranch(idOf(vis)), false, `${vis} visible at 1°`);
  }
  for (const hid of ['pgf', 'pgm', 'paunt', 'paunth', 'cousin', 'mgf', 'mgm', 'ggf', 'ggm']) {
    assert.equal(dg.isHiddenBranch(idOf(hid)), true, `${hid} hidden at 1°`);
  }

  // 2° focus around proband: adds grandparents & paunt (9 visible, 4 hidden: paunth, cousin, ggf, ggm)
  dg.setFocusMode(prob, 2);
  dg.relayout();
  assert.equal(dg.getFocusHiddenCount(), 4);
  for (const vis of ['prob', 'dad', 'mom', 'sib', 'pgf', 'pgm', 'paunt', 'mgf', 'mgm']) {
    assert.equal(dg.isHiddenBranch(idOf(vis)), false, `${vis} visible at 2°`);
  }
  for (const hid of ['paunth', 'cousin', 'ggf', 'ggm']) {
    assert.equal(dg.isHiddenBranch(idOf(hid)), true, `${hid} hidden at 2°`);
  }

  // Switch focus to `cousin` at 1°: cousin, paunt, paunth visible; proband hidden!
  const cousin = idOf('cousin');
  dg.setFocusMode(cousin, 1);
  dg.relayout();
  assert.equal(dg.isHiddenBranch(cousin), false);
  assert.equal(dg.isHiddenBranch(idOf('paunt')), false);
  assert.equal(dg.isHiddenBranch(idOf('paunth')), false);
  assert.equal(dg.isHiddenBranch(prob), true, 'proband outside 1° of cousin is hidden');

  // Removing focused person (`cousin`) automatically exits Focus Mode
  const disc = dg.getDisconnectedSetIfNodeRemoved(cousin);
  dg.removeNodes(disc);
  assert.equal(dg.isFocusMode(), false, 'removing focused person clears Focus Mode');

  // Focus on remaining `prob`, remove `sib` -> focus stays active and tracks remapped proband ID
  let curProb = null;
  let curSib = null;
  for (let v = 0; v <= dg.getMaxNodeId(); v++) {
    if (dg.isPerson(v) && dg.getProperties(v).externalID === 'prob') curProb = v;
    if (dg.isPerson(v) && dg.getProperties(v).externalID === 'sib') curSib = v;
  }
  dg.setFocusMode(curProb, 2);
  dg.removeNodes([curSib]);
  let newProb = null;
  for (let v = 0; v <= dg.getMaxNodeId(); v++) {
    if (dg.isPerson(v) && dg.getProperties(v).externalID === 'prob') newProb = v;
  }
  assert.equal(dg.isFocusMode(), true);
  assert.equal(dg.getFocusMode().personId, newProb, 'focused person ID is remapped on node deletion');

  // Clear Focus Mode restores full pedigree
  assert.equal(dg.clearFocusMode(), true);
  assert.equal(dg.isFocusMode(), false);
  assert.equal(dg.getFocusHiddenCount(), 0);
});

test('PartnershipVisuals and PedigreeOverlay cleanly render 1-visible-partner relationships and Focus Mode bar', () => {
  const ped = [
    'FAM prob dad mom 1 2',
    'FAM dad pgf pgm 1 1',
    'FAM mom mgf mgm 2 1',
    'FAM pgf ggf ggm 1 1',
    'FAM mgm ggf ggm 2 1',
    'FAM pgm 0 0 2 1',
    'FAM mgf 0 0 1 1',
    'FAM ggf 0 0 1 1',
    'FAM ggm 0 0 2 1'
  ];
  const { dg, idOf } = buildFromPED(ped);
  const dad = idOf('dad');
  const mom = idOf('mom');
  const prob = idOf('prob');

  // Focus on `mom` with 1° radius: `mom`, `dad`, `prob`, `mgf`, `mgm` are visible;
  // now also focus on `mgm` with 1° radius so `mom` is visible, `dad` is hidden, and `prob`... wait:
  // `mgm` (0) -> `mom` (1) -> `prob` (2), so at `maxDegree = 2` on `ggf`:
  // ggf (0) -> pgf (1), mgm (1) -> dad (2), mom (2), while pgm and mgf are at distance 2 (partners of pgf/mgm).
  // To test 1-visible-partner + 1-visible-child: focus on `mgf` at 2°:
  // mgf (0) -> mgm (1), mom (1) -> dad (2), prob (2), ggf (2), ggm (2).
  // Instead focus on `mgf` at 1°: mgf (0), mgm (1), mom (1) visible; dad and prob hidden!
  // And for 1-visible-partner + 1-visible-child: collapse `dad`? No, dad is visible. What if `prob` has child `kid` with `spouse`, and we focus on `prob` at 1°? Both `spouse` and `kid` are at 1°.
  // What if we focus on `mom` at 1° while `prob` has a child `kid` with `spouse`?
  // From `mom`: `prob` is 1°, `kid` is 2°, `spouse` is 2°.
  // What if `pgf` is collapsed? `pgf` (visible) + `pgm` (NOT hidden) — wait: in `ggf x ggm -> pgf, mgm`, when `dad` is collapsed:
  // `pgf` is hidden, `mgm` is visible, `ggf` & `ggm` are visible: both parents of `mgm` visible.
  // What if `mom` is focused at 1°? `mom` (0), `dad` (1), `prob` (1), `mgf` (1), `mgm` (1) visible; `ggf` (2) & `ggm` (2) hidden -> `mgm` has NO visible parents.
  // What if `pgf` and `mgm` are siblings, and we focus on `pgf` at 1°?
  // `pgf` (0) -> `ggf` (1), `ggm` (1), `mgm` (1), `pgm` (1), `dad` (1) visible; `mom` (2) and `mgf` (2) hidden!
  // Look at `mgm x mgf -> mom` vs `dad x mom -> prob`:
  // Focus on `pgm` at 2°:
  // `pgm` (0) -> `pgf` (1), `dad` (1) -> `mom` (2), `prob` (2)!
  // Now collapse `mom`? No, focus on `pgm` at 1° while `dad` has child `prob` with `mom`:
  // Wait: if `dad` is at 1° and `prob` is at 2°, at 2° `mom` is also at 2°.
  // When DOES 1-visible-partner + 1-visible-child happen? In collateral cousin marriage!
  // Earlier we saw: `u1` collapsed -> `c1` hidden, while `c2` and `inb` remain visible! So relationship `c1 x c2 -> inb` has 1 visible partner (`c2`) and 1 visible child (`inb`)!
  const collateralPed = [
    'FAM prob dad mom 1 2',
    'FAM mom 0 0 2 1',
    'FAM dad gf gm 1 1',
    'FAM u1 gf gm 1 1',
    'FAM a1 gf gm 2 1',
    'FAM gf 0 0 1 1',
    'FAM gm 0 0 2 1',
    'FAM u1w 0 0 2 1',
    'FAM a1h 0 0 1 1',
    'FAM c1 u1 u1w 1 1',
    'FAM c2 a1h a1 2 1',
    'FAM inb c1 c2 1 1'
  ];
  const col = buildFromPED(collateralPed);
  col.dg.setProperties(col.idOf('prob'), { ...col.dg.getProperties(col.idOf('prob')), probandFlag: true });
  const c1 = col.idOf('c1');
  const c2 = col.idOf('c2');
  const inb = col.idOf('inb');
  const cousinRel = col.dg.getParentRelationship(inb);
  col.dg.setProperties(cousinRel, { ...col.dg.getProperties(cousinRel), relationDegree: '1st cousins' });

  col.dg.setProperties(col.idOf('u1'), { ...col.dg.getProperties(col.idOf('u1')), collapsed: true });
  col.dg.relayout();

  const paper = makeFakePaper();
  const drawnLines = [];
  const workArea = new FakeElement('div', { id: 'work-area' });

  const nodeWrappers = {};
  for (let v = 0; v <= col.dg.getMaxNodeId(); v++) {
    if (!col.dg.isValidID(v)) continue;
    const pos = col.dg.getPosition(v);
    const props = col.dg.getProperties(v) || {};
    if (col.dg.isPerson(v)) {
      nodeWrappers[v] = {
        getID: () => v,
        getType: () => 'Person',
        getX: () => pos.x,
        getY: () => pos.y,
        isProband: () => !!props.probandFlag,
        isAdopted: () => false,
        getLostContact: () => false,
        getMonozygotic: () => false,
        getZygosityUnknown: () => false,
        getCollapsed: () => !!props.collapsed,
        getHistoryUnknown: () => false,
        getArtRole: () => '',
        getArtKey: () => null,
        getArtLinks: () => []
      };
    } else {
      nodeWrappers[v] = {
        getID: () => v,
        getType: () => 'Partnership',
        getX: () => pos.x,
        getY: () => pos.y,
        isArtLink: () => false,
        getConsanguinity: () => 'A',
        getBrokenStatus: () => false,
        getChildlessStatus: () => null,
        getChildlessReason: () => '',
        getRelationDegree: () => props.relationDegree || '',
        getGraphics: () => null
      };
    }
  }

  globalThis.editor = {
    DEBUG_MODE: false,
    isReadOnlyMode: () => true,
    getPaper: () => paper,
    getGraph: () => col.dg,
    getNode: (v) => nodeWrappers[v] || null,
    convertGraphCoordToCanvasCoord: (x, y) => ({ x, y }),
    getWorkspace: () => ({ background: null, getWorkArea: () => workArea }),
    getView: () => ({
      getNode: (v) => nodeWrappers[v] || null,
      drawLineWithCrossings: (owner, x1, y1, x2, y2) => {
        drawnLines.push({ owner, x1, y1, x2, y2 });
      },
      drawCurvedLineWithCrossings: (owner, x1, y1, yTop, x2, y2) => {
        drawnLines.push({ owner, x1, y1, x2, y2, curved: true });
      }
    })
  };

  const relPos = col.dg.getPosition(cousinRel);
  const visuals = new PartnershipVisuals(nodeWrappers[cousinRel], relPos.x, relPos.y);
  assert.equal(visuals.getJunctionShape().hidden, true, 'junction circle hidden when 1 partner is hidden');
  const cousinLines = drawnLines.filter((l) => l.owner === cousinRel);
  assert.equal(cousinLines.some((l) => l.curved), false, 'no horizontal marriage line drawn to hidden partner');
  const c2Pos = col.dg.getPosition(c2);
  assert.equal(
    cousinLines.some((l) => l.x1 === c2Pos.x && l.x2 === c2Pos.x && l.y1 === c2Pos.y),
    true,
    'vertical single-parent stem drops directly from the visible parent c2'
  );

  // Overlay does NOT draw floating F= or "1st cousins" above cousinRel when c1 is hidden
  const overlay = new PedigreeOverlay();
  overlay.redraw();
  const floatingTexts = paper.elements.filter((el) => el.kind === 'text' && !el.removed).map((el) => el.text);
  assert.equal(floatingTexts.some((t) => String(t).includes('F =')), false, 'no floating F coefficient for partially hidden couple');
  assert.equal(floatingTexts.includes('1st cousins'), false, 'no floating relationDegree for partially hidden couple');

  // Activate Focus Mode and verify floating Focus Mode legend bar
  col.dg.setFocusMode(col.idOf('prob'), 2);
  overlay.updateFocusLegend();
  const focusBar = workArea.down('.focus-chart-legend');
  assert.ok(focusBar, 'Focus Mode legend bar rendered in work-area');
  const options = focusBar.queryAll((el) => el.tagName === 'OPTION');
  assert.equal(options.length, col.dg.getRealPersonCount(), 'Focus Mode person selector lists all real people including hidden ones');
  const degButtons = focusBar.queryAll((el) => el.hasClassName && el.hasClassName('focus-degree-btn'));
  assert.equal(degButtons.length, 5, 'renders 1°..5° degree buttons');
  assert.equal(degButtons[1].hasClassName('active'), true, '2° button marked active');

  col.dg.clearFocusMode();
  overlay.updateFocusLegend();
  assert.equal(workArea.down('.focus-chart-legend'), null, 'Focus Mode legend bar removed on exit');
});
