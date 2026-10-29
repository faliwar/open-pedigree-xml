import { formatInfoDate, todayISO } from 'pedigree/model/pedigreeInfo';
import { getLanguage, translate } from 'pedigree/i18n';

/**
 * Header of the pedigree on screen (title; family · date · author; notes) and the dialog that
 * edits it. The same information is printed as header and footer of the PDF.
 *
 * @class PedigreeHeader
 */
var PedigreeHeader = Class.create({

  initialize: function() {
    var _this = this;
    this._band = null;
    this.dialog = null;
    document.observe('pedigree:info:changed', function() { _this.render(); });
  },

  _info: function() {
    return editor.getPedigreeInfo().get();
  },

  /** "Família Silva · 29/10/2026 · Dra. Ana" */
  subtitle: function(info) {
    var parts = [];
    if (info.family) parts.push(translate('Family') + ': ' + info.family);
    if (info.date) parts.push(formatInfoDate(info.date, getLanguage()));
    if (info.author) parts.push(info.author);
    return parts.join(' · ');
  },

  render: function() {
    var workArea = $('work-area');
    if (!workArea || typeof editor === 'undefined' || !editor.getPedigreeInfo) return;
    var info = this._info();
    var show = editor.getPedigreeInfo().hasHeader();
    workArea[show ? 'addClassName' : 'removeClassName']('has-pedigree-header');
    if (!show) {
      if (this._band) this._band.hide();
      return;
    }
    var _this = this;
    if (!this._band) {
      this._band = new Element('div', { 'class': 'pedigree-header', 'data-no-translate': '1' });
      this._band.observe('click', function() {
        if (!editor.isReadOnlyMode()) _this.show();
      });
      workArea.insert(this._band);
    }
    var band = this._band;
    band.update('');
    if (!editor.isReadOnlyMode()) {
      band.writeAttribute('title', translate('Edit the pedigree information'));
      band.addClassName('is-editable');
    }
    if (info.title) band.insert(new Element('div', { 'class': 'pedigree-header-title' }).update(info.title.escapeHTML()));
    var sub = this.subtitle(info);
    if (sub) band.insert(new Element('div', { 'class': 'pedigree-header-sub' }).update(sub.escapeHTML()));
    if (info.notes) band.insert(new Element('div', { 'class': 'pedigree-header-notes' }).update(info.notes.escapeHTML()));
    band.show();
  },

  // -------------------------------------------------------------------------------------------
  // Dialog

  show: function() {
    var _this = this;
    if (this.dialog) this.hide();
    var info = this._info();
    var isNew = !editor.getPedigreeInfo().hasHeader();
    // a new header starts with today's date and the author used in the modification history
    if (isNew) {
      info.date = info.date || todayISO();
      var historyAuthor = editor.getHistory && editor.getHistory() && editor.getHistory().getAuthor();
      info.author = info.author || historyAuthor || '';
    }

    var content = new Element('div', { 'class': 'pedigree-info-content' });
    content.insert(new Element('p', { 'class': 'pedigree-info-intro' }).update(
      translate('Shown above the chart and printed as the header and footer of the PDF.')));

    var inputs = {};
    var field = function(key, label, type, attrs) {
      var wrap = new Element('label', { 'class': 'pedigree-info-field' + (type === 'textarea' ? ' is-wide' : '') });
      wrap.insert(new Element('span', { 'class': 'pedigree-info-label' }).update(translate(label)));
      var input = type === 'textarea'
        ? new Element('textarea', Object.extend({ 'class': 'pedigree-info-input', 'rows': 3 }, attrs || {}))
        : new Element('input', Object.extend({ 'type': type, 'class': 'pedigree-info-input' }, attrs || {}));
      input.value = info[key] || '';
      wrap.insert(input);
      content.insert(wrap);
      inputs[key] = input;
    };
    var grid = content;
    field('title', 'Title', 'text', { 'placeholder': translate('e.g. Hereditary cancer evaluation'), 'maxlength': 120 });
    field('family', 'Family (name or ID)', 'text', { 'maxlength': 80 });
    field('author', 'Author', 'text', { 'maxlength': 80 });
    field('date', 'Date', 'date');
    field('notes', 'Notes (printed at the bottom of the PDF)', 'textarea', { 'maxlength': 600 });
    grid.addClassName('pedigree-info-grid');

    var buttons = new Element('div', { 'class': 'pedigree-info-buttons' });
    var mk = function(label, cls, handler) {
      var b = new Element('input', { 'type': 'button', 'value': translate(label), 'class': 'button ' + (cls || '') });
      b.observe('click', handler);
      buttons.insert(new Element('span', { 'class': 'buttonwrapper' }).insert(b));
    };
    mk('Save', '', function() {
      var data = {};
      Object.keys(inputs).forEach(function(k) { data[k] = inputs[k].value; });
      editor.getPedigreeInfo().update(data, translate('Edited the pedigree information'));
      _this.hide();
    });
    if (!isNew) {
      mk('Remove header', 'secondary', function() {
        editor.getPedigreeInfo().update({ title: '', family: '', author: '', date: '', notes: '' }, translate('Removed the pedigree information'));
        _this.hide();
      });
    }
    mk('Cancel', 'secondary', function() { _this.hide(); });
    content.insert(buttons);

    this.dialog = new PhenoTips.widgets.ModalPopup(content, {
      close: { method: function() { _this.hide(); }, keys: ['Esc'] }
    }, {
      extraClassName: 'pedigree-info-modal-box',
      title: translate('Pedigree information'),
      displayCloseButton: true,
      removeOnClose: true
    });
    this.dialog.show();
    inputs.title.focus();
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

export default PedigreeHeader;
