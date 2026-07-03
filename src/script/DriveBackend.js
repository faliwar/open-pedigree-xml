/**
 * DriveBackend provides an abstraction layer for Google Drive file operations.
 *
 * When running inside Google Apps Script (as a sidebar/dialog), it communicates
 * with the server-side .gs code via google.script.run.
 *
 * When running locally (development), it provides fallback behavior using the
 * browser's File API for loading and download-based saving.
 *
 * ============================================================================
 * CONFIGURATION: Set your Google Drive folder ID below before deploying to
 * Apps Script. You can find the folder ID in the URL when you open the folder
 * in Google Drive:
 *   https://drive.google.com/drive/folders/FOLDER_ID_HERE
 * ============================================================================
 *
 * @class DriveBackend
 */

var DriveBackend = {};

// ─────────────────────────────────────────────────────────────────────────────
//  CONFIGURATION
// ─────────────────────────────────────────────────────────────────────────────

/**
 * The Google Drive folder ID where XML pedigree files are stored.
 * Replace this value with your own folder ID when converting .js to .gs.
 */
DriveBackend.DRIVE_FOLDER_ID = 'YOUR_FOLDER_ID_HERE';

// ─────────────────────────────────────────────────────────────────────────────
//  ENVIRONMENT DETECTION
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Detects whether the code is running inside a Google Apps Script environment.
 * In Apps Script, the global object `google` with `google.script.run` is available.
 *
 * @returns {Boolean} true if running inside Google Apps Script
 */
DriveBackend.isAppScriptEnvironment = function () {
  try {
    return (typeof google !== 'undefined' &&
            typeof google.script !== 'undefined' &&
            typeof google.script.run !== 'undefined');
  } catch (e) {
    return false;
  }
};

// ─────────────────────────────────────────────────────────────────────────────
//  LIST FILES
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Lists XML files from the configured Drive folder.
 *
 * In Apps Script: calls the server-side `listXmlFiles()` function.
 * Locally: returns an empty array with a console warning.
 *
 * @param {Function} onSuccess  callback(files) where files is an Array of {id, name, lastUpdated}
 * @param {Function} onFailure  callback(errorMessage)
 */
DriveBackend.listXmlFiles = function (onSuccess, onFailure) {
  if (DriveBackend.isAppScriptEnvironment()) {
    google.script.run
      .withSuccessHandler(function (files) {
        onSuccess(files || []);
      })
      .withFailureHandler(function (err) {
        console.error('[DriveBackend] listXmlFiles error:', err);
        onFailure(err.message || String(err));
      })
      .listXmlFiles();
  } else {
    console.warn('[DriveBackend] Not in Apps Script environment. Cannot list Drive files.');
    onFailure('Ambiente Google Apps Script não detectado.\n\nPara usar esta funcionalidade, faça o deploy como sidebar no Google Apps Script.');
  }
};

// ─────────────────────────────────────────────────────────────────────────────
//  LOAD FILE
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Loads the content of an XML file from Google Drive.
 *
 * In Apps Script: calls the server-side `loadXmlFile(fileId)` function.
 * Locally: shows an alert.
 *
 * @param {String}   fileId     The Google Drive file ID
 * @param {Function} onSuccess  callback(xmlContent) with the file content as string
 * @param {Function} onFailure  callback(errorMessage)
 */
DriveBackend.loadFile = function (fileId, onSuccess, onFailure) {
  if (DriveBackend.isAppScriptEnvironment()) {
    google.script.run
      .withSuccessHandler(function (content) {
        onSuccess(content);
      })
      .withFailureHandler(function (err) {
        console.error('[DriveBackend] loadFile error:', err);
        onFailure(err.message || String(err));
      })
      .loadXmlFile(fileId);
  } else {
    console.warn('[DriveBackend] Not in Apps Script environment. Cannot load from Drive.');
    onFailure('Ambiente Google Apps Script não detectado.');
  }
};

// ─────────────────────────────────────────────────────────────────────────────
//  SAVE FILE (overwrite existing)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Saves (overwrites) an XML file on Google Drive.
 *
 * In Apps Script: calls the server-side `saveXmlFile(fileId, content)` function.
 * Locally: falls back to downloading the file via FileSaver.
 *
 * @param {String}   fileId      The Google Drive file ID to overwrite
 * @param {String}   fileName    The file name (used for local fallback)
 * @param {String}   xmlContent  The XML string to save
 * @param {Function} onSuccess   callback() on success
 * @param {Function} onFailure   callback(errorMessage) on failure
 */
DriveBackend.saveFile = function (fileId, fileName, xmlContent, onSuccess, onFailure) {
  if (DriveBackend.isAppScriptEnvironment()) {
    google.script.run
      .withSuccessHandler(function () {
        onSuccess();
      })
      .withFailureHandler(function (err) {
        console.error('[DriveBackend] saveFile error:', err);
        onFailure(err.message || String(err));
      })
      .saveXmlFile(fileId, xmlContent);
  } else {
    // Fallback: download file locally
    console.warn('[DriveBackend] Not in Apps Script. Falling back to local download.');
    try {
      if (typeof window.saveTextAs === 'function') {
        window.saveTextAs(xmlContent, fileName || 'pedigree.xml');
      } else if (typeof window.saveAs === 'function') {
        var blob = new Blob([xmlContent], { type: 'text/plain;charset=utf-8' });
        window.saveAs(blob, fileName || 'pedigree.xml');
      } else {
        var blob = new Blob([xmlContent], { type: 'text/plain;charset=utf-8' });
        var url = URL.createObjectURL(blob);
        var a = document.createElement('a');
        a.href = url;
        a.download = fileName || 'pedigree.xml';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      }
      onSuccess();
    } catch (e) {
      onFailure('Error saving locally: ' + e.message);
    }
  }
};

// ─────────────────────────────────────────────────────────────────────────────
//  CREATE NEW FILE
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Creates a new XML file in the configured Drive folder.
 *
 * In Apps Script: calls the server-side `createXmlFile(fileName, content)` function.
 * Locally: falls back to downloading the file.
 *
 * @param {String}   fileName    Name for the new file
 * @param {String}   xmlContent  The XML content
 * @param {Function} onSuccess   callback({id, name}) with the new file info
 * @param {Function} onFailure   callback(errorMessage)
 */
DriveBackend.createFile = function (fileName, xmlContent, onSuccess, onFailure) {
  if (DriveBackend.isAppScriptEnvironment()) {
    google.script.run
      .withSuccessHandler(function (fileInfo) {
        onSuccess(fileInfo);
      })
      .withFailureHandler(function (err) {
        console.error('[DriveBackend] createFile error:', err);
        onFailure(err.message || String(err));
      })
      .createXmlFile(fileName, xmlContent);
  } else {
    // Fallback: download file locally
    console.warn('[DriveBackend] Not in Apps Script. Falling back to local download.');
    try {
      if (typeof window.saveTextAs === 'function') {
        window.saveTextAs(xmlContent, fileName);
      } else if (typeof window.saveAs === 'function') {
        var blob = new Blob([xmlContent], { type: 'text/plain;charset=utf-8' });
        window.saveAs(blob, fileName);
      } else {
        var blob = new Blob([xmlContent], { type: 'text/plain;charset=utf-8' });
        var url = URL.createObjectURL(blob);
        var a = document.createElement('a');
        a.href = url;
        a.download = fileName;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      }
      onSuccess({ id: null, name: fileName });
    } catch (e) {
      onFailure('Error creating file locally: ' + e.message);
    }
  }
};

export default DriveBackend;
