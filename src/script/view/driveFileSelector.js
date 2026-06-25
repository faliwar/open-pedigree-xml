import DriveBackend from 'pedigree/DriveBackend';
import PedigreeExport from 'pedigree/model/export';

/**
 * DriveFileSelector provides a modal dialog for browsing and selecting
 * XML pedigree files from a configured Google Drive folder.
 *
 * It also manages the "currently loaded file" state so that the Save
 * button can overwrite the correct file.
 *
 * @class DriveFileSelector
 */

var DriveFileSelector = Class.create({

  initialize: function () {
    this._currentFileId = null;
    this._currentFileName = null;
    this._dialog = null;
    this._fileListContainer = null;
  },

  /**
   * Returns the currently loaded file's Drive ID, or null if none is loaded.
   * @returns {String|null}
   */
  getCurrentFileId: function () {
    return this._currentFileId;
  },

  /**
   * Returns the currently loaded file name, or null if none is loaded.
   * @returns {String|null}
   */
  getCurrentFileName: function () {
    return this._currentFileName;
  },

  /**
   * Sets the current file info (used after loading a file).
   * @param {String} fileId
   * @param {String} fileName
   */
  setCurrentFile: function (fileId, fileName) {
    this._currentFileId = fileId;
    this._currentFileName = fileName;
  },

  /**
   * Clears the current file reference (e.g. after "Clear all").
   */
  clearCurrentFile: function () {
    this._currentFileId = null;
    this._currentFileName = null;
  },

  // ─────────────────────────────────────────────────────────────────────────
  //  OPEN DIALOG
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Shows the file-picker modal. Fetches the list of XML files from Drive
   * and renders them as a selectable list.
   */
  show: function () {
    var _this = this;

    // Build the modal content
    var mainDiv = new Element('div', { 'class': 'drive-file-selector' });

    // Header / description
    var header = new Element('div', { 'class': 'drive-selector-header' })
      .update('Selecione um arquivo XML do Google Drive:');
    mainDiv.insert(header);

    // Loading indicator
    var loadingDiv = new Element('div', { 'class': 'drive-selector-loading' })
      .update('<span class="fa fa-spinner fa-spin"></span> Carregando arquivos...');
    mainDiv.insert(loadingDiv);

    // File list container (initially hidden)
    this._fileListContainer = new Element('div', {
      'class': 'drive-file-list',
      'style': 'display:none'
    });
    mainDiv.insert(this._fileListContainer);

    // Error container (initially hidden)
    var errorDiv = new Element('div', {
      'class': 'drive-selector-error',
      'style': 'display:none'
    });
    mainDiv.insert(errorDiv);

    // Buttons
    var buttons = new Element('div', { 'class': 'buttons import-block-bottom' });
    buttons.insert(new Element('input', {
      type: 'button', name: 'cancel', value: 'Cancelar', 'class': 'button secondary'
    }).wrap('span', { 'class': 'buttonwrapper' }));
    mainDiv.insert(buttons);

    var cancelButton = buttons.down('input[name="cancel"]');
    cancelButton.observe('click', function () {
      _this.hide();
    });

    // Create and show the dialog
    var closeShortcut = ['Esc'];
    this._dialog = new PhenoTips.widgets.ModalPopup(mainDiv, {
      close: { method: this.hide.bind(this), keys: closeShortcut }
    }, {
      extraClassName: 'pedigree-import-chooser pedigree-drive-chooser',
      title: 'Abrir XML do Drive',
      displayCloseButton: true
    });

    this._dialog.show();

    // Fetch the file list
    DriveBackend.listXmlFiles(
      function (files) {
        loadingDiv.hide();
        _this._renderFileList(files, errorDiv);
      },
      function (errMsg) {
        loadingDiv.hide();
        errorDiv.update('<span class="fa fa-exclamation-triangle"></span> ' + errMsg);
        errorDiv.show();
      }
    );
  },

  /**
   * Hides/closes the file-picker dialog.
   */
  hide: function () {
    if (this._dialog) {
      this._dialog.closeDialog();
    }
  },

  // ─────────────────────────────────────────────────────────────────────────
  //  RENDER FILE LIST
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Renders the list of files in the file list container.
   * @private
   */
  _renderFileList: function (files, errorDiv) {
    var _this = this;
    var container = this._fileListContainer;
    container.update(''); // clear

    if (!files || files.length === 0) {
      errorDiv.update('<span class="fa fa-info-circle"></span> Nenhum arquivo XML encontrado na pasta configurada.');
      errorDiv.show();
      return;
    }

    container.show();

    // Create a table
    var table = new Element('table', { 'class': 'drive-file-table' });
    var thead = new Element('thead');
    var headerRow = new Element('tr');
    headerRow.insert(new Element('th').update('Arquivo'));
    headerRow.insert(new Element('th').update('Última modificação'));
    headerRow.insert(new Element('th').update(''));
    thead.insert(headerRow);
    table.insert(thead);

    var tbody = new Element('tbody');
    for (var i = 0; i < files.length; i++) {
      var file = files[i];
      var row = _this._createFileRow(file);
      tbody.insert(row);
    }
    table.insert(tbody);
    container.insert(table);
  },

  /**
   * Creates a single row in the file list table.
   * @private
   */
  _createFileRow: function (file) {
    var _this = this;
    var row = new Element('tr', { 'class': 'drive-file-row' });

    // File name
    var nameCell = new Element('td', { 'class': 'drive-file-name' });
    nameCell.insert(new Element('span', { 'class': 'fa fa-file-code drive-file-icon' }));
    nameCell.insert(' ' + file.name);
    row.insert(nameCell);

    // Last updated
    var dateCell = new Element('td', { 'class': 'drive-file-date' });
    if (file.lastUpdated) {
      try {
        var date = new Date(file.lastUpdated);
        dateCell.update(date.toLocaleDateString() + ' ' + date.toLocaleTimeString());
      } catch (e) {
        dateCell.update(file.lastUpdated);
      }
    }
    row.insert(dateCell);

    // Open button
    var actionCell = new Element('td', { 'class': 'drive-file-action' });
    var openBtn = new Element('input', {
      type: 'button',
      value: 'Abrir',
      'class': 'button drive-open-btn',
      'data-file-id': file.id,
      'data-file-name': file.name
    });
    openBtn.observe('click', function () {
      _this._onFileSelected(file.id, file.name);
    });
    actionCell.insert(openBtn);
    row.insert(actionCell);

    // Make entire row clickable
    row.observe('click', function (event) {
      // Don't trigger if clicking the button itself
      if (event.target.tagName !== 'INPUT') {
        _this._onFileSelected(file.id, file.name);
      }
    });

    return row;
  },

  // ─────────────────────────────────────────────────────────────────────────
  //  FILE SELECTION HANDLER
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Called when a file is selected from the list. Loads the file content
   * and imports it into the pedigree editor.
   * @private
   */
  _onFileSelected: function (fileId, fileName) {
    var _this = this;

    // Show loading state
    if (this._fileListContainer) {
      this._fileListContainer.update(
        '<div class="drive-selector-loading"><span class="fa fa-spinner fa-spin"></span> Carregando ' + fileName + '...</div>'
      );
    }

    DriveBackend.loadFile(fileId,
      function (xmlContent) {
        // Store the file reference for Save
        _this.setCurrentFile(fileId, fileName);
        _this.hide();

        // Import the XML into the editor
        try {
          var importOptions = {
            'markEvaluated': false,
            'externalIdMark': true,
            'acceptUnknownPhenotypes': true
          };
          editor.getSaveLoadEngine().createGraphFromImportData(
            xmlContent, 'invitae', importOptions,
            false /* add to undo stack */, true /* center around 0 */
          );
          console.log('[DriveFileSelector] Successfully loaded: ' + fileName);
        } catch (err) {
          console.error('[DriveFileSelector] Error importing XML:', err);
          alert('Erro ao importar o arquivo XML: ' + err);
        }
      },
      function (errMsg) {
        _this.hide();
        alert('Erro ao carregar arquivo do Drive: ' + errMsg);
      }
    );
  },

  // ─────────────────────────────────────────────────────────────────────────
  //  SAVE CURRENT PEDIGREE
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Saves the current pedigree as Invitae XML, overwriting the file that
   * was loaded from Drive. If no file was loaded, prompts for a file name
   * and creates a new file.
   */
  saveCurrentPedigree: function () {
    var _this = this;
    var xmlContent = PedigreeExport.exportAsInvitae(editor.getGraph().DG, 'all');

    if (!xmlContent || xmlContent.trim() === '') {
      alert('Nenhum pedigree para salvar. Crie ou importe um pedigree primeiro.');
      return;
    }

    if (this._currentFileId) {
      // Overwrite existing file
      var confirmMsg = 'Sobrescrever o arquivo "' + this._currentFileName + '" no Google Drive?';
      if (confirm(confirmMsg)) {
        DriveBackend.saveFile(
          this._currentFileId,
          this._currentFileName,
          xmlContent,
          function () {
            alert('Arquivo "' + _this._currentFileName + '" salvo com sucesso!');
          },
          function (errMsg) {
            alert('Erro ao salvar: ' + errMsg);
          }
        );
      }
    } else {
      // No file loaded — prompt for a name and create new
      var fileName = prompt(
        'Nenhum arquivo carregado do Drive.\nDigite o nome para o novo arquivo:',
        'pedigree-' + new Date().toISOString().slice(0, 10) + '.xml'
      );

      if (fileName && fileName.trim() !== '') {
        DriveBackend.createFile(
          fileName.trim(),
          xmlContent,
          function (fileInfo) {
            _this.setCurrentFile(fileInfo.id, fileInfo.name);
            alert('Arquivo "' + fileInfo.name + '" criado com sucesso!');
          },
          function (errMsg) {
            alert('Erro ao criar arquivo: ' + errMsg);
          }
        );
      }
    }
  }
});

export default DriveFileSelector;
