import Controller from 'pedigree/controller';
import SaveLoadEngine from 'pedigree/saveLoadEngine';
import View from 'pedigree/view';
import DynamicPositionedGraph from 'pedigree/model/dynamicGraph';
import Helpers from 'pedigree/model/helpers';
import Workspace from 'pedigree/view/workspace';
import DisorderLegend from 'pedigree/view/disorderLegend';
import HPOLegend from 'pedigree/view/hpoLegend';
import GeneLegend from 'pedigree/view/geneLegend';
import ExportSelector from 'pedigree/view/exportSelector';
import ImportSelector from 'pedigree/view/importSelector';
import NodeMenu from 'pedigree/view/nodeMenu';
import NodetypeSelectionBubble from 'pedigree/view/nodetypeSelectionBubble';
import TemplateSelector from 'pedigree/view/templateSelector';
import DriveFileSelector from 'pedigree/view/driveFileSelector';
import ActionStack from 'pedigree/undoRedo';
import VersionUpdater from 'pedigree/versionUpdater';
import PedigreeEditorParameters from 'pedigree/pedigreeEditorParameters';
import DefaultFhirTerminologyHelper from 'pedigree/DefaultFhirTerminologyHelper';

import '../style/editor.css';

/**
 * The main class of the Pedigree Editor, responsible for initializing all the basic elements of the app.
 * Contains wrapper methods for the most commonly used functions.
 * This class should be initialized only once.
 *
 * @class PedigreeEditor
 * @constructor
 */

var PedigreeEditor = Class.create({
  initialize: function(options) {
    options = options || {};

    // front end configurations
    var returnUrl = options.returnUrl || 'https://github.com/faliwar/open-pedigree-xml';
    
    // URL to load patient data from and save data to
    var patientDataUrl = options.patientDataUrl || '';
    var backend = options.backend || {};
    var enableAutosave = options.autosave || false;

    if (backend.save === undefined || typeof backend.save !== 'function') {
      console.error('No "save" function provided for backend');
    }
    if (backend.load === undefined || typeof backend.save !== 'function') {
      console.error('No "load" function provided for backend');
    }

    // debugging functionality
    this.DEBUG_MODE = Boolean(options.DEBUG_MODE);

    window.editor = this;

    // initialize main data structure which holds the graph structure
    this._graphModel = DynamicPositionedGraph.makeEmpty(PedigreeEditorParameters.attributes.layoutRelativePersonWidth, PedigreeEditorParameters.attributes.layoutRelativeOtherWidth);

    //initialize the elements of the app
    this._workspace = new Workspace();
    this._nodeMenu = this.generateNodeMenu();
    this._nodeGroupMenu = this.generateNodeGroupMenu();
    this._partnershipMenu = this.generatePartnershipMenu();
    this._nodetypeSelectionBubble = new NodetypeSelectionBubble(false);
    this._siblingSelectionBubble  = new NodetypeSelectionBubble(true);
    this._disorderLegend = new DisorderLegend();
    this._geneLegend = new GeneLegend();
    this._hpoLegend = new HPOLegend();
    this._fhirTerminologyHelper = options.fhirTerminologyHelper || new DefaultFhirTerminologyHelper();

    this._view = new View();

    this._actionStack = new ActionStack();
    this._templateSelector = new TemplateSelector();
    this._importSelector = new ImportSelector();
    this._exportSelector = new ExportSelector();
    this._driveFileSelector = new DriveFileSelector();
    this._versionUpdater = new VersionUpdater();
    this._saveLoadEngine = new SaveLoadEngine(backend);

    // load proband data and load the graph after proband data is available
    this._saveLoadEngine.load(patientDataUrl, this._saveLoadEngine);

    this._controller = new Controller();

    
    //attach actions to buttons on the top bar
    var undoButton = $('action-undo');
    undoButton && undoButton.on('click', function(event) {
      document.fire('pedigree:undo');
    });
    var redoButton = $('action-redo');
    redoButton && redoButton.on('click', function(event) {
      document.fire('pedigree:redo');
    });

    var clearButton = $('action-clear');
    clearButton && clearButton.on('click', function(event) {
      document.fire('pedigree:graph:clear');
    });

    var saveButton = $('action-save');
    saveButton && saveButton.on('click', function(event) {
      editor.getView().unmarkAll();
      if (patientDataUrl) {
        editor.getSaveLoadEngine().save(patientDataUrl);
      }
    });

    var templatesButton = $('action-templates');
    templatesButton && templatesButton.on('click', function(event) {
      editor.getTemplateSelector().show();
    });
    var importButton = $('action-import');
    importButton && importButton.on('click', function(event) {
      editor.getImportSelector().show();
    });
    var exportButton = $('action-export');
    exportButton && exportButton.on('click', function(event) {
      editor.getExportSelector().show();
    });

    var openDriveButton = $('action-open-drive');
    openDriveButton && openDriveButton.on('click', function(event) {
      editor.getDriveFileSelector().show();
    });
    var saveDriveButton = $('action-save-drive');
    saveDriveButton && saveDriveButton.on('click', function(event) {
      editor.getDriveFileSelector().saveCurrentPedigree();
    });

    var closeButton = $('action-close');
    closeButton && closeButton.on('click', function(event) {
      if (enableAutosave) {
        editor.getSaveLoadEngine().save(patientDataUrl);
      }
      if (returnUrl) {
        window.location = returnUrl;
      }
    });

    var unsupportedBrowserButton = $('action-readonlymessage');
    unsupportedBrowserButton && unsupportedBrowserButton.on('click', function(event) {
      alert('Your browser does not support all the features required for ' +
                  'Pedigree Editor, so pedigree is displayed in read-only mode (and may have quirks).\n\n' +
                  'Supported browsers include Firefox v3.5+, Internet Explorer v9+, ' +
                  'Chrome, Safari v4+, Opera v10.5+ and most mobile browsers.');
    });

    if (enableAutosave) {
      const autosave = this.autosave(patientDataUrl);
      document.observe('pedigree:graph:clear',               autosave);
      document.observe('pedigree:undo',                      autosave);
      document.observe('pedigree:redo',                      autosave);
      document.observe('pedigree:node:remove',               autosave);
      document.observe('pedigree:node:setproperty',          autosave);
      document.observe('pedigree:node:modify',               autosave);
      document.observe('pedigree:person:drag:newparent',     autosave);
      document.observe('pedigree:person:drag:newpartner',    autosave);
      document.observe('pedigree:person:drag:newsibling',    autosave);
      document.observe('pedigree:person:newparent',          autosave);
      document.observe('pedigree:person:newsibling',         autosave);
      document.observe('pedigree:person:newpartnerandchild', autosave);
      document.observe('pedigree:partnership:newchild',      autosave);
      document.observe('pedigree:sibling:reorder',           autosave);
    }

    // --- Drag-and-drop file import ---
    this._initDragAndDropImport();

  },

  autosave: function(patientDataUrl) {
    return () => {
      editor.getSaveLoadEngine().save(patientDataUrl);
    };
  },

  /**
   * Initializes drag-and-drop file import on the work area.
   * Accepts .xml, .json, .ped, .gedcom, .ged, .boadicea, and .txt files.
   * Automatically detects the import format based on file extension and content.
   *
   * @method _initDragAndDropImport
   * @private
   */
  _initDragAndDropImport: function() {
    if (this.isReadOnlyMode() || !window.FileReader || !window.FileList) {
      return;
    }

    var _this = this;
    var workArea = $('work-area');
    if (!workArea) {
      return;
    }

    // Create the visual drop zone overlay
    var dropOverlay = new Element('div', {'id': 'drop-overlay'});
    dropOverlay.setStyle({
      position: 'fixed',
      top: '0',
      left: '0',
      width: '100%',
      height: '100%',
      backgroundColor: 'rgba(59, 130, 246, 0.15)',
      border: '3px dashed rgba(59, 130, 246, 0.6)',
      zIndex: '99999',
      display: 'none',
      alignItems: 'center',
      justifyContent: 'center',
      pointerEvents: 'none',
      backdropFilter: 'blur(2px)'
    });
    var dropLabel = new Element('div');
    dropLabel.setStyle({
      padding: '24px 48px',
      backgroundColor: 'rgba(255, 255, 255, 0.95)',
      borderRadius: '12px',
      boxShadow: '0 4px 24px rgba(0, 0, 0, 0.15)',
      fontSize: '18px',
      fontWeight: '600',
      color: '#1e40af',
      textAlign: 'center',
      lineHeight: '1.5'
    });
    dropLabel.update('📂 Drop pedigree file here to import<br><span style="font-size: 13px; font-weight: 400; color: #6b7280;">.xml · .json · .ped · .gedcom · .boadicea · .txt</span>');
    dropOverlay.insert(dropLabel);
    document.body.appendChild(dropOverlay);

    var dragCounter = 0;

    // Show overlay when dragging files over the window
    workArea.addEventListener('dragenter', function(e) {
      e.preventDefault();
      e.stopPropagation();
      dragCounter++;
      if (dragCounter === 1) {
        dropOverlay.setStyle({ display: 'flex' });
      }
    });

    workArea.addEventListener('dragover', function(e) {
      e.preventDefault();
      e.stopPropagation();
      e.dataTransfer.dropEffect = 'copy';
    });

    workArea.addEventListener('dragleave', function(e) {
      e.preventDefault();
      e.stopPropagation();
      dragCounter--;
      if (dragCounter <= 0) {
        dragCounter = 0;
        dropOverlay.setStyle({ display: 'none' });
      }
    });

    workArea.addEventListener('drop', function(e) {
      e.preventDefault();
      e.stopPropagation();
      dragCounter = 0;
      dropOverlay.setStyle({ display: 'none' });

      var files = e.dataTransfer.files;
      if (!files || files.length === 0) {
        return;
      }

      var file = files[0]; // Only process the first file
      var fileName = file.name.toLowerCase();
      var ext = fileName.substring(fileName.lastIndexOf('.'));

      // Check for compatible file extensions
      var compatibleExtensions = ['.xml', '.json', '.ped', '.gedcom', '.ged', '.boadicea', '.txt'];
      if (compatibleExtensions.indexOf(ext) === -1) {
        alert('Unsupported file type: ' + ext + '\n\nCompatible formats: ' + compatibleExtensions.join(', '));
        return;
      }

      // Confirm before replacing current pedigree
      if (!confirm('Import pedigree from "' + file.name + '"?\n\nThis will replace the current pedigree.')) {
        return;
      }

      var fr = new FileReader();
      fr.onload = function(event) {
        var content = event.target.result;
        if (!content || !content.trim()) {
          alert('The file is empty.');
          return;
        }

        try {
          // First, try to detect if this is a native JSON format (saved pedigree)
          if (ext === '.json') {
            try {
              var parsed = JSON.parse(content);
              // Native format has specific structure — try loading directly
              if (parsed && (parsed.GG || (Array.isArray(parsed) && parsed.length > 0 && parsed[0].id !== undefined))) {
                editor.getSaveLoadEngine().createGraphFromSerializedData(content, false, true);
                console.log('[DRAG-DROP] Imported as native JSON format');
                return;
              }
            } catch (jsonErr) {
              // Not valid JSON or not native format, fall through to import
            }
          }

          // Detect import type from extension and content
          var importType = _this._detectImportType(ext, content);
          var importOptions = {
            'markEvaluated': false,
            'externalIdMark': true,
            'acceptUnknownPhenotypes': true
          };

          console.log('[DRAG-DROP] Importing file "' + file.name + '" as type: ' + importType);
          editor.getSaveLoadEngine().createGraphFromImportData(
            content, importType, importOptions,
            false /* add to undo stack */, true /* center around 0 */
          );
        } catch (err) {
          console.error('[DRAG-DROP] Error importing file:', err);
          alert('Error importing file "' + file.name + '":\n\n' + err);
        }
      };

      fr.onerror = function() {
        alert('Error reading file "' + file.name + '".');
      };

      fr.readAsText(file, 'UTF-8');
    });
  },

  /**
   * Detects the pedigree import type based on file extension and content.
   *
   * @method _detectImportType
   * @param {String} ext  File extension (lowercase, with dot)
   * @param {String} content  File content string
   * @return {String} Import type identifier: 'invitae', 'GA4GH', 'ped', 'gedcom', or 'BOADICEA'
   * @private
   */
  _detectImportType: function(ext, content) {
    // Extension-based detection
    if (ext === '.xml') {
      return 'invitae';
    }
    if (ext === '.json') {
      return 'GA4GH';
    }
    if (ext === '.ped') {
      return 'ped';
    }
    if (ext === '.gedcom' || ext === '.ged') {
      return 'gedcom';
    }
    if (ext === '.boadicea') {
      return 'BOADICEA';
    }

    // For .txt or unknown, try to sniff the content
    var trimmed = content.trim();
    if (trimmed.charAt(0) === '<' || trimmed.indexOf('<tree') !== -1 || trimmed.indexOf('<?xml') !== -1) {
      return 'invitae';
    }
    if (trimmed.charAt(0) === '{' || trimmed.charAt(0) === '[') {
      return 'GA4GH';
    }
    if (trimmed.indexOf('0 HEAD') !== -1 || trimmed.indexOf('0 @') !== -1) {
      return 'gedcom';
    }
    if (trimmed.indexOf('BOADICEA') !== -1) {
      return 'BOADICEA';
    }

    // Default to PED for plain text
    return 'ped';
  },


  /**
     * Returns the graph node with the corresponding nodeID
     * @method getNode
     * @param {Number} nodeID The id of the desired node
     * @return {AbstractNode} the node whose id is nodeID
     */
  getNode: function(nodeID) {
    return this.getView().getNode(nodeID);
  },

  /**
     * @method getView
     * @return {View} (responsible for managing graphical representations of nodes and interactive elements)
     */
  getView: function() {
    return this._view;
  },

  /**
     * @method getVersionUpdater
     * @return {VersionUpdater}
     */
  getVersionUpdater: function() {
    return this._versionUpdater;
  },

  /**
     * @method getGraph
     * @return {DynamicPositionedGraph} (data model: responsible for managing nodes and their positions)
     */
  getGraph: function() {
    return this._graphModel;
  },

  /**
     * @method getController
     * @return {Controller} (responsible for managing user input and corresponding data changes)
     */
  getController: function() {
    return this._controller;
  },

  /**
     * @method getActionStack
     * @return {ActionStack} (responsible for undoing and redoing actions)
     */
  getActionStack: function() {
    return this._actionStack;
  },

  /**
     * @method getNodetypeSelectionBubble
     * @return {NodetypeSelectionBubble} (floating window with initialization options for new nodes)
     */
  getNodetypeSelectionBubble: function() {
    return this._nodetypeSelectionBubble;
  },

  /**
     * @method getSiblingSelectionBubble
     * @return {NodetypeSelectionBubble} (floating window with initialization options for new sibling nodes)
     */
  getSiblingSelectionBubble: function() {
    return this._siblingSelectionBubble;
  },

  /**
     * @method getWorkspace
     * @return {Workspace}
     */
  getWorkspace: function() {
    return this._workspace;
  },

  /**
     * @method getDisorderLegend
     * @return {Legend} Responsible for managing and displaying the disorder legend
     */
  getDisorderLegend: function() {
    return this._disorderLegend;
  },

  /**
     * @method getHPOLegend
     * @return {Legend} Responsible for managing and displaying the phenotype/HPO legend
     */
  getHPOLegend: function() {
    return this._hpoLegend;
  },

  /**
     * @method getGeneLegend
     * @return {Legend} Responsible for managing and displaying the candidate genes legend
     */
  getGeneLegend: function() {
    return this._geneLegend;
  },

  getFhirTerminologyHelper: function() {
    return this._fhirTerminologyHelper;
  },

  /**
     * @method getPaper
     * @return {Workspace.paper} Raphael paper element
     */
  getPaper: function() {
    return this.getWorkspace().getPaper();
  },

  /**
     * @method isReadOnlyMode
     * @return {Boolean} True iff pedigree drawn should be read only with no handles
     *                   (read-only mode is used for IE8 as well as for template display and
     *                   print and export versions).
     */
  isReadOnlyMode: function() {
    if (this.isUnsupportedBrowser()) {
      return true;
    }
    return false;
  },

  isUnsupportedBrowser: function() {
    // http://voormedia.com/blog/2012/10/displaying-and-detecting-support-for-svg-images
    if (!document.implementation.hasFeature('http://www.w3.org/TR/SVG11/feature#BasicStructure', '1.1')) {
      // implies unpredictable behavior when using handles & interactive elements,
      // and most likely extremely slow on any CPU
      return true;
    }
    // http://kangax.github.io/es5-compat-table/
    if (!window.JSON) {
      // no built-in JSON parser - can't proceed in any way; note that this also implies
      // no support for some other functions such as parsing XML.
      //
      // TODO: include free third-party JSON parser and replace XML with JSON when loading data;
      //       (e.g. https://github.com/douglascrockford/JSON-js)
      //
      //       => at that point all browsers which suport SVG but are treated as unsupported
      //          should theoreticaly start working (FF 3.0, Safari 3 & Opera 9/10 - need to test).
      //          IE7 does not support SVG and JSON and is completely out of the running;
      alert('Your browser is not supported and is unable to load and display any pedigrees.\n\n' +
                  'Suported browsers include Internet Explorer version 9 and higher, Safari version 4 and higher, '+
                  'Firefox version 3.6 and higher, Opera version 10.5 and higher, any version of Chrome and most '+
                  'other modern browsers (including mobile). IE8 is able to display pedigrees in read-only mode.');
      window.stop && window.stop();
      return true;
    }
    return false;
  },

  /**
     * @method getSaveLoadEngine
     * @return {SaveLoadEngine} Engine responsible for saving and loading operations
     */
  getSaveLoadEngine: function() {
    return this._saveLoadEngine;
  },

  /**
     * @method getTemplateSelector
     * @return {TemplateSelector}
     */
  getTemplateSelector: function() {
    return this._templateSelector;
  },

  /**
     * @method getImportSelector
     * @return {ImportSelector}
     */
  getImportSelector: function() {
    return this._importSelector;
  },

  /**
     * @method getExportSelector
     * @return {ExportSelector}
     */
  getExportSelector: function() {
    return this._exportSelector;
  },

  /**
     * @method getDriveFileSelector
     * @return {DriveFileSelector}
     */
  getDriveFileSelector: function() {
    return this._driveFileSelector;
  },

  /**
     * Returns true if any of the node menus are visible
     * (since some UI interactions should be disabled while menu is active - e.g. mouse wheel zoom)
     *
     * @method isAnyMenuVisible
     */
  isAnyMenuVisible: function() {
    if (this.getNodeMenu().isVisible() || this.getNodeGroupMenu().isVisible() || this.getPartnershipMenu().isVisible()) {
      return;
    }
  },

  /**
     * Creates the context menu for Person nodes
     *
     * @method generateNodeMenu
     * @return {NodeMenu}
     */
  generateNodeMenu: function() {
    if (this.isReadOnlyMode()) {
      return null;
    }
    var _this = this;
    return new NodeMenu([
      {
        'name' : 'identifier',
        'label' : '',
        'type'  : 'hidden',
        'tab': 'Personal'
      },
      {
        'name' : 'gender',
        'label' : 'Gender',
        'type' : 'radio',
        'tab': 'Personal',
        'columns': 3,
        'values' : [
          { 'actual' : 'M', 'displayed' : 'Male' },
          { 'actual' : 'F', 'displayed' : 'Female' },
          { 'actual' : 'U', 'displayed' : 'Unknown' }
        ],
        'default' : 'U',
        'function' : 'setGender'
      },
      {
        'name' : 'first_name',
        'label': 'First name',
        'type' : 'text',
        'tab': 'Personal',
        'function' : 'setFirstName'
      },
      {
        'name' : 'last_name',
        'label': 'Last name',
        'type' : 'text',
        'tab': 'Personal',
        'function' : 'setLastName'
      },
      {
        'name' : 'external_id',
        'label': 'Identifier',
        'type' : 'text',
        'tab': 'Personal',
        'function' : 'setExternalID'
      },
      {
        'name' : 'carrier',
        'label' : 'Carrier status',
        'type' : 'radio',
        'tab': 'Clinical',
        'values' : [
          { 'actual' : '', 'displayed' : 'Not affected' },
          { 'actual' : 'carrier', 'displayed' : 'Carrier' },
          { 'actual' : 'affected', 'displayed' : 'Affected' },
          { 'actual' : 'presymptomatic', 'displayed' : 'Pre-symptomatic' }
        ],
        'default' : '',
        'function' : 'setCarrierStatus'
      },
      {
        'name' : 'evaluated',
        'label' : 'Documented evaluation',
        'type' : 'select',
        'values': [
          { 'actual' : '', 'displayed' : 'None' },
          { 'actual' : '*', 'displayed' : 'Documented (*)' },
          { 'actual' : '+', 'displayed' : 'Positive +' },
          { 'actual' : '-', 'displayed' : 'Negative -' }
        ],
        'tab': 'Clinical',
        'function' : 'setEvaluated'
      },
      {
        'name' : 'disorders',
        'label' : 'Disorders',
        'type' : 'disease-picker',
        'tab': 'Clinical',
        'function' : 'setDisorders'
      },
      {
        'name' : 'candidate_genes',
        'label' : 'Genes',
        'type' : 'gene-picker',
        'tab': 'Clinical',
        'function' : 'setGenes'
      },
      {
        'name' : 'hpo_positive',
        'label' : 'Phenotypic features',
        'type' : 'hpo-picker',
        'tab': 'Clinical',
        'function' : 'setHPO'
      },
      {
        'name' : 'age_input',
        'label' : 'Age',
        'type' : 'text',
        'tab': 'Personal',
        'tip' : 'e.g. 44, 4 mo, 3 wk',
        'function' : 'setAgeInput'
      },
      {
        'name' : 'date_of_birth',
        'label' : 'Date of birth',
        'type' : 'date-picker',
        'tab': 'Personal',
        'format' : 'dd/MM/yyyy',
        'function' : 'setBirthDate'
      },
      {
        'name' : 'date_of_death',
        'label' : 'Date of death',
        'type' : 'date-picker',
        'tab': 'Personal',
        'format' : 'dd/MM/yyyy',
        'function' : 'setDeathDate'
      },
      {
        'name' : 'state',
        'label' : 'Individual is',
        'type' : 'radio',
        'tab': 'Personal',
        'columns': 3,
        'values' : [
          { 'actual' : 'alive', 'displayed' : 'Alive' },
          { 'actual' : 'stillborn', 'displayed' : 'Stillborn' },
          { 'actual' : 'deceased', 'displayed' : 'Deceased' },
          { 'actual' : 'miscarriage', 'displayed' : 'Miscarriage' },
          { 'actual' : 'unborn', 'displayed' : 'Unborn' },
          { 'actual' : 'aborted', 'displayed' : 'Aborted' }
        ],
        'default' : 'alive',
        'function' : 'setLifeStatus'
      },
      {
        'name' : 'gestation_age',
        'label' : 'Gestation age',
        'type' : 'select',
        'tab': 'Personal',
        'range' : {'start': 0, 'end': 50, 'item' : ['week', 'weeks']},
        'nullValue' : true,
        'function' : 'setGestationAge'
      },
      {
        'label' : 'Heredity options',
        'name' : 'childlessSelect',
        'values' : [{'actual': 'none', displayed: 'None'},{'actual': 'childless', displayed: 'Childless'},{'actual': 'infertile', displayed: 'Infertile'}],
        'type' : 'select',
        'tab': 'Personal',
        'function' : 'setChildlessStatus'
      },
      {
        'name' : 'adopted',
        'label' : 'Adopted',
        'type' : 'checkbox',
        'tab': 'Personal',
        'function' : 'setAdopted'
      },
      {
        'name' : 'monozygotic',
        'label' : 'Monozygotic twin',
        'type' : 'checkbox',
        'tab': 'Personal',
        'function' : 'setMonozygotic'
      },
      {
        'name' : 'nocontact',
        'label' : 'Not in contact with proband',
        'type' : 'checkbox',
        'tab': 'Personal',
        'function' : 'setLostContact'
      },
      {
        'name' : 'placeholder',
        'label' : 'Placeholder node',
        'type' : 'checkbox',
        'tab': 'Personal',
        'function' : 'makePlaceholder'
      },
      {
        'name' : 'comments',
        'label' : 'Comments',
        'type' : 'textarea',
        'tab': 'Clinical',
        'rows' : 2,
        'function' : 'setComments'
      }
    ], ['Personal', 'Clinical']);
  },

  /**
     * @method getNodeMenu
     * @return {NodeMenu} Context menu for nodes
     */
  getNodeMenu: function() {
    return this._nodeMenu;
  },

  /**
     * Creates the context menu for PersonGroup nodes
     *
     * @method generateNodeGroupMenu
     * @return {NodeMenu}
     */
  generateNodeGroupMenu: function() {
    if (this.isReadOnlyMode()) {
      return null;
    }
    var _this = this;
    return new NodeMenu([
      {
        'name' : 'identifier',
        'label' : '',
        'type'  : 'hidden'
      },
      {
        'name' : 'gender',
        'label' : 'Gender',
        'type' : 'radio',
        'columns': 3,
        'values' : [
          { 'actual' : 'M', 'displayed' : 'Male' },
          { 'actual' : 'F', 'displayed' : 'Female' },
          { 'actual' : 'U', 'displayed' : 'Unknown' }
        ],
        'default' : 'U',
        'function' : 'setGender'
      },
      {
        'name' : 'numInGroup',
        'label': 'Number of persons in this group',
        'type' : 'select',
        'values' : [{'actual': 1, displayed: 'N'}, {'actual': 2, displayed: '2'}, {'actual': 3, displayed: '3'},
          {'actual': 4, displayed: '4'}, {'actual': 5, displayed: '5'}, {'actual': 6, displayed: '6'},
          {'actual': 7, displayed: '7'}, {'actual': 8, displayed: '8'}, {'actual': 9, displayed: '9'}],
        'function' : 'setNumPersons'
      },
      {
        'name' : 'external_ids',
        'label': 'Identifier(s)',
        'type' : 'text',
        'function' : 'setExternalID'
      },
      {
        'name' : 'disorders',
        'label' : 'Known disorders<br>(common to all individuals in the group)',
        'type' : 'disease-picker',
        'function' : 'setDisorders'
      },
      {
        'name' : 'comments',
        'label' : 'Comments',
        'type' : 'textarea',
        'rows' : 2,
        'function' : 'setComments'
      },
      {
        'name' : 'state',
        'label' : 'All individuals in the group are',
        'type' : 'radio',
        'values' : [
          { 'actual' : 'alive', 'displayed' : 'Alive' },
          { 'actual' : 'aborted', 'displayed' : 'Aborted' },
          { 'actual' : 'deceased', 'displayed' : 'Deceased' },
          { 'actual' : 'miscarriage', 'displayed' : 'Miscarriage' }
        ],
        'default' : 'alive',
        'function' : 'setLifeStatus'
      },
      {
        'name' : 'evaluatedGrp',
        'label' : 'Documented evaluation',
        'type' : 'select',
        'values': [
          { 'actual' : '', 'displayed' : 'None' },
          { 'actual' : '*', 'displayed' : 'Documented (*)' },
          { 'actual' : '+', 'displayed' : 'Positive +' },
          { 'actual' : '-', 'displayed' : 'Negative -' }
        ],
        'function' : 'setEvaluated'
      },
      {
        'name' : 'adopted',
        'label' : 'Adopted',
        'type' : 'checkbox',
        'function' : 'setAdopted'
      }
    ], []);
  },

  /**
     * @method getNodeGroupMenu
     * @return {NodeMenu} Context menu for nodes
     */
  getNodeGroupMenu: function() {
    return this._nodeGroupMenu;
  },

  /**
     * Creates the context menu for Partnership nodes
     *
     * @method generatePartnershipMenu
     * @return {NodeMenu}
     */
  generatePartnershipMenu: function() {
    if (this.isReadOnlyMode()) {
      return null;
    }
    var _this = this;
    return new NodeMenu([
      {
        'label' : 'Heredity options',
        'name' : 'childlessSelect',
        'values' : [{'actual': 'none', displayed: 'None'},{'actual': 'childless', displayed: 'Childless'},{'actual': 'infertile', displayed: 'Infertile'}],
        'type' : 'select',
        'function' : 'setChildlessStatus'
      },
      {
        'name' : 'consangr',
        'label' : 'Consanguinity of this relationship',
        'type' : 'radio',
        'values' : [
          { 'actual' : 'A', 'displayed' : 'Automatic' },
          { 'actual' : 'Y', 'displayed' : 'Yes' },
          { 'actual' : 'N', 'displayed' : 'No' }
        ],
        'default' : 'A',
        'function' : 'setConsanguinity'
      },
      {
        'name' : 'broken',
        'label' : 'Separated',
        'type' : 'checkbox',
        'function' : 'setBrokenStatus'
      }
    ], [], 'relationship-menu');
  },

  /**
     * @method getPartnershipMenu
     * @return {NodeMenu} The context menu for Partnership nodes
     */
  getPartnershipMenu: function() {
    return this._partnershipMenu;
  },

  /**
     * @method convertGraphCoordToCanvasCoord
     * @return [x,y] coordinates on the canvas
     */
  convertGraphCoordToCanvasCoord: function(x, y) {
    var scale = PedigreeEditorParameters.attributes.layoutScale;
    return { x: x * scale.xscale,
      y: y * scale.yscale };
  }
});

export default PedigreeEditor;
