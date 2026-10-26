import PedigreeEditorParameters from 'pedigree/pedigreeEditorParameters';

/**
 * LabelOptionsSelector allows configuring which information (diagnoses, phenotypes, genes)
 * is displayed in the label rectangle beneath individuals.
 *
 * @class LabelOptionsSelector
 */
var LabelOptionsSelector = Class.create({

  initialize: function() {
    this.dialog = null;
    this.loadSettings();
  },

  loadSettings: function() {
    try {
      var saved = JSON.parse(localStorage.getItem('openpedigree_label_options_v2') || '{}');
      PedigreeEditorParameters.attributes.nameDisplayFormat = saved.nameDisplayFormat || 'full';
      PedigreeEditorParameters.attributes.showDisordersInLabel = !!saved.showDisorders; // false by default
      PedigreeEditorParameters.attributes.showHPOInLabel = !!saved.showHPO; // false by default
      PedigreeEditorParameters.attributes.showGenesInLabel = !!saved.showGenes; // false by default
      PedigreeEditorParameters.attributes.showCommentsInLabel = saved.showComments !== undefined ? !!saved.showComments : true; // true by default
      PedigreeEditorParameters.attributes.showLabelPrefixes = !!saved.showPrefixes; // false by default
      PedigreeEditorParameters.attributes.showTestsInLabel = saved.showTests !== undefined ? !!saved.showTests : true; // true by default
      PedigreeEditorParameters.attributes.colorByGene = saved.colorByGene !== undefined ? !!saved.colorByGene : true; // true by default
      if (window.editor && editor.getGeneLegend && editor.getGeneLegend()) {
        editor.getGeneLegend().setEnabled(PedigreeEditorParameters.attributes.colorByGene);
      }
    } catch (e) {
      // localStorage may not be available
    }
  },

  saveSettings: function(settings) {
    PedigreeEditorParameters.attributes.nameDisplayFormat = settings.nameDisplayFormat || 'full';
    PedigreeEditorParameters.attributes.showDisordersInLabel = !!settings.showDisorders;
    PedigreeEditorParameters.attributes.showHPOInLabel = !!settings.showHPO;
    PedigreeEditorParameters.attributes.showGenesInLabel = !!settings.showGenes;
    PedigreeEditorParameters.attributes.showCommentsInLabel = settings.showComments !== undefined ? !!settings.showComments : true;
    PedigreeEditorParameters.attributes.showLabelPrefixes = !!settings.showPrefixes;
    PedigreeEditorParameters.attributes.showTestsInLabel = settings.showTests !== undefined ? !!settings.showTests : true;
    var colorByGene = settings.colorByGene !== undefined ? !!settings.colorByGene : true;
    var colorChanged = colorByGene !== (PedigreeEditorParameters.attributes.colorByGene !== false);
    PedigreeEditorParameters.attributes.colorByGene = colorByGene;
    if (window.editor && editor.getGeneLegend && editor.getGeneLegend()) {
      editor.getGeneLegend().setEnabled(colorByGene);
      if (colorChanged && editor.getView && editor.getView().updateAllNodeColors) {
        editor.getView().updateAllNodeColors();
      }
    }

    try {
      localStorage.setItem('openpedigree_label_options_v2', JSON.stringify(settings));
    } catch (e) {}

    if (window.editor && editor.getView && editor.getView().updateAllLabels) {
      editor.getView().updateAllLabels();
    }
  },

  show: function() {
    var _this = this;

    var mainDiv = new Element('div', { 'class': 'label-options-dialog-content' });

    // Compact layout: short labels in two columns; the longer explanations are tooltips
    var optionsList = new Element('div', { 'class': 'label-options-list label-options-compact' });

    var createOptionRow = function(id, title, desc, checked) {
      var row = new Element('label', { 'class': 'label-option-chip', 'for': id, 'title': desc });
      var cb = new Element('input', {
        'type': 'checkbox',
        'id': id,
        'class': 'label-option-checkbox'
      });
      cb.checked = checked;
      row.insert(cb);
      row.insert(new Element('span', { 'class': 'label-option-title' }).update(title));
      return { row: row, input: cb };
    };

    var disordersOpt = createOptionRow('cb-show-disorders', 'Diagnoses',
      'Display clinical diagnoses (e.g. Fabry disease, Down syndrome) on affected individuals.',
      PedigreeEditorParameters.attributes.showDisordersInLabel === true);

    var hpoOpt = createOptionRow('cb-show-hpo', 'Phenotypes (HPO)',
      'Display Human Phenotype Ontology terms (e.g. Microcephaly, Seizures) on individuals.',
      PedigreeEditorParameters.attributes.showHPOInLabel);

    var testsOpt = createOptionRow('cb-show-tests', 'Genetic tests',
      'Display each test result (e.g. BRCA1 c.68_69del P, MSH2 −) on tested individuals.',
      PedigreeEditorParameters.attributes.showTestsInLabel !== false);

    var commentsOpt = createOptionRow('cb-show-comments', 'Comments',
      'Display free-text clinical notes or testing status (e.g. untested) on individuals.',
      PedigreeEditorParameters.attributes.showCommentsInLabel !== false);

    var genesOpt = createOptionRow('cb-show-genes', 'Candidate genes (old files)',
      'Display candidate genes recorded by earlier versions, before structured test results.',
      PedigreeEditorParameters.attributes.showGenesInLabel);

    var prefixesOpt = createOptionRow('cb-show-prefixes', 'Category symbols',
      'Prefix entries with compact visual indicators (⬢ Diagnosis, ◈ Phenotype, ⧓ Gene, 🗎︎ Comment) for clarity.',
      PedigreeEditorParameters.attributes.showLabelPrefixes);

    var colorGeneOpt = createOptionRow('cb-color-by-gene', 'Colour by gene',
      'Fill the symbol of people with a positive test (and candidate genes from older files) with the gene colour, and show the gene legend.',
      PedigreeEditorParameters.attributes.colorByGene !== false);

    var overlay = editor.getOverlay ? editor.getOverlay() : null;
    var numberingOpt = createOptionRow('cb-show-numbering', 'Numbering (I-1, II-3)',
      'Number generations with Roman numerals and individuals from left to right, as in clinical pedigree notation.',
      !!(overlay && overlay.isNumberingVisible()));

    var nameCard = new Element('label', { 'class': 'label-option-name-row', 'for': 'select-name-format',
      'title': "Choose how much of each individual's name to display on the pedigree chart." });
    var nameTitle = new Element('span', { 'class': 'label-option-section' }).update('Name');

    var nameSelect = new Element('select', {
      'id': 'select-name-format',
      'class': 'label-option-select'
    });
    var nameOptions = [
      { value: 'full', text: 'Full Name' },
      { value: 'first_last', text: 'First & Last Name' },
      { value: 'first', text: 'First Name Only' },
      { value: 'none', text: 'Hide Names' }
    ];
    var currentFormat = PedigreeEditorParameters.attributes.nameDisplayFormat || 'full';
    nameOptions.forEach(function(opt) {
      var optEl = new Element('option', { 'value': opt.value }).update(opt.text);
      if (opt.value === currentFormat) {
        optEl.selected = true;
      }
      nameSelect.insert(optEl);
    });

    nameCard.insert(nameTitle);
    nameCard.insert(nameSelect);

    var section = function(title, rows) {
      var box = new Element('div', { 'class': 'label-options-group' });
      box.insert(new Element('div', { 'class': 'label-option-section' }).update(title));
      var grid = new Element('div', { 'class': 'label-options-grid' });
      rows.forEach(function(r) { grid.insert(r.row); });
      box.insert(grid);
      return box;
    };

    optionsList.insert(nameCard);
    optionsList.insert(section('Show under each person', [disordersOpt, hpoOpt, testsOpt, commentsOpt, genesOpt, prefixesOpt]));
    optionsList.insert(section('Chart', [colorGeneOpt, numberingOpt]));
    mainDiv.insert(optionsList);

    numberingOpt.input.observe('change', function() {
      overlay && overlay.setNumberingVisible(numberingOpt.input.checked);
    });

    var applyCurrentValues = function() {
      _this.saveSettings({
        nameDisplayFormat: nameSelect.value || (nameSelect.getValue ? nameSelect.getValue() : 'full'),
        showDisorders: disordersOpt.input.checked,
        showHPO: hpoOpt.input.checked,
        showGenes: genesOpt.input.checked,
        showComments: commentsOpt.input.checked,
        showPrefixes: prefixesOpt.input.checked,
        showTests: testsOpt.input.checked,
        colorByGene: colorGeneOpt.input.checked
      });
    };

    nameSelect.observe('change', applyCurrentValues);
    disordersOpt.input.observe('change', applyCurrentValues);
    hpoOpt.input.observe('change', applyCurrentValues);
    genesOpt.input.observe('change', applyCurrentValues);
    commentsOpt.input.observe('change', applyCurrentValues);
    testsOpt.input.observe('change', applyCurrentValues);
    colorGeneOpt.input.observe('change', applyCurrentValues);
    prefixesOpt.input.observe('change', applyCurrentValues);

    var buttons = new Element('div', { 'class': 'buttons label-options-buttons' });
    var closeBtn = new Element('input', {
      'type': 'button',
      'value': 'Done',
      'class': 'button label-options-done-btn'
    });
    buttons.insert(new Element('span', { 'class': 'buttonwrapper' }).insert(closeBtn));
    mainDiv.insert(buttons);

    var onDone = function(event) {
      if (event) {
        try { event.stop(); } catch (err) {}
      }
      applyCurrentValues();
      _this.hide();
    };
    closeBtn.observe('click', onDone);
    closeBtn.observe('touchend', onDone);

    this.dialog = new PhenoTips.widgets.ModalPopup(
      mainDiv,
      {
        close: {
          method: function() { _this.hide(); },
          keys: ['Esc']
        }
      },
      {
        extraClassName: 'label-options-modal-box',
        title: 'Label Display Options',
        displayCloseButton: true,
        removeOnClose: true
      }
    );

    this.dialog.show();
  },

  hide: function() {
    if (this.dialog) {
      var d = this.dialog;
      this.dialog = null;
      d.close();
      if (d.dialog && d.dialog.parentNode) {
        d.dialog.remove();
      }
    }
  }
});

export default LabelOptionsSelector;
