import Disorder from 'pedigree/disorder';
import { translate } from 'pedigree/i18n';
import { attachGeneSearch } from 'pedigree/view/geneSearch';
import {
  CLASSIFICATIONS, ZYGOSITIES, TEST_TYPES, CONTRALATERAL_FIELD, DIAGNOSIS_TYPES, normalizeTests, normalizeDetail, normalizeDetails,
  suggestedFields, isCancer, clone
} from 'pedigree/model/clinicalData';

/**
 * Editor for a person's genetic test results and diagnosis details (including cancer details
 * such as laterality, histology, receptors, grade and stage). Changes are applied as a single
 * property change, so they can be undone in one step and show up in the history.
 *
 * @class ClinicalDetailsDialog
 */
var ClinicalDetailsDialog = Class.create({

  initialize: function() {
    this.dialog = null;
    this._node = null;
  },

  show: function(node) {
    var _this = this;
    if (!node || !node.getGeneticTests) {
      return;
    }
    if (this.dialog) {
      this.hide();
    }
    this._node = node;
    this._tests = node.getGeneticTests();
    this._details = node.getDisorderDetails();
    this._disorders = (node.getDisorders() || []).filter(function(d) { return d !== 'affected'; });

    var content = new Element('div', { 'class': 'clinical-dialog-content' });
    var who = node.getName ? node.getName() : '';
    if (who) {
      content.insert(new Element('p', { 'class': 'clinical-who' }).update(who.escapeHTML()));
    }

    // ---------------------------------------------------------------- genetic tests
    var testsSection = new Element('section', { 'class': 'clinical-section' });
    testsSection.insert(new Element('h3').update(translate('Genetic test results')));
    var testsList = new Element('div', { 'class': 'clinical-tests' });
    testsSection.insert(testsList);
    var addTestBtn = new Element('button', { 'type': 'button', 'class': 'clinical-add' }).update('+ ' + translate('Add test result'));
    testsSection.insert(addTestBtn);
    content.insert(testsSection);

    // Candidate genes from older files (the former "Genes" field): kept, and convertible
    this._candidateGenes = (node.getGenes() || []).slice(0);
    var legacyBox = new Element('div', { 'class': 'clinical-legacy' });
    testsSection.insert({ top: legacyBox });
    testsSection.insert({ top: testsSection.down('h3') });
    var renderLegacy = function() {
      legacyBox.update('');
      if (!_this._candidateGenes.length) {
        legacyBox.hide();
        return;
      }
      legacyBox.show();
      legacyBox.insert(new Element('div', { 'class': 'clinical-legacy-text' })
        .insert(new Element('strong').update(translate('Candidate genes (older files):') + ' '))
        .insert(_this._candidateGenes.join(', ').escapeHTML())
        .insert(new Element('div', { 'class': 'clinical-legacy-hint' }).update(
          translate('Older versions stored genes without a result. Convert them to test results to record the result, variant and laboratory.'))));
      var convert = new Element('button', { 'type': 'button', 'class': 'clinical-add' }).update(translate('Convert to test results'));
      convert.observe('click', function() {
        _this._candidateGenes.forEach(function(g) {
          var exists = _this._tests.some(function(t) { return (t.gene || '').toUpperCase() === g.toUpperCase(); });
          if (!exists) {
            _this._tests.push({ gene: g, classification: '', variant: '', protein: '', zygosity: '', lab: '', date: '', comment: '' });
          }
        });
        _this._candidateGenes = [];
        renderLegacy();
        renderTests();
      });
      legacyBox.insert(convert);
    };

    var renderTests = function() {
      testsList.update('');
      if (!_this._tests.length) {
        testsList.insert(new Element('p', { 'class': 'clinical-empty' }).update(translate('No test results recorded.')));
        return;
      }
      _this._tests.forEach(function(test, idx) {
        testsList.insert(_this._testRow(test, function() {
          _this._tests.splice(idx, 1);
          renderTests();
        }));
      });
    };
    addTestBtn.observe('click', function() {
      _this._tests.push({ gene: '', classification: '', variant: '', protein: '', zygosity: '', lab: '', date: '', comment: '' });
      renderTests();
      var inputs = testsList.select('.clinical-gene');
      inputs.length && inputs[inputs.length - 1].focus();
    });
    renderTests();
    renderLegacy();

    // ---------------------------------------------------------------- diagnosis details
    var dxSection = new Element('section', { 'class': 'clinical-section' });
    dxSection.insert(new Element('h3').update(translate('Diagnosis details')));
    if (!this._disorders.length) {
      dxSection.insert(new Element('p', { 'class': 'clinical-empty' }).update(
        translate('No disorders recorded. Add them under Disorders in the properties menu.')));
    }
    var typeList = new Element('datalist', { 'id': 'clinical-dx-types' });
    // values stay in English: they are written to the XML as Progeny uses them
    DIAGNOSIS_TYPES.forEach(function(t) { typeList.insert(new Element('option', { 'value': t })); });
    dxSection.insert(typeList);
    this._disorders.forEach(function(id) {
      dxSection.insert(_this._disorderCard(id));
    });
    content.insert(dxSection);

    // ---------------------------------------------------------------- buttons
    var buttons = new Element('div', { 'class': 'clinical-buttons' });
    var saveBtn = new Element('input', { 'type': 'button', 'class': 'button clinical-save', 'value': translate('Save') });
    var cancelBtn = new Element('input', { 'type': 'button', 'class': 'button secondary', 'value': translate('Cancel') });
    saveBtn.observe('click', function() { _this._save(); });
    cancelBtn.observe('click', function() { _this.hide(); });
    buttons.insert(new Element('span', { 'class': 'buttonwrapper' }).insert(cancelBtn));
    buttons.insert(new Element('span', { 'class': 'buttonwrapper' }).insert(saveBtn));
    content.insert(buttons);

    this.dialog = new PhenoTips.widgets.ModalPopup(content, {
      close: { method: function() { _this.hide(); }, keys: ['Esc'] }
    }, {
      extraClassName: 'clinical-modal-box',
      title: translate('Genetic tests and diagnosis details'),
      displayCloseButton: true,
      removeOnClose: true
    });
    this.dialog.show();
  },

  // One editable test result
  _testRow: function(test, onRemove) {
    var row = new Element('div', { 'class': 'clinical-test' });
    var field = function(label, input, cls) {
      var wrap = new Element('label', { 'class': 'clinical-field ' + (cls || '') });
      wrap.insert(new Element('span', { 'class': 'clinical-label' }).update(translate(label)));
      wrap.insert(input);
      return wrap;
    };
    var text = function(key, placeholder, cls) {
      var input = new Element('input', { 'type': 'text', 'class': 'clinical-input ' + (cls || ''), 'value': test[key] || '', 'placeholder': placeholder ? translate(placeholder) : '' });
      input.observe('input', function() { test[key] = input.value; });
      return input;
    };
    var select = function(key, options) {
      var sel = new Element('select', { 'class': 'clinical-input' });
      options.forEach(function(o) {
        var opt = new Element('option', { 'value': o.code }).update(translate(o.label));
        if ((test[key] || '') === o.code) opt.selected = true;
        sel.insert(opt);
      });
      sel.observe('change', function() { test[key] = sel.value; row.writeAttribute('data-result', resultOf()); });
      return sel;
    };
    var resultOf = function() {
      for (var i = 0; i < CLASSIFICATIONS.length; i++) {
        if (CLASSIFICATIONS[i].code === (test.classification || '')) return CLASSIFICATIONS[i].result || 'pending';
      }
      return 'pending';
    };

    var gene = text('gene', 'Search gene, e.g. BRCA1', 'clinical-gene');
    gene.observe('change', function() { gene.value = gene.value.trim().toUpperCase(); test.gene = gene.value; });
    var date = new Element('input', { 'type': 'date', 'class': 'clinical-input', 'value': /^\d{4}-\d{2}-\d{2}$/.test(test.date || '') ? test.date : '' });
    if (test.date && !/^\d{4}-\d{2}-\d{2}$/.test(test.date)) {
      date = text('date', 'YYYY-MM-DD');
    } else {
      date.observe('change', function() { test.date = date.value; });
    }

    row.insert(field('Gene', gene, 'clinical-w-gene'));
    attachGeneSearch(gene, function(symbol) { test.gene = symbol.toUpperCase(); gene.value = test.gene; });
    row.insert(field('Result', select('classification', CLASSIFICATIONS), 'clinical-w-result'));
    row.insert(field('Variant (HGVS c.)', text('variant', 'e.g. c.68_69del'), 'clinical-w-variant'));
    row.insert(field('Protein (HGVS p.)', text('protein', 'e.g. p.Glu23fs'), 'clinical-w-variant'));
    row.insert(field('Zygosity', select('zygosity', ZYGOSITIES), 'clinical-w-zyg'));
    row.insert(field('Test type', select('testType', TEST_TYPES), 'clinical-w-type'));
    row.insert(field('Laboratory', text('lab'), 'clinical-w-lab'));
    row.insert(field('Report date', date, 'clinical-w-date'));
    row.insert(field('Comment', text('comment'), 'clinical-w-comment'));
    var remove = new Element('button', { 'type': 'button', 'class': 'clinical-remove', 'title': translate('Remove'), 'aria-label': translate('Remove') }).update('&times;');
    remove.observe('click', onRemove);
    row.insert(remove);
    row.writeAttribute('data-result', resultOf());
    return row;
  },

  // Details card for one disorder
  _disorderCard: function(id) {
    var name = Disorder.desanitizeID(id);
    var display = name;
    try {
      var d = editor.getDisorderLegend().getDisorder(id);
      if (d && d.getName && d.getName() !== 'loading...') display = d.getName();
    } catch (e) {}
    var detail = normalizeDetail(this._details[name] || this._details[id]);
    this._details[name] = detail;
    if (name !== id) delete this._details[id];

    var card = new Element('div', { 'class': 'clinical-dx' });
    card.insert(new Element('h4').update(display.escapeHTML() + (isCancer(display) ? ' <span class="clinical-tag">' + translate('cancer') + '</span>' : '')));
    var grid = new Element('div', { 'class': 'clinical-dx-grid' });
    card.insert(grid);

    var input = function(key, placeholder, listId) {
      var el = new Element('input', { 'type': 'text', 'class': 'clinical-input', 'value': detail[key] || '', 'placeholder': placeholder ? translate(placeholder) : '' });
      if (listId) el.writeAttribute('list', listId);
      el.observe('input', function() { detail[key] = el.value; });
      return el;
    };
    var field = function(label, el, cls) {
      return new Element('label', { 'class': 'clinical-field ' + (cls || '') })
        .insert(new Element('span', { 'class': 'clinical-label' }).update(translate(label)))
        .insert(el);
    };
    grid.insert(field('Basis of diagnosis', input('type', 'e.g. Clinical Diagnosis', 'clinical-dx-types'), 'clinical-w-wide'));
    grid.insert(field('Age at onset', input('onset', 'e.g. 45'), 'clinical-w-age'));
    grid.insert(field('Age at diagnosis', input('atdiag', 'e.g. 51'), 'clinical-w-age'));

    // detail fields: suggested ones (cancer) first, then any other recorded field
    var fieldsBox = new Element('div', { 'class': 'clinical-dx-grid clinical-dx-fields' });
    card.insert(fieldsBox);
    var findField = function(fname) {
      for (var i = 0; i < detail.fields.length; i++) {
        if (detail.fields[i].name.toLowerCase() === fname.toLowerCase()) return detail.fields[i];
      }
      return null;
    };
    var addFieldEditor = function(fname, options, removable) {
      var f = findField(fname);
      if (!f) {
        f = { name: fname, value: '' };
        detail.fields.push(f);
      }
      var el;
      if (options) {
        el = new Element('select', { 'class': 'clinical-input' });
        var opts = options.slice(0);
        if (f.value && opts.indexOf(f.value) === -1) opts.push(f.value);
        opts.forEach(function(o) {
          var opt = new Element('option', { 'value': o }).update(o ? translate(o).escapeHTML() : '—');
          if (o === f.value) opt.selected = true;
          el.insert(opt);
        });
        el.observe('change', function() { f.value = el.value; });
      } else {
        el = new Element('input', { 'type': 'text', 'class': 'clinical-input', 'value': f.value });
        el.observe('input', function() { f.value = el.value; });
      }
      var label = fname === 'Breast' ? translate('Breast (laterality)') :
        (fname === CONTRALATERAL_FIELD ? translate('Age at contralateral diagnosis') : translate(fname));
      var wrap = new Element('label', { 'class': 'clinical-field clinical-w-field' })
        .insert(new Element('span', { 'class': 'clinical-label' }).update(label.escapeHTML()))
        .insert(el);
      if (removable) {
        wrap.addClassName('is-removable');
        var rm = new Element('button', { 'type': 'button', 'class': 'clinical-remove clinical-remove-small', 'title': translate('Remove') }).update('&times;');
        rm.observe('click', function(e) {
          e.stop();
          detail.fields = detail.fields.filter(function(x) { return x !== f; });
          wrap.remove();
        });
        wrap.insert(rm);
      }
      fieldsBox.insert(wrap);
    };
    var suggested = suggestedFields(display);
    suggested.forEach(function(s) { addFieldEditor(s.name, s.options, false); });
    detail.fields.slice(0).forEach(function(f) {
      var isSuggested = suggested.some(function(s) { return s.name.toLowerCase() === f.name.toLowerCase(); });
      if (!isSuggested) addFieldEditor(f.name, null, true);
    });

    var addRow = new Element('div', { 'class': 'clinical-add-field' });
    var newName = new Element('input', { 'type': 'text', 'class': 'clinical-input', 'placeholder': translate('New field, e.g. Ki-67') });
    var addBtn = new Element('button', { 'type': 'button', 'class': 'clinical-add' }).update('+ ' + translate('Add field'));
    addBtn.observe('click', function() {
      var fname = newName.value.trim();
      if (!fname || findField(fname)) return;
      addFieldEditor(fname, null, true);
      newName.value = '';
    });
    addRow.insert(newName).insert(addBtn);
    card.insert(addRow);

    card.insert(field('Note', input('note'), 'clinical-w-full'));
    return card;
  },

  _save: function() {
    var node = this._node;
    if (!node) return;
    var tests = normalizeTests(this._tests);
    // drop empty suggested fields so files stay clean (imported fields are kept as they were)
    var original = node.getDisorderDetails();
    var details = clone(this._details);
    Object.keys(details).forEach(function(name) {
      var imported = (original[name] && original[name].fields) || [];
      details[name].fields = (details[name].fields || []).filter(function(f) {
        return (f.value || '').trim() !== '' || imported.some(function(o) { return o.name === f.name; });
      });
    });
    details = normalizeDetails(details);

    var properties = {};
    if (JSON.stringify(tests) !== JSON.stringify(normalizeTests(node.getGeneticTests()))) {
      properties.setGeneticTests = tests;
    }
    if (JSON.stringify(details) !== JSON.stringify(normalizeDetails(original))) {
      properties.setDisorderDetails = details;
    }
    if (this._candidateGenes.length !== (node.getGenes() || []).length) {
      properties.setGenes = this._candidateGenes.slice(0); // candidate genes converted to tests
    }
    if (Object.keys(properties).length) {
      document.fire('pedigree:node:setproperty', { nodeID: node.getID(), properties: properties });
    }
    this.hide();
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
    this._node = null;
  }
});

export default ClinicalDetailsDialog;
