/**
 * The UI Element for importing pedigrees from text representationin various formats
 *
 * @class ImportSelector
 */

import LLM_INSTRUCTIONS from 'pedigree/llmInstructionsContent';
import InvitaeConverter from 'pedigree/InvitaeConverter';

var ImportSelector = Class.create( {

  initialize: function() {
    if (editor.isReadOnlyMode()) {
      return;
    }

    var _this = this;

    var mainDiv = new Element('div', {'class': 'import-selector'});
    this.mainDiv = mainDiv;

    var promptImport = new Element('div', {'class': 'import-section'}).update('Import data:');
    this.importValue = new Element('textarea', {'id': 'import', 'value': '', 'class': 'import-textarea'});
    mainDiv.insert(promptImport).insert(this.importValue);

    if (!!window.FileReader && !!window.FileList) {
      // only show the upload link if browser supports FileReader/DOM File API
      // Of the browsers suported by pedigree editor, IE9 and Safari 4 & 5 do not support file API
      var uploadFileSelector = new Element('input', {'type' : 'file', 'id': 'pedigreeInputFile', 'style': 'display:none'});
      uploadFileSelector.observe('change', function(event) {
        _this.handleFileUpload(this.files);
        try {
          this.value = '';  // clear file selector
        } catch (err) {
          // some older browsers do not allow setting value of a file input element and may generate a security error
        }
      });
      var uploadLink = new Element('div', {'class': 'import-upload'}).update('(<a>Select a local file to be imported</a>)');
      uploadLink.observe('click', function(event) {
        var fileElem = document.getElementById('pedigreeInputFile');
        fileElem.click();
      });
      mainDiv.insert(uploadFileSelector).insert(uploadLink);
    }

    // AI / LLM Assistant helper section
    var aiHelperSection = new Element('div', {
      'id': 'import-llm-helper',
      'class': 'import-llm-helper highlight-invitae',
      'title': 'Copy instructions and run them with your clinical notes in your institution\'s HIPAA/GDPR-compliant AI (or ensure data is de-identified), then paste the generated XML above.'
    });
    this.aiHelperSection = aiHelperSection;

    var aiHeader = new Element('div', {'class': 'import-llm-header'});
    var aiBadge = new Element('span', {'class': 'import-llm-badge'}).update('<i class="fas fa-robot"></i> AI / LLM Assistant');
    var aiDesc = new Element('span', {'class': 'import-llm-desc'}).update('Generate pedigree XML from clinical notes');
    aiHeader.insert(aiBadge).insert(aiDesc);

    var aiTip = new Element('div', {'class': 'import-llm-tip'}).update(
      'Use these instructions with de-identified notes in an institution-approved AI, then paste the XML above.'
    );

    var aiActions = new Element('div', {'class': 'import-llm-actions'});

    // Action 1 — Copy LLM Instructions (.md)
    var copyBtn = new Element('button', {
      'type': 'button',
      'class': 'llm-btn llm-btn-copy',
      'title': 'Copy instructions to clipboard'
    }).update('<i class="fas fa-copy"></i> Copy LLM Instructions (.md)');

    var fallbackCopy = function(text, cb) {
      var ta = document.createElement('textarea');
      ta.value = text;
      ta.style.position = 'fixed';
      ta.style.left = '-9999px';
      ta.style.top = '0';
      document.body.appendChild(ta);
      ta.focus();
      ta.select();
      try {
        document.execCommand('copy');
        if (cb) cb();
      } catch (err) {
        alert('Could not copy automatically. Please use the Download button instead.');
      }
      document.body.removeChild(ta);
    };

    copyBtn.observe('click', function(ev) {
      if (ev) {
        try { ev.stop(); } catch (e) {}
      }
      var textToCopy = LLM_INSTRUCTIONS;
      var onCopied = function() {
        copyBtn.addClassName('copied');
        copyBtn.update('<i class="fas fa-check"></i> Copied!');
        setTimeout(function() {
          copyBtn.removeClassName('copied');
          copyBtn.update('<i class="fas fa-copy"></i> Copy LLM Instructions (.md)');
        }, 2000);
      };

      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(textToCopy).then(onCopied).catch(function() {
          fallbackCopy(textToCopy, onCopied);
        });
      } else {
        fallbackCopy(textToCopy, onCopied);
      }
    });

    // Action 2 — Download LLMInstructions.md
    var downloadBtn = new Element('button', {
      'type': 'button',
      'class': 'llm-btn',
      'title': 'Download LLMInstructions.md to attach to your AI chat'
    }).update('<i class="fas fa-download"></i> Download LLMInstructions.md');

    downloadBtn.observe('click', function(ev) {
      if (ev) {
        try { ev.stop(); } catch (e) {}
      }
      try {
        var blob = new Blob([LLM_INSTRUCTIONS], { type: 'text/markdown;charset=utf-8' });
        var url = URL.createObjectURL(blob);
        var a = document.createElement('a');
        a.href = url;
        a.download = 'LLMInstructions.md';
        document.body.appendChild(a);
        a.click();
        setTimeout(function() {
          document.body.removeChild(a);
          URL.revokeObjectURL(url);
        }, 100);
      } catch (err) {
        window.open('LLMInstructions.md', '_blank');
      }
    });

    aiActions.insert(copyBtn).insert(downloadBtn);
    aiHelperSection.insert(aiHeader).insert(aiTip).insert(aiActions);
    mainDiv.insert(aiHelperSection);

    var _addTypeOption = function (checked, labelText, value) {
      var optionWrapper = new Element('tr');
      var input = new Element('input', {'type' : 'radio', 'value': value, 'name': 'select-type'});
      input.observe('click', function() {
        _this.disableEnableOptions();
      });
      if (checked) {
        input.checked = true;
      }
      var label = new Element('label', {'class': 'import-type-label'}).insert(input).insert(labelText);
      optionWrapper.insert(label.wrap('td'));
      return optionWrapper;
    };
    var typeListElement = new Element('table');
    typeListElement.insert(_addTypeOption(false,  'PED or LINKAGE (pre- or post- makeped)', 'ped'));
    typeListElement.insert(_addTypeOption(false, 'GEDCOM', 'gedcom'));
    typeListElement.insert(_addTypeOption(false, 'BOADICEA', 'BOADICEA'));
    typeListElement.insert(_addTypeOption(false, 'GA4GH FHIR(JSON)', 'GA4GH'));
    typeListElement.insert(_addTypeOption(true, 'Invitae/Progeny (XML)', 'invitae'));

    var promptType = new Element('div', {'class': 'import-section'}).update('Data format:');
    var dataSection2 = new Element('div', {'class': 'import-block'});
    dataSection2.insert(promptType).insert(typeListElement);
    mainDiv.insert(dataSection2);

    var _addConfigOption = function (checked, labelText, value) {
      var optionWrapper = new Element('tr');
      var input = new Element('input', {'type' : 'radio', 'value': value, 'name': 'select-options' });
      if (checked) {
        input.checked = true;
      }
      var label = new Element('label', {'class': 'import-config-label'}).insert(input).insert(labelText);
      optionWrapper.insert(label.wrap('td'));
      return optionWrapper;
    };
    var configListElement = new Element('table', {id : 'import-type'});
    configListElement.insert(_addConfigOption(true,  'Treat non-standard phenotype values as new disorders', 'accept'));
    // Disable since XML is default
    configListElement.select('input[type="radio"]').invoke('disable');

    var markEvaluated = new Element('input', {'type' : 'checkbox', 'value': '1', 'name': 'mark-evaluated', 'disabled': 'disabled'});
    var markLabel1     = new Element('label', {'class': 'import-mark-label1'}).insert(markEvaluated).insert('Mark all patients with known disorder status with \'documented evaluation\' mark').wrap('td').wrap('tr');
    configListElement.insert(markLabel1);
    var markExternal = new Element('input', {'type' : 'checkbox', 'value': '1', 'name': 'mark-external'});
    markExternal.checked = true;
    var markLabel2   = new Element('label', {'class': 'import-mark-label2'}).insert(markExternal).insert('Save individual IDs as given in the input data as \'external ID\'').wrap('td').wrap('tr');
    configListElement.insert(markLabel2);

    var promptConfig = new Element('div', {'class': 'import-section'}).update('Options:');
    var dataSection3 = new Element('div', {'class': 'import-block'});
    dataSection3.insert(promptConfig).insert(configListElement);
    mainDiv.insert(dataSection3);

    //TODO: [x] auto-combine multiple unaffected children when the number of children is greater than [5]

    var buttons = new Element('div', {'class' : 'buttons import-block-bottom'});
    buttons.insert(new Element('input', {type: 'button', name : 'import', 'value': 'Import', 'class' : 'button', 'id': 'import_button'}).wrap('span', {'class' : 'buttonwrapper'}));
    buttons.insert(new Element('input', {type: 'button', name : 'cancel', 'value': 'Cancel', 'class' : 'button secondary'}).wrap('span', {'class' : 'buttonwrapper'}));
    mainDiv.insert(buttons);

    var cancelButton = buttons.down('input[name="cancel"]');
    var onCancel = function (event) {
      if (event) {
        try { event.stop(); } catch (err) {}
      }
      _this.hide();
    };
    cancelButton.observe('click', onCancel);
    cancelButton.observe('touchend', onCancel);

    var importButton = buttons.down('input[name="import"]');
    var onImport = function (event) {
      if (event) {
        try { event.stop(); } catch (err) {}
      }
      _this._onImportStarted();
    };
    importButton.observe('click', onImport);
    importButton.observe('touchend', onImport);

    var closeShortcut = ['Esc'];

    mainDiv.observe('dragover', function(event) {
      event.preventDefault();
      if (event.dataTransfer) event.dataTransfer.dropEffect = 'copy';
    });
    mainDiv.observe('drop', function(event) {
      event.preventDefault();
      if (event.dataTransfer && event.dataTransfer.files && event.dataTransfer.files.length > 0) {
        _this.handleFileUpload(event.dataTransfer.files);
      }
    });

    this.dialog = new PhenoTips.widgets.ModalPopup(mainDiv, {close: {method : this.hide.bind(this), keys : closeShortcut}}, {extraClassName: 'pedigree-import-chooser', title: 'Pedigree import', displayCloseButton: true});
  },

  /*
     * Populates the text input box with the selected file content (asynchronously)
     */
  handleFileUpload: function(files) {
    for (var i = 0, numFiles = files.length; i < numFiles; i++) {
      var nextFile = files[i];
      console.log('loading file: ' + nextFile.name + ', size: ' + nextFile.size);

      var _this = this;
      var fr = new FileReader();
      fr.onload = function(e) {
        var content = e.target.result;
        if (nextFile.name.toLowerCase().endsWith('.pdf') || content.startsWith('%PDF')) {
          var xmlMatch = content.match(/%\s*PedigreeXML:\s*(.*)$/);
          if (xmlMatch) {
            var decoded = decodeURIComponent(escape(atob(xmlMatch[1])));
            _this.importValue.value = decoded;
            $$('input[type=radio][name="select-type"][value="invitae"]')[0].checked = true;
            _this.disableEnableOptions();
          } else {
            alert("This PDF does not contain embedded Pedigree data.");
          }
        } else {
          _this.importValue.value = content;
          if (nextFile.name.toLowerCase().endsWith('.xml')) {
            $$('input[type=radio][name="select-type"][value="invitae"]')[0].checked = true;
            _this.disableEnableOptions();
          }
        }
      };
      fr.readAsText(nextFile, 'UTF-8');
    }
  },

  /*
     * Disables unapplicable options on input type selection
     */
  disableEnableOptions: function() {
    var container = this.mainDiv || document;
    var checkedRadio = null;
    if (container.down) {
      checkedRadio = container.down('input:checked[type=radio][name="select-type"]');
    }
    if (!checkedRadio) {
      var radios = $$('input:checked[type=radio][name="select-type"]');
      if (radios && radios.length > 0) {
        checkedRadio = radios[0];
      }
    }
    var importType = checkedRadio ? checkedRadio.value : 'invitae';
    //console.log("Import type: " + importType);

    var helperEl = this.aiHelperSection || $('import-llm-helper');
    if (helperEl) {
      if (importType === 'invitae') {
        helperEl.setStyle({ display: 'block' });
        helperEl.addClassName('highlight-invitae');
      } else {
        helperEl.setStyle({ display: 'none' });
        helperEl.removeClassName('highlight-invitae');
      }
    }

    var pedOnlyOptions = (container.select) ? container.select('input[type=radio][name="select-options"]') : $$('input[type=radio][name="select-options"]');
    if (pedOnlyOptions) {
      for (var i = 0; i < pedOnlyOptions.length; i++) {
        pedOnlyOptions[i].disabled = (importType !== 'ped');
      }
    }
    var pedAndGedcomOptions = (container.select) ? container.select('input[type=checkbox][name="mark-evaluated"]') : $$('input[type=checkbox][name="mark-evaluated"]');
    if (pedAndGedcomOptions && pedAndGedcomOptions.length > 0) {
      pedAndGedcomOptions[0].disabled = (importType !== 'ped' && importType !== 'gedcom');
    }

    var saveExternalIDs = (container.select) ? container.select('input[type=checkbox][name="mark-external"]') : $$('input[type=checkbox][name="mark-external"]');
    if (saveExternalIDs && saveExternalIDs.length > 0) {
      saveExternalIDs[0].disabled = false;
    }
  },

  /**
     * Loads the template once it has been selected
     *
     * @param event
     * @param pictureBox
     * @private
     */
  _onImportStarted: function() {
    var importValue = this.importValue.value;
    var checkedRadio = $$('input:checked[type=radio][name="select-type"]')[0];
    var importType = checkedRadio ? checkedRadio.value : '';

    if (importType === 'invitae' && importValue) {
      importValue = InvitaeConverter.sanitizeInvitaeXML(importValue);
      this.importValue.value = importValue;
    }

    console.log('Importing:\n' + importValue);

    this.hide();

    if (!importValue || importValue == '') {
      alert('Nothing to import!');
      return;
    }

    console.log('Import type: ' + importType);

    var importMark = $$('input[type=checkbox][name="mark-evaluated"]')[0].checked;

    var externalIdMark = $$('input[type=checkbox][name="mark-external"]')[0].checked;

    var optionSelected = $$('input:checked[type=radio][name="select-options"]')[0].value;
    var acceptUnknownPhenotypes = (optionSelected == 'accept');

    var importOptions = { 'markEvaluated': importMark, 'externalIdMark': externalIdMark, 'acceptUnknownPhenotypes': acceptUnknownPhenotypes };

    editor.getDriveFileSelector().clearCurrentFile();
    editor.getSaveLoadEngine().createGraphFromImportData(importValue, importType, importOptions,
      false /* add to undo stack */, true /*center around 0*/);
  },

  /**
     * Displays the template selector
     *
     * @method show
     */
  show: function() {
    if (this.dialog) {
      if (this.dialog.dialog) {
        this.dialog.dialog.removeClassName('hidden');
        this.dialog.dialog.setStyle({ display: '' });
      }
      this.dialog.show();
    }
    try {
      this.disableEnableOptions();
    } catch (err) {
      console.warn('Error in disableEnableOptions:', err);
    }
  },

  /**
     * Removes the the template selector
     *
     * @method hide
     */
  hide: function() {
    this.importValue.value = '';
    if (this.dialog) {
      this.dialog.closeDialog();
      if (this.dialog.dialog) {
        this.dialog.dialog.setStyle({ display: 'none' });
        this.dialog.dialog.addClassName('hidden');
      }
    }
  }
});

export default ImportSelector;
