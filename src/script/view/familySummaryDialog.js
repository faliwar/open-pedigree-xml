import { buildFamilySummary } from 'pedigree/model/familySummary';
import { getLanguage, translate } from 'pedigree/i18n';

/**
 * "Family history summary": the pedigree as one clinical paragraph (English or Portuguese),
 * regenerated as the options change, with a button to copy it into a medical record.
 *
 * @class FamilySummaryDialog
 */
var FamilySummaryDialog = Class.create({

  initialize: function() {
    this.dialog = null;
    this._options = { lang: getLanguage() === 'pt-BR' ? 'pt-BR' : 'en', maxDegree: 3, listUnaffected: true, includeName: true, includeProband: false };
    try {
      var saved = JSON.parse(localStorage.getItem('openpedigree_summary_v2') || '{}');
      ['maxDegree', 'listUnaffected', 'includeName', 'includeProband'].forEach(function(k) {
        if (saved.hasOwnProperty(k)) this._options[k] = saved[k];
      }, this);
    } catch (e) {}
  },

  _save: function() {
    try { localStorage.setItem('openpedigree_summary_v2', JSON.stringify(this._options)); } catch (e) {}
  },

  show: function() {
    var _this = this;
    if (this.dialog) this.hide();
    var o = this._options;

    var content = new Element('div', { 'class': 'summary-content' });
    content.insert(new Element('p', { 'class': 'summary-intro' }).update(
      translate('One line per relative with ages, conditions, test results and comments, ready to paste into the medical record. Review it before use.')));

    var controls = new Element('div', { 'class': 'summary-controls' });
    var select = function(label, options, value, onChange) {
      var wrap = new Element('label', { 'class': 'summary-field' });
      wrap.insert(new Element('span', { 'class': 'summary-label' }).update(translate(label)));
      var sel = new Element('select', { 'class': 'summary-select' });
      options.forEach(function(op) {
        var opt = new Element('option', { 'value': op[0] }).update(op[2] ? op[1] : translate(op[1]));
        if (String(op[0]) === String(value)) opt.selected = true;
        sel.insert(opt);
      });
      sel.observe('change', function() { onChange(sel.value); });
      wrap.insert(sel);
      controls.insert(wrap);
    };
    var check = function(label, value, onChange) {
      var wrap = new Element('label', { 'class': 'summary-check' });
      var cb = new Element('input', { 'type': 'checkbox' });
      cb.checked = !!value;
      cb.observe('change', function() { onChange(cb.checked); });
      wrap.insert(cb).insert(new Element('span').update(translate(label)));
      controls.insert(wrap);
    };
    // the text is written in the language of the interface
    o.lang = getLanguage() === 'pt-BR' ? 'pt-BR' : 'en';
    select('Relatives', [[1, 'First-degree relatives'], [2, 'Up to 2nd degree'], [3, 'Up to 3rd degree'], [99, 'All blood relatives']], o.maxDegree,
      function(v) { o.maxDegree = parseInt(v, 10); refresh(); });
    check('List relatives without conditions', o.listUnaffected, function(v) { o.listUnaffected = v; refresh(); });
    check('Include first names', o.includeName, function(v) { o.includeName = v; refresh(); });
    check('Include the proband', o.includeProband, function(v) { o.includeProband = v; refresh(); });
    content.insert(controls);

    var text = new Element('textarea', { 'class': 'summary-text', 'rows': 14, 'readonly': 'readonly', 'aria-label': translate('Family history summary') });
    content.insert(text);

    var refresh = function() {
      _this._save();
      try {
        text.value = buildFamilySummary(o);
      } catch (e) {
        console.warn('Family summary failed:', e);
        text.value = '';
      }
    };
    refresh();

    var buttons = new Element('div', { 'class': 'summary-buttons' });
    var mk = function(label, cls, handler) {
      var b = new Element('input', { 'type': 'button', 'value': translate(label), 'class': 'button ' + (cls || '') });
      b.observe('click', function() { handler(b); });
      buttons.insert(new Element('span', { 'class': 'buttonwrapper' }).insert(b));
      return b;
    };
    mk('Copy', '', function(b) {
      var done = function() {
        var old = b.value;
        b.value = translate('Copied!');
        setTimeout(function() { b.value = old; }, 1500);
      };
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text.value).then(done, function() { text.select(); });
      } else {
        text.select();
        try { document.execCommand('copy'); done(); } catch (e) {}
      }
    });
    mk('Close', 'secondary', function() { _this.hide(); });
    content.insert(buttons);

    this.dialog = new PhenoTips.widgets.ModalPopup(content, {
      close: { method: function() { _this.hide(); }, keys: ['Esc'] }
    }, {
      extraClassName: 'summary-modal-box',
      title: translate('Family history summary'),
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

export default FamilySummaryDialog;
