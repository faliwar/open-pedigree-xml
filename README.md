# Open Pedigree - XML 

<p align="center">
  <img src="https://repository-images.githubusercontent.com/212736090/2759df80-fe9e-11e9-8fa0-8237e35cbaf7" width="400px" alt="Open Pedigree logo"/>
</p>

<p align="center">
  <a href="https://open-pedigree-xml.onrender.com" target="_blank">
    <img src="https://img.shields.io/badge/Deployed%20on-Render-4642b4?logo=render&logoColor=white" alt="Deployed on Render">
  </a>
  <a href="https://faliwar.github.io/open-pedigree-xml/" target="_blank">
    <img src="https://img.shields.io/badge/Live%20Demo-GitHub%20Pages-181717?logo=github&logoColor=white" alt="Live Demo on GitHub Pages">
  </a>
  <a href="https://opensource.org/licenses/LGPL-2.1" target="_blank">
    <img src="https://img.shields.io/badge/license-LGPL--2.1-blue.svg" alt="LGPL-2.1">
  </a>
</p>


## A free and open-source pedigree tool powered by PhenoTips®

Open Pedigree is a robust browser-based genomic pedigree drawing solution using [Prototype](prototypejs.org), [Raphaël](https://dmitrybaranovskiy.github.io/raphael/), and [PhenoTips](https://phenotips.com).

<img width="983" alt="image" src="https://fabianoposwar.com/pedigree/openpedigreexml.png">

This repository forks phenotips/open-pedigree and adapts it for compatibility with Invitae/Progeny XML formats. It is configured for deployment to Google Apps Script and uses Google Drive for storage.

## Features

✔ Robust support for complex families, intergenerational linkages, and consanguinity

✔ Shade nodes with disorders and/or candidate genes

✔ Quickly start with family templates

✔ Automatic consanguinity detection

✔ Import from PED, LINKAGE, GEDCOM (Cyrillic), BOADICEA, or GA4GH Pedigree (FHIR)

## Changes in this Fork (open-pedigree-xml)

This repository is a modified fork of the original Open Pedigree project. Key changes and improvements include:

*   **Platform Integrations:** Configured for deployment into Google Apps Script and uses Google Drive for data storage.
*   **XML Support:** Implementation of XML import and export functionality.
*   **Export to Clipboard:** Added feature to quickly export pedigree data to the clipboard.
*   **Visual & Styling Improvements:** Several styling corrections, including a white background for better visibility and exporting.
*   **Demographics Handling:** Improved handling of date of birth and calculation of current age.
*   **Optimized Docker Build:** The Dockerfile has been updated to run a lightweight, optimized production build using `serve`.

## Getting started

### Command line

Quickly get started with open pedigree on your computer:
```
git clone https://github.com/faliwar/open-pedigree-xml.git
cd open-pedigree-xml
npm install
npm start
```
Open a browser to http://localhost:9000/

### Docker

You can also use the supplied Docker image to run the applicarion.  To get started:

```
git clone https://github.com/faliwar/open-pedigree-xml.git
cd open-pedigree-xml
docker build . -t open-pedigree-xml
docker run -p 3000:3000 -d open-pedigree-xml
```

### Google Apps Script / Google Sheets

This version of Open Pedigree is optimized to run as a web app or sidebar within Google Apps Script / Google Sheets and can save/load XML files directly from a designated Google Drive folder.

The best way to deploy it is by separating the HTML and JS files in your Apps Script project.

1. Build the optimized bundle locally by running `npm install` and `npm run build`.
2. In your Google Apps Script editor, create an `index.html` file using the `include` pattern:
```html
<!DOCTYPE html>
<html>
  <head>
    <meta charset="UTF-8">
    <base target="_top">
    <title>Open Pedigree by PhenoTips&reg;</title>

    <script src="https://cdnjs.cloudflare.com/ajax/libs/prototype/1.7.3/prototype.js"></script>
    <script src="https://cdnjs.cloudflare.com/ajax/libs/scriptaculous/1.9.0/effects.js"></script>
    <script src="https://cdnjs.cloudflare.com/ajax/libs/scriptaculous/1.9.0/dragdrop.js"></script>
    <script src="https://cdnjs.cloudflare.com/ajax/libs/scriptaculous/1.9.0/slider.js"></script>
    <script src="https://cdnjs.cloudflare.com/ajax/libs/Blob.js/1.1.464287437/Blob.min.js"></script>
    <script src="https://cdnjs.cloudflare.com/ajax/libs/FileSaver.js/2.0.5/FileSaver.min.js"></script>

    <?!= include('xwiki-js'); ?>
    <?!= include('widgets-js'); ?>
    <?!= include('datetime-js'); ?>
    <?!= include('pedigree-js'); ?>
  </head>
  <body id='body'>
  </body>
</html>
```

3. Create the corresponding HTML files in your Apps Script project to hold the scripts:
   - Create `xwiki-js.html` and paste the contents of `public/vendor/xwiki/xwiki-min.js` wrapped in `<script>` tags.
   - Create `widgets-js.html` and paste the contents of `public/vendor/phenotips/Widgets.js` wrapped in `<script>` tags.
   - Create `datetime-js.html` and paste the contents of `public/vendor/phenotips/DateTimePicker.js` wrapped in `<script>` tags.
   - Create `pedigree-js.html` and paste the entire contents of your newly built `pedigree.min.js` wrapped in `<script>` tags.
   
   *Example structure for these files:*
```html
<script>
  // Paste file contents here
</script>
```

4. Create your `Code.gs` file with the following server-side logic:
```javascript
// Replace with the Google Drive folder ID where you want to save XMLs
const FOLDER_ID = 'YOUR_FOLDER_ID_HERE';

function doGet() {
  return HtmlService.createHtmlOutputFromFile('index')
      .setTitle('Open Pedigree XML')
      .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

// Utility for injecting HTML files into the index
function include(filename) {
  return HtmlService.createHtmlOutputFromFile(filename).getContent();
}

// Or to open it in a Google Sheets dialog/sidebar:
function showPedigree() {
  var html = HtmlService.createHtmlOutputFromFile('index')
      .setWidth(1000)
      .setHeight(600);
  SpreadsheetApp.getUi().showModalDialog(html, 'Pedigree Editor');
}

// --- DriveBackend.js Server-Side Requirements ---

function listXmlFiles() {
  var folder = DriveApp.getFolderById(FOLDER_ID);
  var files = folder.getFilesByType(MimeType.XML);
  var result = [];
  while (files.hasNext()) {
    var f = files.next();
    result.push({
      id: f.getId(),
      name: f.getName(),
      lastUpdated: f.getLastUpdated().toISOString()
    });
  }
  result.sort(function(a, b) {
    return new Date(b.lastUpdated) - new Date(a.lastUpdated);
  });
  return result;
}

function loadXmlFile(fileId) {
  return DriveApp.getFileById(fileId).getBlob().getDataAsString();
}

function saveXmlFile(fileId, content) {
  DriveApp.getFileById(fileId).setContent(content);
}

function createXmlFile(fileName, content) {
  var folder = DriveApp.getFolderById(FOLDER_ID);
  var file = folder.createFile(fileName, content, MimeType.XML);
  return { id: file.getId(), name: file.getName() };
}
```
6. Deploy your script as a Web App to test the application!

## Contributing

Contributions welcome! Fork the repository and create a pull request to share your improvements with the community.

In order to ensure that the licensing is clear and stays open, you'll be asked to sign a CLA with your first pull request.


## Support

This is free software! Create an issue in GitHub to ask others for help, or try fixing the issue yourself and then make a pull request to contribute it back to the core.

If you are interested in the Enterprise/commercial version, please contact [PhenoTips](https://phenotips.com/).


## License

Copyright (c) 2019-2022 Gene42 Inc. o/a PhenoTips

Copyright (c) 2026 Fabiano Poswar

Open Pedigree is distributed under the [LGPL-2.1](https://opensource.org/licenses/LGPL-2.1) (GNU Lesser General Public License).

You can easily comply with this license by:
* including prominent notice of the use of Open Pedigree in your software
* retaining all copyright notices in the software
* ensuring that any and all changes you make to the software are published and open-sourced under the LGPL
