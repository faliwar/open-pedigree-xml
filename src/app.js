import PedigreeEditor from './script/pedigree';
import DriveBackend from './script/DriveBackend';

import '@fortawesome/fontawesome-free/js/fontawesome'
import '@fortawesome/fontawesome-free/js/solid'

import '../public/vendor/xwiki/xwiki-min.css';
import '../public/vendor/xwiki/fullScreen.css';
import '../public/vendor/xwiki/colibri.css';
import '../public/vendor/phenotips/Widgets.css';
import '../public/vendor/phenotips/DateTimePicker.css';
import '../public/vendor/phenotips/Skin.css';

var editor;

document.observe('dom:loaded',function() {
  function initializeEditor(patientDataUrl) {
    var driveIdMatch = patientDataUrl ? patientDataUrl.match(/[-\w]{25,}/) : null;

    if (driveIdMatch && DriveBackend.isAppScriptEnvironment()) {
      editor = new PedigreeEditor();
      
      var fileId = driveIdMatch[0];
      DriveBackend.loadFile(fileId, function(xmlContent) {
        try {
          var importOptions = {
            'markEvaluated': false,
            'externalIdMark': true,
            'acceptUnknownPhenotypes': true
          };
          editor.getSaveLoadEngine().createGraphFromImportData(
            xmlContent, 'invitae', importOptions,
            false, true
          );
          editor.getDriveFileSelector().setCurrentFile(fileId, 'Imported from URL');
        } catch (err) {
          console.error('Error importing XML:', err);
          alert('Error importing XML from URL: ' + err);
        }
      }, function(errMsg) {
        alert('Error loading file from Drive: ' + errMsg);
      });
    } else {
      editor = new PedigreeEditor({
        patientDataUrl: patientDataUrl
      });
    }
  }

  if (DriveBackend.isAppScriptEnvironment() && typeof google.script.url !== 'undefined') {
    google.script.url.getLocation(function(location) {
      var patientDataUrl = null;
      if (location && location.parameter) {
        patientDataUrl = location.parameter.patientDataUrl || location.parameter.f;
      }
      initializeEditor(patientDataUrl);
    });
  } else {
    var urlParams = new URLSearchParams(window.location.search);
    var patientDataUrl = urlParams.get('patientDataUrl') || urlParams.get('f');
    initializeEditor(patientDataUrl);
  }
});
