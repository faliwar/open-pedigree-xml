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

    var intro = new Element('p', { 'class': 'label-options-intro' }).update(
      'Choose which information to display directly in the label box below individuals:'
    );
    mainDiv.insert(intro);

    var optionsList = new Element('div', { 'class': 'label-options-list' });

    var createOptionRow = function(id, title, desc, checked) {
      var row = new Element('label', { 'class': 'label-option-row', 'for': id });
      var cb = new Element('input', {
        'type': 'checkbox',
        'id': id,
        'class': 'label-option-checkbox'
      });
      cb.checked = checked;

      var textCol = new Element('div', { 'class': 'label-option-text' });
      var titleEl = new Element('div', { 'class': 'label-option-title' }).update(title);
      var descEl = new Element('div', { 'class': 'label-option-desc' }).update(desc);
      textCol.insert(titleEl);
      textCol.insert(descEl);

      row.insert(cb);
      row.insert(textCol);
      return { row: row, input: cb };
    };

    var disordersOpt = createOptionRow(
      'cb-show-disorders',
      'Diagnoses (Disorders)',
      'Display clinical diagnoses (e.g. Fabry disease, Down syndrome) on affected individuals.',
      PedigreeEditorParameters.attributes.showDisordersInLabel === true
    );

    var hpoOpt = createOptionRow(
      'cb-show-hpo',
      'Phenotypes (HPO Terms)',
      'Display Human Phenotype Ontology terms (e.g. Microcephaly, Seizures) on individuals.',
      PedigreeEditorParameters.attributes.showHPOInLabel
    );

        var genesOpt = createOptionRow(
      'cb-show-genes',
      'Candidate Genes',
      'Display candidate genes (e.g. GLA, BRCA1) on individuals.',
      PedigreeEditorParameters.attributes.showGenesInLabel
    );

    var commentsOpt = createOptionRow(
      'cb-show-comments',
      'Comments (Notes)',
      'Display free-text clinical notes or testing status (e.g. untested) on individuals.',
      PedigreeEditorParameters.attributes.showCommentsInLabel !== false
    );

    var prefixesOpt = createOptionRow(
      'cb-show-prefixes',
      'Include Category Indicators',
      'Prefix entries with compact visual indicators (\u2B22 Diagnosis, \u25C8 Phenotype, \u29D3 Gene, \uD83D\uDDCE\uFE0E Comment) for clarity.',
      PedigreeEditorParameters.attributes.showLabelPrefixes
    );

    var nameCard = new Element('div', { 'class': 'label-option-row label-option-select-row' });
    var nameTextCol = new Element('div', { 'class': 'label-option-text' });
    var nameTitle = new Element('div', { 'class': 'label-option-title' }).update('Name Display Format');
    var nameDesc = new Element('div', { 'class': 'label-option-desc' }).update(
      "Choose how much of each individual's name to display on the pedigree chart."
    );
    nameTextCol.insert(nameTitle);
    nameTextCol.insert(nameDesc);

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

    nameCard.insert(nameTextCol);
    nameCard.insert(nameSelect);

    optionsList.insert(nameCard);
    optionsList.insert(new Element('hr', { 'class': 'label-options-divider' }));
    optionsList.insert(disordersOpt.row);
    optionsList.insert(hpoOpt.row);
    optionsList.insert(genesOpt.row);
    optionsList.insert(commentsOpt.row);
    optionsList.insert(new Element('hr', { 'class': 'label-options-divider' }));
    optionsList.insert(prefixesOpt.row);
    mainDiv.insert(optionsList);

    var applyCurrentValues = function() {
      _this.saveSettings({
        nameDisplayFormat: nameSelect.value || (nameSelect.getValue ? nameSelect.getValue() : 'full'),
        showDisorders: disordersOpt.input.checked,
        showHPO: hpoOpt.input.checked,
        showGenes: genesOpt.input.checked,
        showComments: commentsOpt.input.checked,
        showPrefixes: prefixesOpt.input.checked
      });
    };

    nameSelect.observe('change', applyCurrentValues);
    disordersOpt.input.observe('change', applyCurrentValues);
    hpoOpt.input.observe('change', applyCurrentValues);
    genesOpt.input.observe('change', applyCurrentValues);
    commentsOpt.input.observe('change', applyCurrentValues);
    prefixesOpt.input.observe('change', applyCurrentValues);

    var buttons = new Element('div', { 'class': 'buttons label-options-buttons' });
    var closeBtn = new Element('input', {
      'type': 'button',
      'value': 'Done',
      'class': 'button label-options-done-btn'
    });
    buttons.insert(new Element('span', { 'class': 'buttonwrapper' }).insert(closeBtn));
    mainDiv.insert(buttons);

    closeBtn.observe('click', function() {
      applyCurrentValues();
      _this.hide();
    });

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
        title: 'Label Display Options'
      }
    );

    this.dialog.show();
  },

  hide: function() {
    if (this.dialog) {
      this.dialog.close();
      this.dialog = null;
    }
  }
});

export default LabelOptionsSelector;
