import test from 'node:test';
import assert from 'node:assert/strict';

// Minimal PrototypeJS-like Class/Element/DOM stubs to exercise real view modules in Node
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
    return ctor;
  }
};

if (!Array.prototype.without) {
  Array.prototype.without = function (...values) {
    return this.filter((item) => !values.includes(item));
  };
}
if (!Array.prototype.each) {
  Array.prototype.each = Array.prototype.forEach;
}
if (!String.prototype.escapeHTML) {
  String.prototype.escapeHTML = function () {
    return String(this).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  };
}

class FakeElement {
  constructor(tagName, attrs = {}) {
    this.tagName = String(tagName || 'div').toUpperCase();
    this.attributes = { ...attrs };
    this.id = attrs.id || '';
    this.className = attrs.class || '';
    this.title = attrs.title || '';
    this.value = attrs.value || '';
    this.checked = false;
    this.selected = false;
    this.focused = false;
    this.style = { display: '' };
    this.children = [];
    this.parentNode = null;
    this.textContent = '';
    this._listeners = {};
    if (this.id) {
      domById.set(this.id, this);
    }
  }
  visible() {
    return this.style.display !== 'none';
  }
  focus() {
    this.focused = true;
  }
  show() {
    this.style.display = '';
    return this;
  }
  hide() {
    this.style.display = 'none';
    return this;
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
    if (this.id && domById.get(this.id) === this) {
      domById.delete(this.id);
    }
    if (this.parentNode) {
      this.parentNode.children = this.parentNode.children.filter((c) => c !== this);
      this.parentNode = null;
    }
  }
  childElements() {
    return this.children.slice();
  }
  down(selector) {
    const matchClass = selector.startsWith('.') ? selector.slice(1) : null;
    const queue = [...this.children];
    while (queue.length > 0) {
      const cur = queue.shift();
      if (matchClass && cur.className.split(/\s+/).includes(matchClass)) {
        return cur;
      }
      queue.push(...cur.children);
    }
    return null;
  }
  select() {
    return [];
  }
  addClassName(cls) {
    const parts = new Set(this.className.split(/\s+/).filter(Boolean));
    parts.add(cls);
    this.className = [...parts].join(' ');
  }
  removeClassName(cls) {
    this.className = this.className.split(/\s+/).filter((c) => c && c !== cls).join(' ');
  }
  writeAttribute(k, v) {
    this.attributes[k] = v;
    return this;
  }
  readAttribute(k) {
    return this.attributes[k];
  }
  setStyle(styles) {
    Object.assign(this.style, styles);
    return this;
  }
  observe(evt, fn) {
    (this._listeners[evt] = this._listeners[evt] || []).push(fn);
    return this;
  }
}

const domById = new Map();
function registerSubtree(el) {
  if (el.id) domById.set(el.id, el);
  el.children.forEach(registerSubtree);
}

globalThis.Element = Object.assign(FakeElement, {
  observe(el, evt, fn) {
    if (el && el.observe) el.observe(evt, fn);
  }
});
globalThis.$ = (id) => (typeof id === 'string' ? domById.get(id) || null : id);
globalThis.$$ = () => ({ invoke() {} });

globalThis.document = {
  documentElement: { getAttribute: () => 'en' },
  body: new FakeElement('body'),
  observe() {},
  fire() {},
  querySelectorAll() {
    return [];
  }
};

const storage = new Map();
globalThis.localStorage = {
  getItem: (k) => (storage.has(k) ? storage.get(k) : null),
  setItem: (k, v) => storage.set(k, String(v)),
  clear: () => storage.clear()
};

const { default: PedigreeEditorParameters } = await import('../src/script/pedigreeEditorParameters.js');
const { default: PedigreeOverlay } = await import('../src/script/view/pedigreeOverlay.js');
const { default: DisorderLegend } = await import('../src/script/view/disorderLegend.js');
const { default: LabelOptionsSelector } = await import('../src/script/view/labelOptionsSelector.js');
const { toPortuguese } = await import('../src/script/i18n.js');

function createMockPaper() {
  const elements = [];
  const makeEl = (type, extra = {}) => {
    const el = {
      type,
      attrs: { ...extra },
      removed: false,
      node: {
        attributes: {},
        style: {},
        setAttribute(k, v) {
          this.attributes[k] = v;
        },
        getAttribute(k) {
          return this.attributes[k];
        }
      },
      attr(a) {
        if (typeof a === 'object') Object.assign(this.attrs, a);
        return this;
      },
      getBBox() {
        return { x: (this.attrs.x || 0) - 20, y: (this.attrs.y || 0) - 8, width: 40, height: 16 };
      },
      toFront() {
        return this;
      },
      insertAfter() {
        return this;
      },
      click() {
        return this;
      },
      remove() {
        this.removed = true;
      }
    };
    elements.push(el);
    return el;
  };
  return {
    elements,
    text: (x, y, content) => makeEl('text', { x, y, text: content }),
    rect: (x, y, w, h, r) => makeEl('rect', { x, y, width: w, height: h, r }),
    circle: (x, y, r) => makeEl('circle', { x, y, r }),
    path: (d) => makeEl('path', { path: d })
  };
}

test('PedigreeOverlay omits Wright inbreeding coefficient (F) when consanguineous couple is in a collapsed branch', () => {
  // Pedigree:
  // 7 (M) + 8 (F) -> siblings 3 (M) and 5 (F)
  // 3 (M) + 4 (F) -> cousin 1 (M)
  // 5 (F) + 6 (M) -> cousin 2 (F)
  // Relationship 9 joins first cousins 1 and 2 -> F = 1/16
  // Proband 0 is on another branch; collapsing person 3 hides the branch containing couple 9.
  let branchCollapsed = false;
  const hiddenWhenCollapsed = new Set([1, 2, 9]);

  const parentsMap = {
    0: [],
    7: [],
    8: [],
    4: [],
    6: [],
    3: [7, 8],
    5: [7, 8],
    1: [3, 4],
    2: [5, 6],
    9: [1, 2]
  };

  const nodes = {};
  for (let id = 0; id <= 9; id++) {
    nodes[id] = {
      getID: () => id,
      getX: () => 100 + id * 30,
      getY: () => 200,
      isVirtual: () => false,
      getCollapsed: () => (id === 3 ? branchCollapsed : false),
      getHistoryUnknown: () => false,
      getArtRole: () => '',
      getArtKey: () => null,
      getArtLinks: () => [],
      ...(id === 9
        ? {
            getConsanguinity: () => 'A',
            getRelationDegree: () => '',
            isArtLink: () => false
          }
        : {})
    };
  }

  const graph = {
    getMaxNodeId: () => 9,
    isRelationship: (id) => id === 9,
    isPerson: (id) => id !== 9,
    isPlaceholder: () => false,
    isVirtualDummyChild: () => false,
    isVirtualParent: () => false,
    isAdopted: () => false,
    isConsangrRelationship: (id) => id === 9,
    isSingleParentRelationship: () => false,
    isParentlessRelationship: () => false,
    isHiddenBranch: (id) => branchCollapsed && hiddenWhenCollapsed.has(id),
    getBranchSize: (id) => (id === 3 ? 2 : 0),
    getGender: (id) => ([7, 3, 6, 1, 0].includes(id) ? 'M' : 'F'),
    getProperties: () => ({}),
    getParentRelationship: () => null,
    DG: {
      GG: {
        getParents: (id) => parentsMap[id] || []
      }
    }
  };

  const paper = createMockPaper();
  globalThis.editor = {
    getPaper: () => paper,
    getGraph: () => graph,
    getNode: (id) => nodes[id] || null,
    getWorkspace: () => ({ background: null, getWorkArea: () => new FakeElement('div') })
  };

  const overlay = new PedigreeOverlay();
  overlay.setInbreedingVisible(true);

  const activeInbreedingLabels = () =>
    paper.elements.filter(
      (el) => !el.removed && el.type === 'text' && el.node.getAttribute('data-opx-overlay') === 'inbreeding'
    );

  assert.equal(activeInbreedingLabels().length, 1, 'F label is drawn when couple is visible');
  assert.equal(activeInbreedingLabels()[0].attrs.text, 'F = 1/16');

  // Collapse the branch containing the consanguineous couple
  branchCollapsed = true;
  overlay.redraw();
  assert.equal(activeInbreedingLabels().length, 0, 'F label is removed when couple branch is collapsed');

  // Expand the branch again
  branchCollapsed = false;
  overlay.redraw();
  assert.equal(activeInbreedingLabels().length, 1, 'F label returns when couple branch is expanded');
});

test('DisorderLegend hides conditions of collapsed or deleted/renumbered individuals', () => {
  domById.clear();
  const workArea = new FakeElement('div', { id: 'work-area' });
  let hiddenSet = new Set();
  const viewNodes = new Map();

  const makePersonNode = (id, disorders) => ({
    _id: id,
    _disorders: [...disorders],
    getID() { return this._id; },
    getDisorders() { return this._disorders; },
    isVirtual: () => false,
    isHiddenBranch: () => hiddenSet.has(id),
    getGraphics: () => ({ updateDisorderShapes() {}, highlight() {}, unHighlight() {} })
  });

  viewNodes.set(0, makePersonNode(0, []));
  viewNodes.set(1, makePersonNode(1, ['Fabry__disease']));
  viewNodes.set(5, makePersonNode(5, ['Fabry__disease', 'Huntington__disease']));

  const graph = {
    isValidID: (id) => viewNodes.has(Number(id)),
    isPerson: (id) => viewNodes.has(Number(id)),
    isVirtualParent: () => false,
    isVirtualDummyChild: () => false,
    isPlaceholder: () => false,
    isHiddenBranch: (id) => hiddenSet.has(Number(id))
  };

  globalThis.editor = {
    getWorkspace: () => ({ getWorkArea: () => workArea }),
    getGraph: () => graph,
    getView: () => ({
      getNode: (id) => viewNodes.get(Number(id)) || null,
      updateAllLabels() {},
      updateAllNodeColors() {}
    }),
    getNode: (id) => viewNodes.get(Number(id)) || null,
    getPedigreeInfo: () => null
  };

  const legend = new DisorderLegend();
  legend.addCase('Fabry__disease', 'Fabry disease', 1);
  legend.addCase('Fabry__disease', 'Fabry disease', 5);
  legend.addCase('Huntington__disease', 'Huntington disease', 5);

  const fabryItem = legend._getListElementForObjectWithID('Fabry__disease');
  const hdItem = legend._getListElementForObjectWithID('Huntington__disease');
  assert.equal(legend._legendBox.style.display, '', 'legend box is visible');
  assert.equal(fabryItem.down('.disorder-cases').textContent, '2&nbsp;cases');
  assert.equal(hdItem.style.display, '', 'Huntington item is visible');

  // 1) Collapse branch containing node 5: Huntington disappears from legend and Fabry drops to 1 case
  hiddenSet = new Set([5]);
  legend.syncWithView();
  assert.equal(hdItem.style.display, 'none', 'condition exclusive to hidden branch is hidden');
  assert.equal(fabryItem.style.display, '', 'condition still on visible node 1 remains shown');
  assert.equal(fabryItem.down('.disorder-cases').textContent, '1&nbsp;case');

  // If node 1 were also hidden, the entire Disorders legend box hides
  hiddenSet = new Set([1, 5]);
  legend.syncWithView();
  assert.equal(legend._legendBox.style.display, 'none', 'legend box hides when all affected individuals are hidden');

  // Expanding restores both items and counts
  hiddenSet = new Set();
  legend.syncWithView();
  assert.equal(legend._legendBox.style.display, '');
  assert.equal(hdItem.style.display, '');
  assert.equal(fabryItem.down('.disorder-cases').textContent, '2&nbsp;cases');

  // 2) Delete an earlier node so node 5 shifts down to ID 4, then delete node 4:
  // replaceIDs + removeCase / syncWithView must leave zero ghost entries
  const node5 = viewNodes.get(5);
  viewNodes.delete(5);
  node5._id = 4;
  viewNodes.set(4, node5);
  legend.replaceIDs({ 5: 4 });

  // Now remove node 4 completely
  viewNodes.delete(4);
  legend.removeCase('Huntington__disease', 4);
  legend.removeCase('Fabry__disease', 4);
  legend.syncWithView();

  assert.equal(legend._hasAffectedNodes('Huntington__disease'), false, 'Huntington is completely removed after renumbered node is deleted');
  assert.equal(legend._getListElementForObjectWithID('Huntington__disease'), null);
  assert.equal(fabryItem.down('.disorder-cases').textContent, '1&nbsp;case');
});

test('LabelOptionsSelector supports hiding and restoring Colour by disorder (colour by disorder)', () => {
  domById.clear();
  storage.clear();
  const workArea = new FakeElement('div', { id: 'work-area' });
  let colorUpdates = 0;

  const graph = {
    isValidID: (id) => id === 0,
    isPerson: (id) => id === 0,
    isVirtualParent: () => false,
    isVirtualDummyChild: () => false,
    isPlaceholder: () => false,
    isHiddenBranch: () => false
  };

  let disorderLegend;
  const geneLegend = { setEnabled() {}, isEnabled: () => true };

  globalThis.editor = {
    getWorkspace: () => ({ getWorkArea: () => workArea }),
    getGraph: () => graph,
    getDisorderLegend: () => disorderLegend,
    getGeneLegend: () => geneLegend,
    getView: () => ({
      getNode: () => ({
        getDisorders: () => ['Fabry__disease'],
        isVirtual: () => false
      }),
      updateAllNodeColors() { colorUpdates++; },
      updateAllLabels() {}
    }),
    getPedigreeInfo: () => null
  };

  disorderLegend = new DisorderLegend();
  disorderLegend.addCase('Fabry__disease', 'Fabry disease', 0);
  assert.equal(disorderLegend.isEnabled(), true);
  assert.equal(disorderLegend._legendBox.style.display, '');

  const selector = new LabelOptionsSelector();
  assert.equal(PedigreeEditorParameters.attributes.colorByDisorder, true);

  // Turn off Colour by disorder
  selector.saveSettings({ colorByDisorder: false, colorByGene: true });
  assert.equal(PedigreeEditorParameters.attributes.colorByDisorder, false);
  assert.equal(disorderLegend.isEnabled(), false);
  assert.equal(disorderLegend._legendBox.style.display, 'none', 'Disorders legend box is hidden when colour by disorder is off');
  assert.equal(colorUpdates, 1, 'triggers node colour refresh');

  // Reloading settings from localStorage preserves colorByDisorder = false
  const reloaded = new LabelOptionsSelector();
  assert.ok(reloaded);
  assert.equal(PedigreeEditorParameters.attributes.colorByDisorder, false);
  assert.equal(disorderLegend.isEnabled(), false);

  // Turn Colour by disorder back on
  selector.saveSettings({ colorByDisorder: true, colorByGene: true });
  assert.equal(PedigreeEditorParameters.attributes.colorByDisorder, true);
  assert.equal(disorderLegend.isEnabled(), true);
  assert.equal(disorderLegend._legendBox.style.display, '', 'Disorders legend box reappears when colour by disorder is turned back on');
  assert.equal(colorUpdates, 2);

  // Verify Portuguese translation exists
  assert.equal(toPortuguese('Colour by disorder'), 'Colorir por condição');
});

test('SearchPanel ("Find people") places "Name, ID or comment" first and selects it by default', async () => {
  const { default: SearchPanel } = await import('../src/script/view/searchPanel.js');
  domById.clear();
  const workArea = new FakeElement('div', { id: 'work-area' });

  const graph = {
    getMaxNodeId: () => 0,
    isPerson: (id) => id === 0,
    isPlaceholder: () => false,
    isVirtualDummyChild: () => false,
    isVirtualParent: () => false,
    getProbandId: () => 0
  };

  globalThis.editor = {
    getGraph: () => graph,
    getNode: (id) => (id === 0 ? { getDisorders: () => [], getHPO: () => [], getGeneticTests: () => [], getAncestry: () => [] } : null),
    getOverlay: () => ({
      clearSearchHighlight() {},
      setSearchHighlight() {},
      setSearchLegendVisible() {}
    })
  };

  const panel = new SearchPanel();
  panel.show();

  assert.equal(panel._filters.length, 1);
  assert.equal(panel._filters[0].field, 'name', 'default filter field is "name" ("Name, ID or comment")');
  assert.equal(panel._filters[0].op, 'contains');

  const fieldSelect = panel._panel.down('.search-field');
  assert.ok(fieldSelect, 'filter field select is rendered');
  const options = fieldSelect.childElements();
  assert.ok(options.length > 0);
  assert.equal(options[0].value, 'name', '"Name, ID or comment" is the first option in the dropdown');
  assert.equal(options[0].textContent, 'Name, ID or comment');
  assert.equal(options[0].selected, true);

  // Clearing resets back to "name" as default
  panel._filters = [{ field: 'sex', op: 'is', value: 'F', value2: '' }];
  panel.clear();
  assert.equal(panel._filters.length, 1);
  assert.equal(panel._filters[0].field, 'name', 'clear() resets default filter to "name"');
});
