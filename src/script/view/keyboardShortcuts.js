import AbstractHoverbox from 'pedigree/view/abstractHoverbox';
import { computeStandardNumbering } from 'pedigree/model/nomenclature';
import { translate } from 'pedigree/i18n';

var IS_MAC = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent || '');
var MOD = IS_MAC ? '⌘' : 'Ctrl';

/**
 * Shortcut list, used both for the help dialog and the toolbar tooltips.
 * Person shortcuts act on the person under the mouse, the person whose menu is open,
 * or the proband when neither applies.
 */
var SHORTCUT_GROUPS = [
  {
    title: 'Person (under the mouse, or the proband)',
    items: [
      ['P', 'Add parents'],
      ['S', 'Add a sibling'],
      ['C', 'Add a child'],
      ['R', 'Add a partner (with a child)'],
      ['M / F / U', 'Set sex: male / female / unknown'],
      ['D', 'Toggle deceased'],
      ['G', 'Genetic tests and diagnosis details'],
      ['Enter', 'Open properties'],
      ['Delete', 'Remove person']
    ]
  },
  {
    title: 'Edit',
    items: [
      [MOD + '+Z', 'Undo'],
      [MOD + '+Y / ' + MOD + '+Shift+Z', 'Redo'],
      ['Esc', 'Close menu or dialog']
    ]
  },
  {
    title: 'View',
    items: [
      ['+ / −', 'Zoom in / out'],
      ['0', 'Center on the proband'],
      ['← ↑ → ↓', 'Pan (Shift: faster)']
    ]
  },
  {
    title: 'Open',
    items: [
      ['T', 'Templates'],
      ['I', 'Import'],
      ['E', 'Export'],
      ['L', 'Labels'],
      ['H', 'Modification history'],
      ['K', 'Cascade testing'],
      ['/ / ' + MOD + '+F', 'Find people'],
      ['?', 'Keyboard shortcuts']
    ]
  }
];

// toolbar item id -> shortcut shown in its tooltip
var TOOLBAR_HINTS = {
  'action-undo': MOD + '+Z',
  'action-redo': MOD + '+Y',
  'action-templates': 'T',
  'action-import': 'I',
  'action-export': 'E',
  'action-labels': 'L',
  'action-history': 'H',
  'action-cascade': 'K',
  'action-search': '/',
  'action-shortcuts': '?'
};

var PAN_STEP = 80;

/**
 * Keyboard shortcuts for the pedigree editor.
 *
 * @class KeyboardShortcuts
 */
var KeyboardShortcuts = Class.create({

  initialize: function() {
    var _this = this;
    this.dialog = null;
    this._toast = null;
    this._toastTimer = null;
    document.observe('keydown', function(e) { _this._onKeyDown(e); });
    this._addToolbarHints();
  },

  _addToolbarHints: function() {
    Object.keys(TOOLBAR_HINTS).forEach(function(id) {
      var el = $(id);
      if (el) {
        var label = (el.textContent || '').trim();
        el.writeAttribute('title', label + ' (' + TOOLBAR_HINTS[id] + ')');
      }
    });
  },

  // -------------------------------------------------------------------------------------------
  // Event filtering

  _isTyping: function(target) {
    if (!target || !target.tagName) return false;
    var tag = target.tagName.toLowerCase();
    return tag === 'input' || tag === 'textarea' || tag === 'select' || target.isContentEditable;
  },

  _isDialogOpen: function() {
    var boxes = document.querySelectorAll('.msdialog-box, .xdialog-box');
    for (var i = 0; i < boxes.length; i++) {
      if (boxes[i].offsetParent !== null) return true;
    }
    return false;
  },

  _isNodeMenuOpen: function() {
    return !!(editor.getNodeMenu && editor.getNodeMenu() && editor.getNodeMenu().isVisible()) ||
      !!(editor.getNodeGroupMenu && editor.getNodeGroupMenu() && editor.getNodeGroupMenu().isVisible()) ||
      !!(editor.getPartnershipMenu && editor.getPartnershipMenu() && editor.getPartnershipMenu().isVisible());
  },

  _onKeyDown: function(e) {
    if (typeof editor === 'undefined' || !editor || editor.isReadOnlyMode()) return;
    var key = e.key;

    if (key === 'Escape' || key === 'Esc') {
      // dialogs close themselves on Esc; here we close node menus, bubbles and pinned hoverboxes
      if (!this._isDialogOpen()) this._closeMenus();
      return;
    }

    if (this._isTyping(e.target) || this._isDialogOpen()) return;
    if (e.altKey) return;

    var mod = IS_MAC ? e.metaKey : e.ctrlKey;
    var lower = key && key.length === 1 ? key.toLowerCase() : key;

    if (mod) {
      if (lower === 'z' && !e.shiftKey) return this._run(e, function() { document.fire('pedigree:undo'); });
      if ((lower === 'z' && e.shiftKey) || lower === 'y') return this._run(e, function() { document.fire('pedigree:redo'); });
      if (lower === 'f' && !e.shiftKey) return this._run(e, function() { this._closeMenus(); editor.getSearchPanel().show(); });
      return; // leave all other browser shortcuts alone
    }
    if (e.ctrlKey || e.metaKey) return;

    // view: allow auto-repeat while the key is held
    switch (key) {
      case '+':
      case '=':
        return this._run(e, this._zoomBy.bind(this, +0.15));
      case '-':
      case '_':
        return this._run(e, this._zoomBy.bind(this, -0.15));
      case 'ArrowLeft':
        return this._run(e, this._pan.bind(this, -1, 0, e.shiftKey));
      case 'ArrowRight':
        return this._run(e, this._pan.bind(this, 1, 0, e.shiftKey));
      case 'ArrowUp':
        return this._run(e, this._pan.bind(this, 0, -1, e.shiftKey));
      case 'ArrowDown':
        return this._run(e, this._pan.bind(this, 0, 1, e.shiftKey));
    }
    if (e.repeat) return;

    // "?" is Shift+/ on US layouts and Shift+the key next to right Shift on ABNT2 (Brazil)
    if (key === '?' || (e.shiftKey && (e.code === 'Slash' || e.code === 'IntlRo'))) {
      return this._run(e, this.show.bind(this));
    }
    if (key === '/') return this._run(e, function() { this._closeMenus(); editor.getSearchPanel().show(); });
    if (key === '0') return this._run(e, function() { editor.getWorkspace().centerAroundNode(editor.getGraph().getProbandId()); });

    var openers = {
      t: function() { editor.getTemplateSelector().show(); },
      i: function() { editor.getImportSelector().show(); },
      e: function() { editor.getExportSelector().show(); },
      l: function() { editor.getLabelOptionsSelector().show(); },
      h: function() { editor.getHistory().show(); },
      k: function() { editor.getCascadeTestingDialog().show(); }
    };
    if (openers[lower] && !this._isNodeMenuOpen()) {
      return this._run(e, openers[lower]);
    }

    var personActions = {
      p: this._addParents, s: this._addSibling, c: this._addChild, r: this._addPartner,
      m: this._setSex.bind(this, 'M'), f: this._setSex.bind(this, 'F'), u: this._setSex.bind(this, 'U'),
      d: this._toggleDeceased, g: this._openClinical, Enter: this._openMenu, Delete: this._remove, Backspace: this._remove
    };
    var action = personActions[lower] || personActions[key];
    if (action) {
      this._run(e, action.bind(this));
    }
  },

  _run: function(e, fn) {
    e.preventDefault();
    if (e.stop) e.stop();
    try {
      fn.call(this);
    } catch (err) {
      console.warn('Keyboard shortcut failed:', err);
    }
  },

  // -------------------------------------------------------------------------------------------
  // Target person

  _getTarget: function() {
    var menu = editor.getNodeMenu && editor.getNodeMenu();
    if (menu && menu.isVisible() && menu.targetNode) {
      return menu.targetNode;
    }
    var groupMenu = editor.getNodeGroupMenu && editor.getNodeGroupMenu();
    if (groupMenu && groupMenu.isVisible() && groupMenu.targetNode) {
      return groupMenu.targetNode;
    }
    var hb = AbstractHoverbox.pinnedHoverbox || AbstractHoverbox.activeHoverbox;
    var hovered = hb && hb.getNode && hb.getNode();
    if (hovered && hovered.getType && (hovered.getType() === 'Person' || hovered.getType() === 'PersonGroup')) {
      return hovered;
    }
    return editor.getNode(editor.getGraph().getProbandId());
  },

  _isPerson: function(node) {
    return node && node.getType && node.getType() === 'Person';
  },

  _label: function(node) {
    var id = node.getID();
    var name = node.getName ? node.getName() : '';
    var std = computeStandardNumbering(editor).byId[id];
    if (name && std) return name + ' (' + std.label + ')';
    return name || (std ? std.label : translate('the proband'));
  },

  // Hides the hoverbox of the node before its graphics are rebuilt, as clicking a handle does
  _releaseHoverbox: function(node) {
    var hb = node.getGraphics && node.getGraphics().getHoverBox && node.getGraphics().getHoverBox();
    if (hb) {
      try {
        if (hb.isMenuToggled && hb.isMenuToggled()) hb.toggleMenu(false);
        hb.unpin && hb.unpin(true);
        hb.animateHideHoverZone(true);
      } catch (e) {}
    }
  },

  _personOnly: function(node) {
    if (!this._isPerson(node)) {
      this.toast(translate('This shortcut works on a single person.'));
      return false;
    }
    return true;
  },

  _addParents: function() {
    var node = this._getTarget();
    if (!this._personOnly(node)) return;
    var graph = editor.getGraph();
    var rel = graph.getParentRelationship(node.getID());
    if (!(rel === null || graph.isParentlessRelationship(rel) || graph.isSingleParentRelationship(rel))) {
      this.toast(translate('Already has both parents:') + ' ' + this._label(node));
      return;
    }
    var label = this._label(node);
    this._releaseHoverbox(node);
    document.fire('pedigree:person:newparent', { personID: node.getID() });
    this.toast(translate('Added parents of') + ' ' + label);
  },

  _addSibling: function() {
    var node = this._getTarget();
    if (!this._personOnly(node)) return;
    var label = this._label(node);
    this._releaseHoverbox(node);
    document.fire('pedigree:person:newsibling', { personID: node.getID(), childParams: { gender: 'U' }, preferLeft: false });
    this.toast(translate('Added a sibling of') + ' ' + label);
  },

  _addChild: function() {
    var node = this._getTarget();
    if (!this._personOnly(node)) return;
    if (node.isFetus && node.isFetus()) {
      this.toast(translate('A pregnancy cannot have children.'));
      return;
    }
    if (node.getChildlessStatus && node.getChildlessStatus() !== null) {
      this.toast(translate('Marked as childless or infertile:') + ' ' + this._label(node));
      return;
    }
    var label = this._label(node);
    this._releaseHoverbox(node);
    document.fire('pedigree:person:newchildonly', { personID: node.getID(), childParams: { gender: 'U' }, preferLeft: false });
    this.toast(translate('Added a child of') + ' ' + label);
  },

  _addPartner: function() {
    var node = this._getTarget();
    if (!this._personOnly(node)) return;
    if (node.isFetus && node.isFetus()) {
      this.toast(translate('A pregnancy cannot have a partner.'));
      return;
    }
    var label = this._label(node);
    this._releaseHoverbox(node);
    document.fire('pedigree:person:newpartnerandchild', { personID: node.getID(), preferLeft: node.getGender() === 'F' });
    this.toast(translate('Added a partner of') + ' ' + label);
  },

  _setSex: function(sex) {
    var node = this._getTarget();
    if (!node || !node.getGender) return;
    if (node.getGender() === sex) return;
    var possible = editor.getGraph().getPossibleGenders(node.getID());
    if (!possible[sex]) {
      this.toast(translate('Sex not allowed: a partner already has this sex.'));
      return;
    }
    document.fire('pedigree:node:setproperty', { nodeID: node.getID(), properties: { setGender: sex } });
    var names = { M: 'male', F: 'female', U: 'unknown' };
    this.toast(this._label(node) + ': ' + translate(names[sex]));
  },

  _toggleDeceased: function() {
    var node = this._getTarget();
    if (!node || !node.getLifeStatus) return;
    var status = node.getLifeStatus();
    var next = (status === 'alive') ? 'deceased' : (status === 'deceased' ? 'alive' : null);
    if (!next) {
      this.toast(translate('Change this life status in the properties menu.'));
      return;
    }
    document.fire('pedigree:node:setproperty', { nodeID: node.getID(), properties: { setLifeStatus: next } });
    this.toast(this._label(node) + ': ' + translate(next === 'deceased' ? 'deceased' : 'alive'));
  },

  _openClinical: function() {
    var node = this._getTarget();
    if (!this._personOnly(node)) return;
    this._closeMenus();
    editor.getClinicalDetailsDialog().show(node);
  },

  _openMenu: function() {
    var node = this._getTarget();
    var hb = node && node.getGraphics && node.getGraphics().getHoverBox && node.getGraphics().getHoverBox();
    if (hb && hb.toggleMenu && !(hb.isMenuToggled && hb.isMenuToggled())) {
      hb.toggleMenu(true);
    }
  },

  _remove: function() {
    var node = this._getTarget();
    if (!node) return;
    if ((node.isProband && node.isProband()) || node.getID() === 0) {
      this.toast(translate('The proband cannot be removed.'));
      return;
    }
    var label = this._label(node);
    this._closeMenus();
    this._releaseHoverbox(node);
    document.fire('pedigree:node:remove', { nodeID: node.getID() });
    this.toast(translate('Removed') + ' ' + label);
  },

  _closeMenus: function() {
    ['getNodeMenu', 'getNodeGroupMenu', 'getPartnershipMenu'].forEach(function(getter) {
      var m = editor[getter] && editor[getter]();
      if (m && m.isVisible && m.isVisible()) m.hide();
    });
    ['getNodetypeSelectionBubble', 'getSiblingSelectionBubble'].forEach(function(getter) {
      var b = editor[getter] && editor[getter]();
      if (b && b.hide) {
        try { b.hide(); } catch (e) {}
      }
    });
    AbstractHoverbox.unpinAll && AbstractHoverbox.unpinAll(true);
  },

  // -------------------------------------------------------------------------------------------
  // View

  _zoomBy: function(delta) {
    var ws = editor.getWorkspace();
    var cur = ws.zoomCoefficient || 1;
    var next = Math.min(1.25, Math.max(0.15, Math.round((cur + delta) * 100) / 100));
    if (Math.abs(next - cur) > 0.001) ws.zoom(next);
  },

  _pan: function(dx, dy, fast) {
    var ws = editor.getWorkspace();
    var zoom = ws.zoomCoefficient || 1;
    var step = (fast ? PAN_STEP * 4 : PAN_STEP) / zoom;
    ws.panTo((ws.viewBoxX || 0) + dx * step, (ws.viewBoxY || 0) + dy * step, true);
  },

  // -------------------------------------------------------------------------------------------
  // Feedback and help

  toast: function(message) {
    var workArea = $('work-area');
    if (!workArea) return;
    if (!this._toast) {
      this._toast = new Element('div', { 'class': 'shortcut-toast', 'role': 'status', 'aria-live': 'polite' });
      workArea.insert(this._toast);
    }
    this._toast.update(String(message).escapeHTML());
    this._toast.addClassName('is-visible');
    var t = this._toast;
    clearTimeout(this._toastTimer);
    this._toastTimer = setTimeout(function() { t.removeClassName('is-visible'); }, 2200);
  },

  show: function() {
    var _this = this;
    // The dialog's own X button closes it without telling us, so never trust a stale reference
    if (this.dialog) {
      this.hide();
    }
    var content = new Element('div', { 'class': 'shortcuts-dialog-content' });
    SHORTCUT_GROUPS.forEach(function(group) {
      var section = new Element('section', { 'class': 'shortcuts-group' });
      section.insert(new Element('h3').update(translate(group.title)));
      var list = new Element('dl', { 'class': 'shortcuts-list' });
      group.items.forEach(function(item) {
        var keys = new Element('dt');
        item[0].split(' / ').forEach(function(k, idx) {
          if (idx > 0) keys.insert(' / ');
          keys.insert(new Element('kbd').update(k.escapeHTML()));
        });
        list.insert(keys);
        list.insert(new Element('dd').update(translate(item[1])));
      });
      section.insert(list);
      content.insert(section);
    });
    content.insert(new Element('p', { 'class': 'shortcuts-note' }).update(
      translate('Shortcuts are paused while you type in a field or a dialog is open.')));

    var closeBtn = new Element('input', { 'type': 'button', 'class': 'button shortcuts-close-btn', 'value': translate('Close') });
    closeBtn.observe('click', function() { _this.hide(); });
    content.insert(new Element('div', { 'class': 'shortcuts-buttons' }).insert(new Element('span', { 'class': 'buttonwrapper' }).insert(closeBtn)));

    this.dialog = new PhenoTips.widgets.ModalPopup(content, {
      close: { method: function() { _this.hide(); }, keys: ['Esc'] }
    }, {
      extraClassName: 'shortcuts-modal-box',
      title: translate('Keyboard shortcuts'),
      displayCloseButton: true,
      removeOnClose: true
    });
    this.dialog.show();
  },

  hide: function() {
    if (this.dialog) {
      var d = this.dialog;
      this.dialog = null;
      try {
        d.close();
      } catch (e) {
        // already closed by its own X button
      }
      if (d.dialog && d.dialog.parentNode) {
        d.dialog.remove();
      }
    }
  }
});

export default KeyboardShortcuts;
