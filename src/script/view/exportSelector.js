import PedigreeExport from 'pedigree/model/export';
import { exportAsCanRisk } from 'pedigree/model/canRiskExport';
import { computeStandardNumbering } from 'pedigree/model/nomenclature';
import { translate } from 'pedigree/i18n';

/**
 * Helper to save a text string as a file download.
 * Uses the global saveTextAs from FileSaver.js, falling back to
 * constructing a Blob and using saveAs directly.
 */
function downloadTextFile(text, fileName) {
  if (typeof window.saveTextAs === 'function') {
    window.saveTextAs(text, fileName);
  } else if (typeof window.saveAs === 'function') {
    var blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
    window.saveAs(blob, fileName);
  } else {
    // Last-resort fallback using a download link
    var blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }
}

/**
 * The UI Element for exporting pedigrees
 *
 * @class ExportSelector
 */

var ExportSelector = Class.create({

  initialize: function () {
    var _this = this;

    var mainDiv = new Element('div', { 'class': 'import-selector' });

    var _addTypeOption = function (checked, labelText, value) {
      var optionWrapper = new Element('tr');
      var input = new Element('input', { 'type': 'radio', 'value': value, 'name': 'export-type' });
      input.observe('click', _this.disableEnableOptions);
      if (checked) {
        input.checked = true;
      }
      var label = new Element('label', { 'class': 'import-type-label' }).insert(input).insert(labelText);
      optionWrapper.insert(label.wrap('td'));
      return optionWrapper;
    };
    var typeListElement = new Element('table');
    typeListElement.insert(_addTypeOption(false, 'PED', 'ped'));
    typeListElement.insert(_addTypeOption(false, 'GA4GH FHIR', 'GA4GH'));
    typeListElement.insert(_addTypeOption(true, 'Invitae/Progeny (XML)', 'invitae'));
    typeListElement.insert(_addTypeOption(false, 'CanRisk (BOADICEA v4)', 'canrisk'));
    typeListElement.insert(_addTypeOption(false, 'SVG', 'svg'));
    typeListElement.insert(_addTypeOption(false, 'PDF', 'pdf'));

    var fileDownload = new Element('a', { 'id': 'downloadLink', 'style': 'display:none' });
    mainDiv.insert(fileDownload);

    var promptType = new Element('div', { 'class': 'import-section' }).update('Data format:');
    var dataSection2 = new Element('div', { 'class': 'import-block' });
    dataSection2.insert(promptType).insert(typeListElement);
    mainDiv.insert(dataSection2);

    var _addConfigOption = function (checked, name, cssClass, labelText, value) {
      var optionWrapper = new Element('tr');
      var input = new Element('input', { 'type': 'radio', 'value': value, 'name': name });
      if (checked) {
        input.checked = true;
      }
      var label = new Element('label', { 'class': cssClass }).insert(input).insert(labelText);
      optionWrapper.insert(label.wrap('td'));
      return optionWrapper;
    };
    var configListElementPED = new Element('table', { 'id': 'pedOptions', 'style': 'display:none' });
    var label = new Element('label', { 'class': 'export-config-header' }).insert('Which of the following fields should be used to generate person IDs?');
    configListElementPED.insert(label.wrap('td').wrap('tr'));
    configListElementPED.insert(_addConfigOption(true, 'ped-options', 'export-subconfig-label', 'External ID', 'external'));
    configListElementPED.insert(_addConfigOption(false, 'ped-options', 'export-subconfig-label', 'Name', 'name'));
    configListElementPED.insert(_addConfigOption(false, 'ped-options', 'export-subconfig-label', 'None, generate new numeric ID for everyone', 'newid'));

    var configListElementPrivacy = new Element('table', { 'id': 'privacyOptions' });
    var privLabel = new Element('label', { 'class': 'export-config-header' }).insert('Privacy export options:');
    configListElementPrivacy.insert(privLabel.wrap('td').wrap('tr'));
    configListElementPrivacy.insert(_addConfigOption(true, 'privacy-options', 'export-subconfig-label', 'All data', 'all'));
    configListElementPrivacy.insert(_addConfigOption(false, 'privacy-options', 'export-subconfig-label', 'Remove personal information (name and age)', 'nopersonal'));
    configListElementPrivacy.insert(_addConfigOption(false, 'privacy-options', 'export-subconfig-label', 'Remove personal information and free-form comments', 'minimal'));

    var _addSelectOption = function (name, cssClass, labelText, options) {
      var optionWrapper = new Element('tr');
      var input = new Element('select', { 'name': name });
      for (let op of options) {
        input.insert(new Element('option', op.options).insert(op.label));
      }
      var label = new Element('label', { 'class': cssClass }).insert(labelText).insert(input);
      optionWrapper.insert(label.wrap('td'));
      return optionWrapper;
    };

    var configListElementPDF = new Element('table', { 'id': 'pdfOptions', 'style': 'display:none' });
    var pdfLabel = new Element('label', { 'class': 'export-config-header' }).insert('PDF export options:');
    configListElementPDF.insert(pdfLabel.wrap('td').wrap('tr'));
    configListElementPDF.insert(_addSelectOption('pdf-page-size', 'export-subconfig-label', 'Page Size ',
      [
        { label: 'A3', options: { value: 'A3' } },
        { label: 'A4', options: { value: 'A4', selected: true } },
        { label: 'A5', options: { value: 'A5' } },
        { label: 'Executive', options: { value: 'EXECUTIVE' } },
        { label: 'Legal', options: { value: 'LEGAL' } },
        { label: 'Letter', options: { value: 'LETTER' } },
        { label: 'Tabloid', options: { value: 'TABLOID' } }
      ]));
    configListElementPDF.insert(_addSelectOption('pdf-page-orientation', 'export-subconfig-label', 'Page Orientation ',
      [
        { label: 'Landscape', options: { value: 'landscape', selected: true } },
        { label: 'Portrait', options: { value: 'portrait' } }
      ]));
    configListElementPDF.insert(_addSelectOption('pdf-legend-pos', 'export-subconfig-label', 'Legend Position ',
      [
        { label: 'Top Left', options: { value: 'TopLeft' } },
        { label: 'Top Right', options: { value: 'TopRight', selected: true } },
        { label: 'Bottom Left', options: { value: 'BottomLeft' } },
        { label: 'Bottom Right', options: { value: 'BottomRight' } }
      ]));

    var embedXmlRow = new Element('tr');
    var embedXmlInput = new Element('input', { 'type': 'checkbox', 'value': '1', 'name': 'pdf-embed-xml', 'checked': 'checked' });
    var embedXmlLabel = new Element('label', { 'class': 'export-subconfig-label' }).insert(embedXmlInput).insert('Embed XML data in PDF (allows updating)');
    embedXmlRow.insert(embedXmlLabel.wrap('td'));
    configListElementPDF.insert(embedXmlRow);

    var showNumbersRow = new Element('tr');
    var showNumbersInput = new Element('input', { 'type': 'checkbox', 'value': '1', 'name': 'pdf-show-numbers' });
    var showNumbersLabel = new Element('label', { 'class': 'export-subconfig-label' }).insert(showNumbersInput).insert('Show generation (I, II, III...) and individual (1, 2, 3...) numbers');
    showNumbersRow.insert(showNumbersLabel.wrap('td'));
    configListElementPDF.insert(showNumbersRow);

    // CanRisk: who the risk is calculated for; names are always replaced by I-1, II-3...
    var configListElementCanRisk = new Element('table', { 'id': 'canriskOptions', 'style': 'display:none' });
    var crLabel = new Element('label', { 'class': 'export-config-header' }).insert('CanRisk export options:');
    configListElementCanRisk.insert(crLabel.wrap('td').wrap('tr'));
    var targetRow = new Element('tr');
    var targetSelect = new Element('select', { 'name': 'canrisk-target', 'id': 'canrisk-target' });
    targetRow.insert(new Element('label', { 'class': 'export-subconfig-label' }).insert('Calculate risk for ').insert(targetSelect).wrap('td'));
    configListElementCanRisk.insert(targetRow);
    configListElementCanRisk.insert(new Element('label', { 'class': 'export-subconfig-label canrisk-note' })
      .insert('Names are replaced by generation identifiers (I-1, II-3) and dates by age and year of birth, because the file is uploaded to canrisk.org.')
      .wrap('td').wrap('tr'));

    var promptConfig = new Element('div', { 'class': 'import-section' }).update('Options:');
    var dataSection3 = new Element('div', { 'class': 'import-block' });
    dataSection3.insert(promptConfig).insert(configListElementPED).insert(configListElementPrivacy).insert(configListElementCanRisk).insert(configListElementPDF);
    mainDiv.insert(dataSection3);

    var buttons = new Element('div', { 'class': 'buttons import-block-bottom' });
    buttons.insert(new Element('input', { type: 'button', name: 'export', 'value': 'Export', 'class': 'button', 'id': 'export_button' }).wrap('span', { 'class': 'buttonwrapper' }));
    buttons.insert(new Element('input', { type: 'button', name: 'copy', 'value': 'Copy to clipboard', 'class': 'button', 'id': 'copy_button' }).wrap('span', { 'class': 'buttonwrapper' }));
    buttons.insert(new Element('input', { type: 'button', name: 'cancel', 'value': 'Cancel', 'class': 'button secondary' }).wrap('span', { 'class': 'buttonwrapper' }));
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

    var exportButton = buttons.down('input[name="export"]');
    var onExport = function (event) {
      if (event) {
        try { event.stop(); } catch (err) {}
      }
      _this._onExportStarted(false);
    };
    exportButton.observe('click', onExport);
    exportButton.observe('touchend', onExport);

    var copyButton = buttons.down('input[name="copy"]');
    var onCopy = function (event) {
      if (event) {
        try { event.stop(); } catch (err) {}
      }
      _this._onExportStarted(true);
    };
    copyButton.observe('click', onCopy);
    copyButton.observe('touchend', onCopy);

    var closeShortcut = ['Esc'];
    this.dialog = new PhenoTips.widgets.ModalPopup(mainDiv, { close: { method: this.hide.bind(this), keys: closeShortcut } }, { extraClassName: 'pedigree-import-chooser', title: 'Pedigree export', displayCloseButton: true });
  },

  /*
     * Disables unapplicable options on input type selection
     */
  disableEnableOptions: function () {
    var exportType = $$('input:checked[type=radio][name="export-type"]')[0].value;

    var pedOptionsTable = $('pedOptions');
    var privacyOptionsTable = $('privacyOptions');
    var pdfOptionsTable = $('pdfOptions');
    var canriskOptionsTable = $('canriskOptions');

    if (exportType == 'ped') {
      pedOptionsTable.show();
      privacyOptionsTable.hide();
    } else {
      pedOptionsTable.hide();
      privacyOptionsTable[exportType == 'canrisk' ? 'hide' : 'show']();
    }
    if (canriskOptionsTable) {
      if (exportType == 'canrisk') {
        ExportSelector.fillCanRiskTargets();
        canriskOptionsTable.show();
      } else {
        canriskOptionsTable.hide();
      }
    }
    var copyButton = $$('input[name="copy"]')[0];
    if (exportType == 'pdf') {
      pdfOptionsTable.show();
      if (copyButton) copyButton.up('.buttonwrapper').hide();
    } else {
      pdfOptionsTable.hide();
      if (copyButton) copyButton.up('.buttonwrapper').show();
    }
  },

  /**
     * Loads the template once it has been selected
     *
     * @param event
     * @param pictureBox
     * @private
     */
  _onExportStarted: function (isCopy) {
    this.hide();

    var exportType = $$('input:checked[type=radio][name="export-type"]')[0].value;

    if (exportType == 'ped') {
      var idGenerationSetting = $$('input:checked[type=radio][name="ped-options"]')[0].value;
      var exportString = PedigreeExport.exportAsPED(editor.getGraph().DG, idGenerationSetting);
      var fileName = 'open-pedigree.ped';
      var mimeType = 'text/plain';
      if (isCopy) {
        navigator.clipboard.writeText(exportString);
      } else {
        downloadTextFile(exportString, fileName);
      }
    } else {
      var privacySetting = $$('input:checked[type=radio][name="privacy-options"]')[0].value;
      if (exportType == 'GA4GH') {
        try {
          var exportString = PedigreeExport.exportAsGA4GH(editor.getGraph().DG, privacySetting);
          var fileName = 'open-pedigree-GA4GH-fhir.json';
          var mimeType = 'application/fhir+json';
          if (isCopy) {
            navigator.clipboard.writeText(exportString);
          } else {
            downloadTextFile(exportString, fileName);
          }
        } catch (err) {
          window.alert("GA4GH Export Error: " + err.message + "\n" + err.stack);
          console.error("GA4GH Export Error", err);
        }
      } else if (exportType == 'canrisk') {
        var targetSel = $('canrisk-target');
        var targetId = targetSel && targetSel.value !== '' ? parseInt(targetSel.value, 10) : null;
        var result;
        try {
          result = exportAsCanRisk({ targetId: targetId });
        } catch (err) {
          window.alert(translate('CanRisk export failed: ') + translate(String(err)));
          return;
        }
        if (isCopy) {
          navigator.clipboard.writeText(result.text);
        } else {
          downloadTextFile(result.text, 'canrisk-pedigree.txt');
        }
        if (result.warnings.length) {
          window.alert(translate('CanRisk file created with the following notes:') + '\n\n• ' +
            result.warnings.map(function(w) { return translate(w); }).join('\n• '));
        }
      } else if (exportType == 'invitae') {
        var exportString = PedigreeExport.exportAsInvitae(editor.getGraph().DG, privacySetting);
        var fileName = 'open-pedigree-invitae.xml';
        if (isCopy) {
          navigator.clipboard.writeText(exportString);
        } else {
          downloadTextFile(exportString, fileName);
        }
      } else if (exportType == 'svg') {
        var exportString = PedigreeExport.exportAsSVG(editor.getGraph().DG, privacySetting);
        var fileName = 'open-pedigree.svg';
        var mimeType = 'image/svg+xml';
        if (isCopy) {
          navigator.clipboard.writeText(exportString);
        } else {
          downloadTextFile(exportString, fileName);
        }
      } else if (exportType == 'pdf') {
        var pageSize = $$('select[name="pdf-page-size"]')[0].value;
        var layout = $$('select[name="pdf-page-orientation"]')[0].value;
        var legendPos = $$('select[name="pdf-legend-pos"]')[0].value;
        var embedXML = $$('input[type=checkbox][name="pdf-embed-xml"]')[0].checked;
        var showNumbers = $$('input[type=checkbox][name="pdf-show-numbers"]')[0].checked;
        let pdf = PedigreeExport.exportAsPDF(editor.getGraph().DG, privacySetting, pageSize, layout, legendPos, embedXML, showNumbers);
      }
    }
  },

  /**
     * Displays the template selector
     *
     * @method show
     */
  show: function () {
    ExportSelector.fillCanRiskTargets();
    if (this.dialog) {
      if (this.dialog.dialog) {
        this.dialog.dialog.removeClassName('hidden');
        this.dialog.dialog.setStyle({ display: '' });
      }
      this.dialog.show();
    }
  },

  /**
     * Removes the the template selector
     *
     * @method hide
     */
  hide: function () {
    if (this.dialog) {
      this.dialog.closeDialog();
      if (this.dialog.dialog) {
        this.dialog.dialog.setStyle({ display: 'none' });
        this.dialog.dialog.addClassName('hidden');
      }
    }
  }
});

// People who can be the CanRisk target, listed as "II-3 · Name"; the proband is preselected
ExportSelector.fillCanRiskTargets = function() {
  var select = $('canrisk-target');
  if (!select || typeof editor === 'undefined') {
    return;
  }
  var graph = editor.getGraph();
  var numbering = computeStandardNumbering(editor);
  var proband = graph.getProbandId();
  var previous = select.value;
  var ids = Object.keys(numbering.byId).map(function(k) { return parseInt(k, 10); });
  ids.sort(function(a, b) {
    var na = numbering.byId[a], nb = numbering.byId[b];
    return (na.generation - nb.generation) || (na.index - nb.index);
  });
  select.update('');
  ids.forEach(function(id) {
    var node = editor.getNode(id);
    var name = (node && node.getName && node.getName()) || '';
    var opt = new Element('option', { 'value': id }).update((numbering.byId[id].label + (name ? ' · ' + name : '')).escapeHTML());
    if ((previous !== '' && String(id) === previous) || (previous === '' && id === proband)) opt.selected = true;
    select.insert(opt);
  });
  if (previous === '' || !ids.some(function(id) { return String(id) === previous; })) {
    select.value = String(proband);
  }
};

export default ExportSelector;
