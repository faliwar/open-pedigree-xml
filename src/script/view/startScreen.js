import { translate } from 'pedigree/i18n';

/* global __APP_VERSION__ */
// "1.4" from package.json "1.4.0": What's new is shown once per minor version, not for bug-fix releases
var APP_VERSION = String(typeof __APP_VERSION__ !== 'undefined' ? __APP_VERSION__ : '').split('.').slice(0, 2).join('.');
var WELCOME_KEY = 'openpedigree_welcome_v1';
var VERSION_KEY = 'openpedigree_seen_version';

var store = {
  get: function(k) {
    try { return localStorage.getItem(k); } catch (e) { return null; }
  },
  set: function(k, v) {
    try { localStorage.setItem(k, v); } catch (e) {}
  }
};

// What's new in this version: [title, description, action]. Update it for each minor release.
var NEWS = [
  ['Assisted reproduction (D / S)', 'Gamete donors (D) and surrogates (S) with an interactive linking handle, plus biological vs. gestational kinship in cascade testing and summaries.', null],
  ['Bennett 2008 / 2022 nomenclature', 'Sex assigned at birth (AMAB, AFAB, UAAB) distinct from gender, childless/infertility reason, consanguineous degree label and unknown family history (?).', null],
  ['Cascade testing saved in XML & PDF', 'Cascade testing settings and selected relatives are saved inside Invitae/Progeny XML and PDF files.', function() { editor.getCascadeTestingDialog().show(); }],
  ['Custom condition colors in XML', 'Condition colors chosen in the legend (#RRGGBB) are saved and restored when importing XML or PDF.', null],
  ['External identifier privacy & display', 'Show or hide external identifiers under Label Display Options, and automatically strip them when exporting without personal information.', function() { editor.getLabelOptionsSelector().show(); }],
  ['Manual twin linking & layout', 'Link existing siblings as twins from the node menu, and keep single-parent and donor symbols compact.', null]
];

var timeAgo = function(savedAt) {
  // new Date().getTime(), not Date.now(): a vendor script replaces Date.now
  var then = new Date(savedAt).getTime();
  if (!isFinite(then)) return '';
  var min = Math.max(0, Math.round((new Date().getTime() - then) / 60000));
  if (min < 1) return translate('just now');
  if (min < 60) return translate('{n} min ago').replace('{n}', min);
  var h = Math.round(min / 60);
  if (h < 24) return translate('{n} h ago').replace('{n}', h);
  var d = Math.round(h / 24);
  return translate(d === 1 ? '1 day ago' : '{n} days ago').replace('{n}', d);
};

/**
 * What the user sees when the editor opens:
 *  - a saved draft exists: offer to restore it;
 *  - first visit: a welcome card with the ways to start (template, import, AI from clinical notes);
 *  - returning user after an update: a small "What's new" card (once per version).
 *
 * @class StartScreen
 */
var StartScreen = Class.create({

  initialize: function(draftStore) {
    this._drafts = draftStore;
    this.dialog = null;
    this._news = null;
  },

  /** Called once the startup pedigree is on screen */
  start: function() {
    if (editor.isReadOnlyMode()) return;
    var draft = this._drafts && this._drafts.get();
    var firstVisit = !store.get(WELCOME_KEY);
    if (draft) {
      this._showRestore(draft);
    } else if (firstVisit) {
      this._showWelcome();
    } else {
      this.maybeShowNews();
    }
  },

  _close: function() {
    if (this.dialog) {
      var d = this.dialog;
      this.dialog = null;
      try { d.close(); } catch (e) {}
      if (d.dialog && d.dialog.parentNode) d.dialog.remove();
    }
  },

  // closes the card (once) and continues the startup, then runs the chosen action
  _finish: function(action) {
    var wasOpen = !!this.dialog;
    this._close();
    if (wasOpen) this._afterStart();
    if (action) action();
  },

  _open: function(content, title) {
    var _this = this;
    this._close();
    // no X button: it closes the popup without telling us; Esc and the card's buttons do
    this.dialog = new PhenoTips.widgets.ModalPopup(content, {
      close: { method: function() { _this._finish(); }, keys: ['Esc'] }
    }, {
      extraClassName: 'start-modal-box',
      title: title,
      displayCloseButton: false,
      removeOnClose: true
    });
    this.dialog.show();
  },

  // after the first card closes: remember the welcome, then maybe show what's new
  _afterStart: function() {
    var wasFirst = !store.get(WELCOME_KEY);
    store.set(WELCOME_KEY, '1');
    if (wasFirst) {
      // new users get the whole app; no need to list what changed
      store.set(VERSION_KEY, APP_VERSION);
    } else {
      this.maybeShowNews();
    }
  },

  _button: function(label, cls, handler) {
    var b = new Element('button', { 'type': 'button', 'class': 'start-btn ' + (cls || '') }).update(translate(label));
    b.observe('click', handler);
    return b;
  },

  _showRestore: function(draft) {
    var _this = this;
    var content = new Element('div', { 'class': 'start-content' });
    var card = new Element('div', { 'class': 'start-draft', 'data-no-translate': '1' });
    card.insert(new Element('span', { 'class': 'fa fa-file-medical start-draft-icon', 'aria-hidden': 'true' }));
    var text = new Element('div');
    text.insert(new Element('div', { 'class': 'start-draft-title' }).update((draft.label || translate('Untitled pedigree')).escapeHTML()));
    var meta = [];
    if (draft.people) meta.push(draft.people + ' ' + translate(draft.people === 1 ? 'person' : 'people'));
    var ago = timeAgo(draft.savedAt);
    if (ago) meta.push(translate('edited') + ' ' + ago);
    text.insert(new Element('div', { 'class': 'start-draft-meta' }).update(meta.join(' · ').escapeHTML()));
    card.insert(text);
    content.insert(new Element('p', { 'class': 'start-lead' }).update(translate('Your last pedigree was saved in this browser.')));
    content.insert(card);

    var buttons = new Element('div', { 'class': 'start-buttons' });
    buttons.insert(this._button('Start a new one', '', function() {
      _this._drafts.discard();
      _this._finish();
    }));
    buttons.insert(this._button('Restore', 'is-primary', function() {
      _this._finish(function() { _this._drafts.restore(draft); });
    }));
    content.insert(buttons);
    this._open(content, translate('Continue where you left off?'));
    buttons.down('.is-primary').focus();
  },

  _showWelcome: function() {
    var _this = this;
    var content = new Element('div', { 'class': 'start-content' });
    content.insert(new Element('p', { 'class': 'start-lead' }).update(
      translate('Draw and edit pedigrees in the browser. Nothing leaves your computer unless you export it.')));

    var options = new Element('div', { 'class': 'start-options' });
    var option = function(icon, title, text, handler) {
      var b = new Element('button', { 'type': 'button', 'class': 'start-option' });
      b.insert(new Element('span', { 'class': 'fa fa-' + icon + ' start-option-icon', 'aria-hidden': 'true' }));
      b.insert(new Element('span', { 'class': 'start-option-title' }).update(translate(title)));
      b.insert(new Element('span', { 'class': 'start-option-text' }).update(translate(text)));
      b.observe('click', function() {
        _this._finish(handler);
      });
      options.insert(b);
    };
    option('copy', 'Start from a template', 'Common family structures to build on.', function() { editor.getTemplateSelector().show(); });
    option('file-import', 'Import a file', 'Progeny/Invitae XML, PED, GEDCOM, BOADICEA or a PDF saved here.', function() { editor.getImportSelector().show(); });
    option('robot', 'Generate from clinical notes', 'Copy the instructions to an AI, paste the XML it returns.', function() { editor.getImportSelector().show(); });
    content.insert(options);

    var footer = new Element('div', { 'class': 'start-buttons' });
    footer.insert(new Element('span', { 'class': 'start-hint' }).update(translate('Tip: press ? at any time to see the keyboard shortcuts.')));
    footer.insert(this._button('Start with a blank trio', 'is-primary', function() {
      _this._finish();
    }));
    content.insert(footer);
    this._open(content, translate('Welcome to Open Pedigree X'));
  },

  // -------------------------------------------------------------------------------------------
  // What's new

  maybeShowNews: function() {
    if (store.get(VERSION_KEY) === APP_VERSION) return;
    this.showNews();
  },

  /** Small card in the corner of the chart; does not block editing */
  showNews: function() {
    var _this = this;
    this.hideNews();
    store.set(VERSION_KEY, APP_VERSION);
    var card = new Element('section', { 'class': 'news-card', 'role': 'dialog', 'aria-label': translate("What's new") });
    var head = new Element('div', { 'class': 'news-head' });
    head.insert(new Element('span', { 'class': 'news-badge' }).update(APP_VERSION));
    head.insert(new Element('h2', { 'class': 'news-title' }).update(translate("What's new")));
    var close = new Element('button', { 'type': 'button', 'class': 'search-icon-btn', 'aria-label': translate('Close'), 'title': translate('Close') }).update('&times;');
    close.observe('click', function() { _this.hideNews(); });
    head.insert(close);
    card.insert(head);
    var list = new Element('ul', { 'class': 'news-list' });
    NEWS.forEach(function(n) {
      var li = new Element('li');
      var title = new Element(n[2] ? 'button' : 'span', n[2] ? { 'type': 'button', 'class': 'news-link' } : { 'class': 'news-item-title' })
        .update(translate(n[0]));
      if (n[2]) {
        title.observe('click', function() {
          _this.hideNews();
          n[2]();
        });
      }
      li.insert(title);
      li.insert(new Element('span', { 'class': 'news-text' }).update(translate(n[1])));
      list.insert(li);
    });
    card.insert(list);
    card.observe('keydown', function(e) {
      if (e.key === 'Escape' || e.key === 'Esc') {
        e.stop();
        _this.hideNews();
      }
    });
    $('work-area').insert(card);
    this._news = card;
  },

  hideNews: function() {
    if (this._news) {
      this._news.remove();
      this._news = null;
    }
  }
});

export default StartScreen;
