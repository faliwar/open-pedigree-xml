import { Timer } from 'pedigree/model/helpers';
import { sexOfProperties, canShareSex } from 'pedigree/model/twinSex';
import { ChildlessBehavior } from 'pedigree/view/abstractNode';
import AbstractPerson from 'pedigree/view/abstractPerson';
import PersonVisuals from 'pedigree/view/personVisuals';
import HPOTerm from 'pedigree/hpoTerm';
import Disorder from 'pedigree/disorder';
import { computeStandardNumbering } from 'pedigree/model/nomenclature';
import { translate } from 'pedigree/i18n';
import { clone, normalizeTests, normalizeDetails, testResult, normalizeAncestry, hasAshkenaziAncestry } from 'pedigree/model/clinicalData';

/**
 * Person is a class representing any AbstractPerson that has sufficient information to be
 * displayed on the final pedigree graph (printed or exported). Person objects
 * contain information about disorders, age and other relevant properties, as well
 * as graphical data to visualize this information.
 *
 * @class Person
 * @constructor
 * @extends AbstractPerson
 * @param {Number} x X coordinate on the Raphael canvas at which the node drawing will be centered
 * @param {Number} y Y coordinate on the Raphael canvas at which the node drawing will be centered
 * @param {String} gender 'M', 'F' or 'U' depending on the gender
 * @param {Number} id Unique ID number
 * @param {Boolean} isProband True if this person is the proband
 */

var Person = Class.create(AbstractPerson, {

  initialize: function ($super, x, y, id, properties) {
    //var timer = new Timer();
    this._isProband = Person._isGraphProband(id);
    this._isVirtualParent = !!(properties && properties.isVirtualParent);
    this._isVirtualDummyChild = !!(properties && (properties.isVirtualDummyChild || properties.isPlaceholder));
    !this._type && (this._type = 'Person');
    this._setDefault();
    var gender = (properties && properties.hasOwnProperty('gender')) ? properties['gender'] : 'U';
    $super(x, y, gender, id);

    // need to assign after super() and explicitly pass gender to super()
    // because changing properties requires a redraw, which relies on gender
    // shapes being there already
    this.assignProperties(properties);
    if (this.isVirtual() || this.isHiddenBranch()) {
      this.getGraphics().hideAll();
    }
    //timer.printSinceLast("=== new person runtime: ");
  },

  /** True when this person belongs to a hidden (collapsed) branch and is not drawn */
  isHiddenBranch: function () {
    try {
      return editor.getGraph().isHiddenBranch(this.getID());
    } catch (e) {
      return false;
    }
  },

  /** Collapsed: everyone connected to the consultand (or proband) only through this person is hidden */
  getCollapsed: function () {
    return this._collapsed;
  },

  setCollapsed: function (value) {
    this._collapsed = !!value;
  },

  isVirtual: function () {
    return !!(this._isVirtualParent || this._isVirtualDummyChild);
  },

  isVirtualParent: function () {
    return !!this._isVirtualParent;
  },

  isVirtualDummyChild: function () {
    return !!this._isVirtualDummyChild;
  },

  _setDefault: function () {
    this._name = '';
    this._firstName = '';
    this._lastName = '';
    this._lastNameAtBirth = '';
    this._birthDate = '';
    this._deathDate = '';
    this._conceptionDate = '';
    this._gestationAge = '';
    this._isAdopted = false;
    this._adoptedOut = false;
    this._externalID = '';
    this._lifeStatus = 'alive';
    this._childlessStatus = null;
    this._childlessReason = '';
    this._sexAtBirth = '';         // '', 'AMAB', 'AFAB' or 'UAAB' (Bennett et al. 2022)
    this._artRole = '';            // '', 'donor' (D) or 'surrogate' (S)
    // Extra lines of descent in assisted reproduction: a donor / surrogate has a key, and each
    // child conceived or carried with their help lists that key (keys survive renumbering of ids)
    this._artKey = null;
    this._artLinks = [];
    this._historyUnknown = false;  // family history not available / not known for this person ("?")
    this._collapsed = false;       // this person's branch is hidden on the chart
    this._consultand = false;      // the person seeking genetic counselling (arrow without "P")
    this._zygosityUnknown = false; // twin of unknown zygosity ("?")
    this._carrierStatus = '';
    this._disorders = [];
    this._hpo = [];
    this._candidateGenes = [];
    this._geneticTests = [];
    this._disorderDetails = {};
    this._invitaeExtra = null;
    this._ancestry = [];
    this._ageAtDeath = '';
    // genes this node is registered under in the gene legend (kept across resets, so that
    // _syncGeneLegend() can remove stale entries)
    if (!this._legendGenes) {
      this._legendGenes = [];
    }
    this._twinGroup = null;
    this._monozygotic = false;
    this._evaluated = false;
    this._lostContact = false;
    this._dobApprox = false;
    this._ageInput = '';
  },

  /**
     * Initializes the object responsible for creating graphics for this Person
     *
     * @method _generateGraphics
     * @param {Number} x X coordinate on the Raphael canvas at which the node drawing will be centered
     * @param {Number} y Y coordinate on the Raphael canvas at which the node drawing will be centered
     * @return {PersonVisuals}
     * @private
     */
  _generateGraphics: function (x, y) {
    return new PersonVisuals(this, x, y);
  },

  /**
     * Returns True if this node is the proband (i.e. the main patient)
     *
     * @method isProband
     * @return {Boolean}
     */
  isProband: function () {
    return this._isProband;
  },

  /**
     * Same as isProband(); used as the getter paired with setProband() by the controller
     *
     * @method getProband
     * @return {Boolean}
     */
  getProband: function () {
    return this._isProband;
  },

  /**
     * Makes this node the proband, demoting the previous proband.
     * A node can't be "un-probanded" directly: another node has to become the proband instead.
     *
     * @method setProband
     * @param {Boolean} isProband
     */
  setProband: function (isProband) {
    if (!isProband || this._isProband) {
      return;
    }
    this._isProband = true;

    // There is exactly one proband. Everyone else loses the role, both in what is drawn and in
    // the saved data: the first person (id 0) is the proband unless the data says otherwise, so it
    // must always be told. Missing that made the old proband come back when the file was reopened.
    var graph = editor.getGraph();
    for (var id = 0; id <= graph.getMaxNodeId(); id++) {
      if (id == this.getID() || !graph.isPerson(id)) {
        continue;
      }
      var other = editor.getView().getNode(id);
      var flagged = (graph.getProperties(id) || {}).probandFlag === true;
      if (!other || !other.isProband || (!other.isProband() && !flagged && id != 0)) {
        continue;
      }
      var wasDrawn = other.isProband();
      other._isProband = false;
      graph.setProperties(id, other.getProperties());
      if (wasDrawn) {
        other.getGraphics().setGenderGraphics();
        other.getGraphics().getHoverBox().regenerateButtons();
      }
    }
    this.getGraphics().setGenderGraphics();
    this.getGraphics().getHoverBox().regenerateButtons();
  },

  /**
     * Returns the full name of this Person
     *
     * @method getName
     * @return {String}
     */
  getName: function () {
    if (this._name) {
      return this._name;
    }
    var full = ((this._firstName || '') + ' ' + (this._lastName || '')).trim();
    return full;
  },

  /**
     * Replaces the name of this Person with name, and displays the label
     *
     * @method setName
     * @param {String} name
     */
  setName: function (name) {
    name && (name = name.charAt(0).toUpperCase() + name.slice(1));
    this._name = name || '';
    this._firstName = this._name;
    this._lastName = '';
    this.getGraphics().updateNameLabel();
    return this._name;
  },

  /**
     * Returns the first name of this Person (compatibility bridge)
     *
     * @method getFirstName
     * @return {String}
     */
  getFirstName: function () {
    return this.getName();
  },

  /**
     * Replaces the first name of this Person with firstName, and displays the label
     *
     * @method setFirstName
     * @param firstName
     */
  setFirstName: function (firstName) {
    firstName && (firstName = firstName.charAt(0).toUpperCase() + firstName.slice(1));
    this._firstName = firstName || '';
    this._name = ((this._firstName || '') + ' ' + (this._lastName || '')).trim();
    this.getGraphics().updateNameLabel();
    return firstName;
  },

  /**
     * Returns the last name of this Person (compatibility bridge)
     *
     * @method getLastName
     * @return {String}
     */
  getLastName: function () {
    return this._lastName;
  },

  /**
     * Replaces the last name of this Person with lastName, and displays the label
     *
     * @method setLastName
     * @param lastName
     */
  setLastName: function (lastName) {
    lastName && (lastName = lastName.charAt(0).toUpperCase() + lastName.slice(1));
    this._lastName = lastName || '';
    this._name = ((this._firstName || '') + ' ' + (this._lastName || '')).trim();
    this.getGraphics().updateNameLabel();
    return lastName;
  },

  /**
     * Returns the externalID of this Person
     *
     * @method getExternalID
     * @return {String}
     */
  getExternalID: function () {
    return this._externalID;
  },

  /**
     * Replaces the external ID of this Person with the given ID, and displays the label
     *
     * @method setExternalID
     * @param externalID
     */
  setExternalID: function (externalID) {
    this._externalID = externalID;
    this.getGraphics().updateExternalIDLabel();
  },

  /**
     * Replaces free-form comments associated with the node and redraws the label
     *
     * @method setComments
     * @param comment
     */
  setComments: function ($super, comment) {
    if (comment != this.getComments()) {
      $super(comment);
      this.getGraphics().updateCommentsLabel();
    }
  },

  /**
     * Sets the type of twin
     *
     * @method setMonozygotic
     */
  setMonozygotic: function (monozygotic) {
    if (monozygotic == this._monozygotic) {
      return;
    }
    this._monozygotic = monozygotic;
    if (monozygotic) {
      this._zygosityUnknown = false;  // known to be monozygotic
    }
  },

  /**
   * Twins whose zygosity is not known (monozygotic or dizygotic): drawn with a "?" between
   * their lines (Bennett et al. 2008). Not set = dizygotic, unless monozygotic is set.
   */
  getZygosityUnknown: function () {
    return this._zygosityUnknown;
  },

  setZygosityUnknown: function (unknown) {
    unknown = !!unknown;
    if (unknown == this._zygosityUnknown) {
      return;
    }
    this._zygosityUnknown = unknown;
    if (unknown) {
      this._monozygotic = false;
    }
  },

  /** Consultand: the person seeking genetic counselling, marked with an arrow (no "P") */
  isConsultand: function () {
    return this._consultand;
  },

  getConsultand: function () {
    return this._consultand;
  },

  /** Only one person is the consultand: marking one unmarks the previous one */
  setConsultand: function (consultand) {
    consultand = !!consultand;
    if (consultand == this._consultand) {
      return;
    }
    if (consultand) {
      var graph = editor.getGraph();
      for (var id = 0; id <= graph.getMaxNodeId(); id++) {
        var other = (id != this.getID() && graph.isPerson(id)) ? editor.getView().getNode(id) : null;
        if (other && other.isConsultand && other.isConsultand()) {
          other._consultand = false;
          graph.setProperties(id, other.getProperties());
          other.getGraphics().setGenderGraphics();
        }
      }
    }
    this._consultand = consultand;
    this.getGraphics().setGenderGraphics();
  },

  /**
     * Returns the documented evaluation status
     *
     * @method getEvaluated
     * @return {Boolean}
     */
  getEvaluated: function () {
    return this._evaluated;
  },

  /**
     * Sets the documented evaluation status
     *
     * @method setEvaluated
     */
  setEvaluated: function (evaluationStatus) {
    if (evaluationStatus === true) {
      evaluationStatus = '*';
    } else if (evaluationStatus === false || evaluationStatus === '') {
      evaluationStatus = null;
    }

    if (evaluationStatus == this._evaluated) {
      return;
    }
    this._evaluated = evaluationStatus;
    this.getGraphics().updateEvaluationLabel();
  },

  /**
     * Returns the "in contact" status of this node.
     * "False" means proband has lost contaxt with this individual
     *
     * @method getLostContact
     * @return {Boolean}
     */
  getLostContact: function () {
    return this._lostContact;
  },

  /**
     * Sets the "in contact" status of this node
     *
     * @method setLostContact
     */
  setLostContact: function (lostContact) {
    if (lostContact == this._lostContact) {
      return;
    }
    this._lostContact = lostContact;
  },

  /**
   * Sex assigned at birth, written under the symbol when it differs from, or adds to, the gender
   * the symbol shows: 'AMAB', 'AFAB', 'UAAB' or '' (Bennett et al. 2022)
   */
  getSexAtBirth: function () {
    return this._sexAtBirth;
  },

  setSexAtBirth: function (value) {
    value = ['AMAB', 'AFAB', 'UAAB'].indexOf(value) !== -1 ? value : '';
    if (value != this._sexAtBirth) {
      this._sexAtBirth = value;
      this.getGraphics().updateSexAtBirthLabel();
    }
  },

  /**
   * Role in assisted reproduction: 'donor' (egg or sperm donor, "D" in the symbol), 'surrogate'
   * (gestational carrier, "S") or ''
   */
  getArtRole: function () {
    return this._artRole;
  },

  setArtRole: function (value) {
    value = (value === 'donor' || value === 'surrogate') ? value : '';
    if (value != this._artRole) {
      this._artRole = value;
      this._redrawOverlay();
    }
  },

  /** Key other people use to point at this donor / surrogate (see getArtLinks), or null */
  getArtKey: function () {
    return this._artKey;
  },

  setArtKey: function (key) {
    key = parseInt(key, 10);
    this._artKey = isNaN(key) ? null : key;
    this._redrawOverlay();
  },

  /** Keys of the donors / surrogates with a line of descent to this person */
  getArtLinks: function () {
    return this._artLinks.slice(0);
  },

  setArtLinks: function (keys) {
    this._artLinks = (Array.isArray(keys) ? keys : []).map(function (k) { return parseInt(k, 10); })
      .filter(function (k, i, all) { return !isNaN(k) && all.indexOf(k) === i; });
    this._redrawOverlay();
  },

  /** Family history not available or not known for this person: "?" above the symbol */
  getHistoryUnknown: function () {
    return this._historyUnknown;
  },

  setHistoryUnknown: function (value) {
    value = !!value;
    if (value != this._historyUnknown) {
      this._historyUnknown = value;
      this._redrawOverlay();
    }
  },

  _redrawOverlay: function () {
    editor.getOverlay && editor.getOverlay() && editor.getOverlay().scheduleRedraw();
  },

  /**
   * Ancestry (one or more groups, e.g. ["Ashkenazi Jewish", "European (non-Finnish)"]), stored
   * as "ethnicities" like the original PhenoTips format and Progeny's "Ethnicity" notes
   *
   * @method getAncestry
   * @return {Array} a copy
   */
  getAncestry: function () {
    return (this._ancestry || []).slice(0);
  },

  setAncestry: function (list) {
    this._ancestry = normalizeAncestry(list);
    this.getGraphics().updateAncestryLabel && this.getGraphics().updateAncestryLabel();
  },


  /**
   * Ashkenazi Jewish ancestry, derived from getAncestry() (used by CanRisk/BOADICEA)
   *
   * @method getAshkenazi
   * @return {Boolean}
   */
  getAshkenazi: function () {
    return hasAshkenaziAncestry(this._ancestry);
  },

  // kept for older callers: adds or removes "Ashkenazi Jewish" in the ancestry list
  setAshkenazi: function (value) {
    var list = this.getAncestry().filter(function (a) { return !/ashkenazi/i.test(a); });
    if (value) list.push('Ashkenazi Jewish');
    this.setAncestry(list);
  },

  /**
   * Age at death as entered (e.g. "72" or "72 yrs"), for deceased people without exact dates
   *
   * @method getAgeAtDeath
   * @return {String}
   */
  getAgeAtDeath: function () {
    return this._ageAtDeath || '';
  },

  setAgeAtDeath: function (value) {
    this._ageAtDeath = (value === undefined || value === null) ? '' : String(value).trim();
    this.getGraphics().updateAgeLabel && this.getGraphics().updateAgeLabel();
  },

  /**
     * Returns the type of twin: monozygotic or not
     * (always false for non-twins)
     *
     * @method getMonozygotic
     * @return {Boolean}
     */
  getMonozygotic: function () {
    return this._monozygotic;
  },

  /**
     * Assigns this node to the given twin group
     * (a twin group is all the twins from a given pregnancy)
     *
     * @method setTwinGroup
     */
  setTwinGroup: function (groupId) {
    this._twinGroup = groupId;
  },

  /**
     * Returns the status of this Person
     *
     * @method getLifeStatus
     * @return {String} "alive", "deceased", "stillborn", "unborn", "aborted" or "miscarriage"
     */
  getLifeStatus: function () {
    return this._lifeStatus;
  },

  /**
     * Returns True if this node's status is not 'alive' or 'deceased'.
     *
     * @method isFetus
     * @return {Boolean}
     */
  isFetus: function () {
    return (this.getLifeStatus() != 'alive' && this.getLifeStatus() != 'deceased');
  },

  /**
     * Returns True is status is 'unborn', 'stillborn', 'aborted', 'miscarriage', 'alive' or 'deceased'
     *
     * @method _isValidLifeStatus
     * @param {String} status
     * @returns {boolean}
     * @private
     */
  _isValidLifeStatus: function (status) {
    return (status == 'unborn' || status == 'stillborn'
      || status == 'aborted' || status == 'miscarriage'
      || status == 'alive' || status == 'deceased');
  },

  /**
     * Changes the life status of this Person to newStatus
     *
     * @method setLifeStatus
     * @param {String} newStatus "alive", "deceased", "stillborn", "unborn", "aborted" or "miscarriage"
     */
  setLifeStatus: function (newStatus) {
    if (this._isValidLifeStatus(newStatus)) {
      var oldStatus = this._lifeStatus;

      this._lifeStatus = newStatus;

      (newStatus != 'deceased') && this.setDeathDate('');
      (newStatus == 'alive') && this.setGestationAge();
      this.getGraphics().updateSBLabel();

      if (this.isFetus()) {
        this.setBirthDate('');
        this.setAdoptionStatus('');
        this.setChildlessStatus(null);
      }
      this.getGraphics().updateLifeStatusShapes(oldStatus);
      this.getGraphics().getHoverBox().regenerateHandles();
      this.getGraphics().getHoverBox().regenerateButtons();
    }
  },

  /**
     * Returns the date of the conception date of this Person
     *
     * @method getConceptionDate
     * @return {Date}
     */
  getConceptionDate: function () {
    return this._conceptionDate;
  },

  /**
     * Replaces the conception date with newDate
     *
     * @method setConceptionDate
     * @param {Date} newDate Date of conception
     */
  setConceptionDate: function (newDate) {
    this._conceptionDate = newDate ? (new Date(newDate)) : '';
    this.getGraphics().updateAgeLabel();
  },

  /**
     * Returns the number of weeks since conception
     *
     * @method getGestationAge
     * @return {Number}
     */
  getGestationAge: function () {
    if (this.getLifeStatus() == 'unborn' && this.getConceptionDate()) {
      var oneWeek = 1000 * 60 * 60 * 24 * 7,
        lastDay = new Date();
      return Math.round((lastDay.getTime() - this.getConceptionDate().getTime()) / oneWeek);
    } else if (this.isFetus()) {
      return this._gestationAge;
    } else {
      return null;
    }
  },

  /**
     * Updates the conception age of the Person given the number of weeks passed since conception
     *
     * @method setGestationAge
     * @param {Number} numWeeks Greater than or equal to 0
     */
  setGestationAge: function (numWeeks) {
    try {
      numWeeks = parseInt(numWeeks);
    } catch (err) {
      numWeeks = '';
    }
    if (numWeeks) {
      this._gestationAge = numWeeks;
      var daysAgo = numWeeks * 7,
        d = new Date();
      d.setDate(d.getDate() - daysAgo);
      this.setConceptionDate(d);
    } else {
      this._gestationAge = '';
      this.setConceptionDate(null);
    }
    this.getGraphics().updateAgeLabel();
  },

  /**
     * Returns the the birth date of this Person
     *
     * @method getBirthDate
     * @return {Date}
     */
  getBirthDate: function () {
    return this._birthDate;
  },

  /**
     * Replaces the birth date with newDate
     *
     * @method setBirthDate
     * @param {Date} newDate Must be earlier date than deathDate and a later than conception date
     */
  setBirthDate: function (newDate) {
    newDate = newDate ? (new Date(newDate)) : '';
    if (!newDate || !this.getDeathDate() || newDate.getTime() < this.getDeathDate().getTime()) {
      this._birthDate = newDate;
      this._dobApprox = false;
      this._ageInput = '';
      this.getGraphics().updateAgeLabel();
    }
  },

  /**
     * Returns whether the birth date is approximate (derived from a direct age input)
     *
     * @method getDobApprox
     * @return {Boolean}
     */
  getDobApprox: function () {
    return this._dobApprox;
  },

  /**
     * Sets whether the birth date is approximate
     *
     * @method setDobApprox
     * @param {Boolean} isApprox
     */
  setDobApprox: function (isApprox) {
    this._dobApprox = !!isApprox;
    this.getGraphics().updateAgeLabel();
  },

  /**
     * Returns the raw age input string (e.g. "44", "4 mo", "3 wk")
     *
     * @method getAgeInput
     * @return {String}
     */
  getAgeInput: function () {
    return this._ageInput;
  },

  /**
     * Sets the age directly. Parses the input string to determine the unit
     * (default: years; "mo" = months; "wk" = weeks) and calculates an
     * approximate date of birth.
     *
     * @method setAgeInput
     * @param {String} ageStr e.g. "44", "4 mo", "3 wk"
     */
  setAgeInput: function (ageStr) {
    if (!ageStr || ageStr === '') {
      this._ageInput = '';
      if (this._dobApprox) {
        this._birthDate = '';
      }
      this._dobApprox = false;
      this.getGraphics().updateAgeLabel();
      return;
    }

    this._ageInput = String(ageStr).trim();

    // Parse: "4 mo", "4mo", "4 wk", "4wk", or plain number (years)
    var moMatch = this._ageInput.match(/^(\d+)\s*mo$/i);
    var wkMatch = this._ageInput.match(/^(\d+)\s*wk$/i);
    var yrMatch = this._ageInput.match(/^(\d+)\s*(?:yrs?|y)?$/i);

    // If there is an exact birth date, and the submitted age string exactly matches
    // the calculated age for that exact birth date, do NOT overwrite it with an approximation.
    // This prevents the UI's auto-calculated age from destroying precise DOBs upon saving.
    if (this._birthDate && !this._dobApprox) {
      var now = this.getDeathDate() || new Date();
      var dob = this._birthDate;

      var exactYears = now.getFullYear() - dob.getFullYear();
      if (now.getMonth() < dob.getMonth() || (now.getMonth() == dob.getMonth() && now.getDate() < dob.getDate())) {
        exactYears--;
      }

      var exactMonths = (now.getFullYear() - dob.getFullYear()) * 12 + now.getMonth() - dob.getMonth();
      if (now.getDate() < dob.getDate()) {
        exactMonths--;
      }

      var ageDiffDays = Math.floor((now.getTime() - dob.getTime()) / (1000 * 60 * 60 * 24));
      var exactWeeks = Math.floor(ageDiffDays / 7);

      if (yrMatch && parseInt(yrMatch[1], 10) === exactYears) return;
      if (moMatch && parseInt(moMatch[1], 10) === exactMonths) return;
      if (wkMatch && parseInt(wkMatch[1], 10) === exactWeeks) return;
    }

    var approxDob = new Date();
    if (moMatch) {
      var months = parseInt(moMatch[1], 10);
      approxDob.setMonth(approxDob.getMonth() - months);
    } else if (wkMatch) {
      var weeks = parseInt(wkMatch[1], 10);
      approxDob.setDate(approxDob.getDate() - (weeks * 7));
    } else if (yrMatch) {
      var years = parseInt(yrMatch[1], 10);
      approxDob.setFullYear(approxDob.getFullYear() - years);
    } else {
      // unrecognized format, do nothing
      return;
    }

    this._dobApprox = true;
    this._birthDate = approxDob;
    this.getGraphics().updateAgeLabel();
  },

  /**
     * Returns the death date of this Person
     *
     * @method getDeathDate
     * @return {Date}
     */
  getDeathDate: function () {
    return this._deathDate;
  },

  /**
     * Replaces the death date with deathDate
     *
     *
     * @method setDeathDate
     * @param {Date} deathDate Must be a later date than birthDate
     */
  setDeathDate: function (deathDate) {
    deathDate = deathDate ? (new Date(deathDate)) : '';
    // only set death date if it happens ot be after the birth date, or there is no birth or death date
    if (!deathDate || !this.getBirthDate() || deathDate.getTime() > this.getBirthDate().getTime()) {
      this._deathDate = deathDate;
      this._deathDate && (this.getLifeStatus() == 'alive') && this.setLifeStatus('deceased');
    }
    this.getGraphics().updateAgeLabel();
    return this.getDeathDate();
  },

  _isValidCarrierStatus: function (status) {
    return (status == '' || status == 'carrier'
      || status == 'affected' || status == 'presymptomatic');
  },

  /**
     * Sets the global disorder carrier status for this Person
     *
     * @method setCarrier
     * @param status One of {'', 'carrier', 'affected', 'presymptomatic'}
     */
  setCarrierStatus: function (status) {
    var numDisorders = this.getDisorders().length;

    if (status === undefined || status === null) {
      if (numDisorders == 0) {
        status = '';
      } else {
        status = this.getCarrierStatus();
        if (status == '') {
          status = 'affected';
        }
      }
    }

    if (!this._isValidCarrierStatus(status)) {
      return;
    }

    if (numDisorders > 0 && status == '') {
      if (numDisorders == 1 && this.getDisorders()[0] == 'affected') {
        this.removeDisorder('affected');
        this.getGraphics().updateDisorderShapes();
        this.getGraphics().updateDisordersLabel && this.getGraphics().updateDisordersLabel();
      } else {
        status = 'affected';
      }
    } else if (numDisorders == 0 && status == 'affected') {
      this.addDisorder('affected');
      this.getGraphics().updateDisorderShapes();
      this.getGraphics().updateDisordersLabel && this.getGraphics().updateDisordersLabel();
    }

    if (status != this._carrierStatus) {
      this._carrierStatus = status;
      this.getGraphics().updateCarrierGraphic();
    }
  },

  /**
     * Returns the global disorder carrier status for this person.
     *
     * @method getCarrier
     * @return {String} Dissorder carrier status
     */
  getCarrierStatus: function () {
    return this._carrierStatus;
  },

  /**
     * Returns the list of all colors associated with the node
     * (e.g. all colors of all disorders and all colors of all the genes)
     * @method getAllNodeColors
     * @return {Array of Strings}
     */
  getAllNodeColors: function () {
    var result = [];
    for (var i = 0; i < this.getDisorders().length; i++) {
      result.push(editor.getDisorderLegend().getObjectColor(this.getDisorders()[i]));
    }
    var geneLegend = editor.getGeneLegend();
    if (!geneLegend.isEnabled || geneLegend.isEnabled()) { // colouring by gene can be turned off in Labels
      for (var i = 0; i < this._legendGenes.length; i++) {
        result.push(geneLegend.getObjectColor(this._legendGenes[i]));
      }
    }
    return result;
  },

  /**
   * Genes shown in the gene legend and colouring for this person: genes with a positive test
   * result (pathogenic, likely pathogenic or positive), plus candidate genes from older files.
   *
   * @method getLegendGenes
   * @return {Array}
   */
  getLegendGenes: function () {
    var genes = this._candidateGenes.slice(0);
    this._geneticTests.forEach(function (t) {
      if (testResult(t) === 'positive' && genes.indexOf(t.gene) === -1) {
        genes.push(t.gene);
      }
    });
    return genes;
  },

  // Registers/unregisters this person in the gene legend to match getLegendGenes()
  _syncGeneLegend: function () {
    var legend = editor.getGeneLegend();
    var wanted = this.getLegendGenes();
    var id = this.getID();
    this._legendGenes.filter(function (g) { return wanted.indexOf(g) === -1; }).forEach(function (g) {
      legend.removeCase(g, id);
    });
    var current = this._legendGenes;
    wanted.filter(function (g) { return current.indexOf(g) === -1; }).forEach(function (g) {
      legend.addCase(g, g, id);
    });
    this._legendGenes = wanted;
    this.getGraphics().updateDisorderShapes();
  },

  /**
     * Returns a list of disorders of this person.
     *
     * @method getDisorders
     * @return {Array} List of disorder IDs.
     */
  getDisorders: function () {
    return this._disorders;
  },

  /**
     * Returns a list of disorders of this person, with non-scrambled IDs
     *
     * @method getDisordersForExport
     * @return {Array} List of human-readable versions of disorder IDs
     */
  getDisordersForExport: function () {
    var exportDisorders = this._disorders.slice(0);
    for (var i = 0; i < exportDisorders.length; i++) {
      exportDisorders[i] = Disorder.desanitizeID(exportDisorders[i]);
    }
    return exportDisorders;
  },

  /**
     * Adds disorder to the list of this node's disorders and updates the Legend.
     *
     * @method addDisorder
     * @param {Disorder} disorder Disorder object or a free-text name string
     */
  addDisorder: function (disorder) {
    if (typeof disorder != 'object') {
      disorder = editor.getDisorderLegend().getDisorder(disorder);
    }
    if (!this.hasDisorder(disorder.getDisorderID())) {
      editor.getDisorderLegend().addCase(disorder.getDisorderID(), disorder.getName(), this.getID());
      this.getDisorders().push(disorder.getDisorderID());
      this.getGraphics().updateDisordersLabel && this.getGraphics().updateDisordersLabel();
    } else {
      alert('This person already has the specified disorder');
    }

    // if any "real" disorder has been added
    // the virtual "affected" disorder should be automatically removed
    if (this.getDisorders().length > 1) {
      this.removeDisorder('affected');
    }
  },

  /**
     * Removes disorder from the list of this node's disorders and updates the Legend.
     *
     * @method removeDisorder
     * @param {Number} disorderID id of the disorder to be removed
     */
  removeDisorder: function (disorderID) {
    if (this.hasDisorder(disorderID)) {
      editor.getDisorderLegend().removeCase(disorderID, this.getID());
      this._disorders = this.getDisorders().without(disorderID);
      this.getGraphics().updateDisordersLabel && this.getGraphics().updateDisordersLabel();
    } else {
      if (disorderID != 'affected') {
        alert('This person doesn\'t have the specified disorder');
      }
    }
  },

  /**
     * Sets the list of disorders of this person to the given list
     *
     * @method setDisorders
     * @param {Array} disorders List of Disorder objects
     */
  setDisorders: function (disorders) {
    for (var i = this.getDisorders().length - 1; i >= 0; i--) {
      this.removeDisorder(this.getDisorders()[i]);
    }
    for (var i = 0; i < disorders.length; i++) {
      this.addDisorder(disorders[i]);
    }
    this.getGraphics().updateDisorderShapes();
    this.getGraphics().updateDisordersLabel && this.getGraphics().updateDisordersLabel();
    this.setCarrierStatus(); // update carrier status
  },

  /**
     * Returns a list of all HPO terms associated with the patient
     *
     * @method getHPO
     * @return {Array} List of HPO IDs.
     */
  getHPO: function () {
    return this._hpo;
  },

  /**
     * Returns a list of phenotypes of this person, with non-scrambled IDs
     *
     * @method getHPOForExport
     * @return {Array} List of human-readable versions of HPO IDs
     */
  getHPOForExport: function () {
    var exportHPOs = this._hpo.slice(0);
    for (var i = 0; i < exportHPOs.length; i++) {
      exportHPOs[i] = HPOTerm.desanitizeID(exportHPOs[i]);
    }
    return exportHPOs;
  },

  /**
     * Adds HPO term to the list of this node's phenotypes and updates the Legend.
     *
     * @method addHPO
     * @param {HPOTerm} hpo HPOTerm object or a free-text name string
     */
  addHPO: function (hpo) {
    if (typeof hpo != 'object') {
      hpo = editor.getHPOLegend().getTerm(hpo);
    }
    if (!this.hasHPO(hpo.getID())) {
      editor.getHPOLegend().addCase(hpo.getID(), hpo.getName(), this.getID());
      this.getHPO().push(hpo.getID());
      this.getGraphics().updateHPOLabel && this.getGraphics().updateHPOLabel();
    } else {
      alert('This person already has the specified phenotype');
    }
  },

  /**
     * Removes HPO term from the list of this node's terms and updates the Legend.
     *
     * @method removeHPO
     * @param {Number} hpoID id of the term to be removed
     */
  removeHPO: function (hpoID) {
    if (this.hasHPO(hpoID)) {
      editor.getHPOLegend().removeCase(hpoID, this.getID());
      this._hpo = this.getHPO().without(hpoID);
      this.getGraphics().updateHPOLabel && this.getGraphics().updateHPOLabel();
    } else {
      alert('This person doesn\'t have the specified HPO term');
    }
  },

  /**
     * Sets the list of HPO temrs of this person to the given list
     *
     * @method setHPO
     * @param {Array} hpos List of HPOTerm objects
     */
  setHPO: function (hpos) {
    for (var i = this.getHPO().length - 1; i >= 0; i--) {
      this.removeHPO(this.getHPO()[i]);
    }
    for (var i = 0; i < hpos.length; i++) {
      this.addHPO(hpos[i]);
    }
    this.getGraphics().updateHPOLabel && this.getGraphics().updateHPOLabel();
  },

  /**
     * @method hasHPO
     * @param {Number} id Term ID, taken from the HPO database
     */
  hasHPO: function (id) {
    return (this.getHPO().indexOf(id) != -1);
  },

  /**
     * Adds gene to the list of this node's candidate genes
     *
     * @method addGenes
     */
  addGene: function (gene) {
    if (this.getGenes().indexOf(gene) == -1) {
      this.getGenes().push(gene);
      this._syncGeneLegend();
      this.getGraphics().updateGenesLabel && this.getGraphics().updateGenesLabel();
    }
  },

  /**
     * Removes gene from the list of this node's candidate genes
     *
     * @method removeGene
     */
  removeGene: function (gene) {
    if (this.getGenes().indexOf(gene) !== -1) {
      this._candidateGenes = this.getGenes().without(gene);
      this._syncGeneLegend();
      this.getGraphics().updateGenesLabel && this.getGraphics().updateGenesLabel();
    }
  },

  /**
     * Sets the list of candidate genes of this person to the given list
     *
     * @method setGenes
     * @param {Array} genes List of gene names (as strings)
     */
  setGenes: function (genes) {
    for (var i = this.getGenes().length - 1; i >= 0; i--) {
      this.removeGene(this.getGenes()[i]);
    }
    for (var i = 0; i < genes.length; i++) {
      this.addGene(genes[i]);
    }
    this._syncGeneLegend();
    this.getGraphics().updateDisordersLabel && this.getGraphics().updateDisordersLabel();
  },

  /**
     * Returns a list of candidate genes for this person.
     *
     * @method getGenes
     * @return {Array} List of gene names.
     */
  getGenes: function () {
    return this._candidateGenes;
  },

  /**
   * Structured genetic test results (see model/clinicalData.js). Returns a copy.
   *
   * @method getGeneticTests
   * @return {Array}
   */
  getGeneticTests: function () {
    return clone(this._geneticTests);
  },

  setGeneticTests: function (tests) {
    this._geneticTests = normalizeTests(tests);
    this._syncGeneLegend();
    this.getGraphics().updateTestsLabel && this.getGraphics().updateTestsLabel();
  },

  /**
   * Diagnosis details keyed by disorder name (see model/clinicalData.js). Returns a copy.
   *
   * @method getDisorderDetails
   * @return {Object}
   */
  getDisorderDetails: function () {
    return clone(this._disorderDetails);
  },

  setDisorderDetails: function (details) {
    this._disorderDetails = normalizeDetails(details);
    this.getGraphics().updateDisordersLabel && this.getGraphics().updateDisordersLabel();
  },

  /**
   * Details for one disorder (by id or name), or null.
   */
  getDisorderDetail: function (disorderId) {
    var name = Disorder.desanitizeID(disorderId);
    var d = this._disorderDetails[name] || this._disorderDetails[disorderId];
    return d ? clone(d) : null;
  },

  // Invitae/Progeny elements this editor does not use, kept verbatim for round trips
  getInvitaeExtra: function () {
    return this._invitaeExtra ? clone(this._invitaeExtra) : null;
  },

  /**
     * Removes the node and its visuals.
     *
     * @method remove
     * @param [skipConfirmation=false] {Boolean} if true, no confirmation box will pop up
     */
  remove: function ($super) {
    // the labels are about to be deleted: do not lay them out again after each step below
    // (never resumed on purpose; measuring text is the slowest part of drawing a person)
    var graphics = this.getGraphics();
    if (graphics) {
      graphics._labelBatchDepth = (graphics._labelBatchDepth || 0) + 1;
    }
    this.setDisorders([]);  // remove disorders form the legend
    this.setHPO([]);
    this.setGenes([]);
    this._geneticTests = [];
    this._syncGeneLegend();
    $super();
  },

  /**
     * Returns disorder with given id if this person has it. Returns null otherwise.
     *
     * @method getDisorderByID
     * @param {Number} id Disorder ID, taken from the OMIM database
     * @return {Disorder}
     */
  hasDisorder: function (id) {
    return (this.getDisorders().indexOf(id) != -1);
  },

  /**
     * Changes the childless status of this Person. Nullifies the status if the given status is not
     * "childless" or "infertile". Modifies the status of the partnerships as well.
     *
     * @method setChildlessStatus
     * @param {String} status Can be "childless", "infertile" or null
     * @param {Boolean} ignoreOthers If True, changing the status will not modify partnerships's statuses or
     * detach any children
     */
  setChildlessStatus: function (status) {
    if (!this.isValidChildlessStatus(status)) {
      status = null;
    }
    if (status != this.getChildlessStatus()) {
      this._childlessStatus = status;
      this.getGraphics().updateChildlessShapes();
      this.getGraphics().updateChildlessStatusLabel();
      this.getGraphics().getHoverBox().regenerateHandles();
    }
    return this.getChildlessStatus();
  },

  /**
   * Siblings this person can be made a twin of (same parents), for "Twin of" in the sibling bubble.
   * current: a sibling already in this person's twin group, or ''.
   */
  _twinOfOptions: function (twins) {
    var graph = editor.getGraph();
    var id = this.getID();
    var result = { current: '', options: [] };
    var parentRel = graph.getParentRelationship(id);
    if (parentRel === null || parentRel === undefined || this.isFetus()) {
      return result;
    }
    var numbering = computeStandardNumbering(editor);
    graph.getAllChildren(parentRel).forEach(function (sib) {
      if (sib == id || !graph.isPerson(sib) || graph.isPlaceholder(sib)) {
        return;
      }
      var props = graph.getProperties(sib) || {};
      var name = [props.fName, props.lName].filter(function (s) { return s; }).join(' ');
      var std = numbering.byId[sib] ? numbering.byId[sib].label : '';
      var kin = translate(props.gender === 'F' ? 'Sister' : props.gender === 'M' ? 'Brother' : 'Sibling');
      var label = std ? std + ' · ' + (name || kin.toLowerCase()) : (name || kin);
      result.options.push({ id: String(sib), label: label });
    });
    if (twins.length > 1) {
      result.current = String(twins.filter(function (t) { return t != id; })[0]);
    }
    return result;
  },

  /**
     * Returns an object (to be accepted by the menu) with information about this Person
     *
     * @method getSummary
     * @return {Object} Summary object for the menu
     */
  getSummary: function () {
    var inactiveStates;
    if (this.isFetus()) {
      inactiveStates = ['alive', 'deceased'];
    } else {
      inactiveStates = ['unborn', 'aborted', 'miscarriage', 'stillborn'];
    }

    var inactiveGenders = false;
    var genderSet = editor.getGraph().getPossibleGenders(this.getID());
    for (var gender in genderSet) {
      if (genderSet.hasOwnProperty(gender)) {
        if (!genderSet[gender]) {
          inactiveGenders = [gender];
        }
      }
    }

    var childlessInactive = this.isFetus();  // TODO: can a person which already has children become childless?
    // maybe: use editor.getGraph().hasNonPlaceholderNonAdoptedChildren() ?
    var disorders = [];
    this.getDisorders().forEach(function (disorder) {
      var disorderName = editor.getDisorderLegend().getDisorder(disorder).getName();
      disorders.push({ id: disorder, value: disorderName });
    });
    var hpoTerms = [];
    this.getHPO().forEach(function (hpo) {
      var termName = editor.getHPOLegend().getTerm(hpo).getName();
      hpoTerms.push({ id: hpo, value: termName });
    });

    var cantChangeAdopted = editor.getGraph().hasToBeAdopted(this.getID());

    var inactiveMonozygothic = true;
    var disableMonozygothic = true;
    var twins = editor.getGraph().getAllTwinsSortedByOrder(this.getID());
    if (twins.length > 1) {
      // monozygotic twins share the sex (the sex at birth when recorded, else the symbol); their
      // gender identity may differ
      inactiveMonozygothic = false;
      var graph = editor.getGraph();
      var sexes = twins.map(function (t) { return sexOfProperties(graph.getProperties(t)); });
      disableMonozygothic = !canShareSex(sexes);
    }

    var inactiveCarriers = [];
    if (disorders.length > 0) {
      if (disorders.length != 1 || disorders[0].id != 'affected') {
        inactiveCarriers = [''];
      }
    }
    if (this.getLifeStatus() == 'aborted' || this.getLifeStatus() == 'miscarriage') {
      inactiveCarriers.push('presymptomatic');
    }

    var inactiveLostContact = this.isProband() || !editor.getGraph().isRelatedToProband(this.getID());

    return {
      identifier: { value: this.getID() },
      name: { value: this.getName() },
      first_name: { value: this.getFirstName() },
      last_name: { value: this.getLastName() },
      external_id: { value: this.getExternalID() },
      gender: { value: this.getGender(), inactive: inactiveGenders },
      age_input: { value: this.getAgeInput(), inactive: this.isFetus() },
      date_of_birth: { value: this.getBirthDate(), inactive: this.isFetus() },
      carrier: { value: this.getCarrierStatus(), disabled: inactiveCarriers },
      disorders: { value: disorders },
      candidate_genes: { value: this.getGenes() },
      clinical_details: { value: { tests: this.getGeneticTests(), details: this.getDisorderDetails(), disorders: disorders, candidateGenes: this.getGenes().slice(0) } },
      adoption: { value: this.getAdoptionStatus(), inactive: this.isFetus(), disabled: cantChangeAdopted ? ['', 'out'] : false },
      state: { value: this.getLifeStatus(), inactive: inactiveStates },
      date_of_death: { value: this.getDeathDate(), inactive: this.isFetus() || this.getLifeStatus() !== 'deceased' },
      comments: { value: this.getComments(), inactive: false },
      gestation_age: { value: this.getGestationAge(), inactive: !this.isFetus() },
      childlessSelect: { value: this.getChildlessStatus() ? this.getChildlessStatus() : 'none', inactive: childlessInactive },
      childless_reason: { value: this.getChildlessReason(), inactive: !this.getChildlessStatus() },
      sex_at_birth: { value: this.getSexAtBirth(), inactive: this.isFetus() },
      art_role: { value: this.getArtRole(), inactive: this.isFetus() },
      history_unknown: { value: this.getHistoryUnknown(), inactive: this.isFetus() },
      collapsed: { value: this.getCollapsed(), inactive: !this.getCollapsed() && editor.getGraph().getBranchSize(this.getID()) == 0 },
      placeholder: { value: false, inactive: true },
      monozygotic: { value: this.getMonozygotic(), inactive: inactiveMonozygothic, disabled: disableMonozygothic },
      zygosity_unknown: { value: this.getZygosityUnknown(), inactive: inactiveMonozygothic || this.getMonozygotic() },
      consultand: { value: this.isConsultand(), inactive: this.isVirtual() || this.isFetus() },
      evaluated: { value: this.getEvaluated() },
      hpo_positive: { value: hpoTerms },
      nocontact: { value: this.getLostContact(), inactive: inactiveLostContact },
      ancestry: { value: this.getAncestry() },
      age_at_death: { value: this.getAgeAtDeath(), inactive: this.getLifeStatus() !== 'deceased' },
      proband: { value: this.isProband(), inactive: this.isProband() || this.isVirtual() }
    };
  },

  /**
     * Returns an object containing all the properties of this node
     * except id, x, y & type
     *
     * @method getProperties
     * @return {Object} in the form
     *
     {
       property: value
     }
     */
  getProperties: function ($super) {
    // note: properties equivalent to default are not set
    var info = $super();
    if (this.getName() != '') {
      info['name'] = this.getName();
      info['fName'] = this.getName();
    }
    if (this.getLastName() != '') {
      info['lName'] = this.getLastName();
    }
    if (this.getExternalID() != '') {
      info['externalID'] = this.getExternalID();
    }
    if (this.getBirthDate() != '') {
      info['dob'] = this.getBirthDate().toDateString();
    }
    if (this.isAdopted()) {
      info['isAdopted'] = this.isAdopted();
    }
    if (this.isAdoptedOut()) {
      info['adoptedOut'] = true;
    }
    if (this.getLifeStatus() != 'alive') {
      info['lifeStatus'] = this.getLifeStatus();
    }
    if (this.getDeathDate() != '') {
      info['dod'] = this.getDeathDate().toDateString();
    }
    if (this.getGestationAge() != null) {
      info['gestationAge'] = this.getGestationAge();
    }
    if (this.getChildlessStatus() != null) {
      info['childlessStatus'] = this.getChildlessStatus();
      if (this.getChildlessReason()) {
        info['childlessReason'] = this.getChildlessReason();
      }
    }
    if (this._sexAtBirth) {
      info['sexAtBirth'] = this._sexAtBirth;
    }
    if (this._artRole) {
      info['artRole'] = this._artRole;
    }
    if (this._artKey !== null) {
      info['artKey'] = this._artKey;
    }
    if (this._artLinks.length > 0) {
      info['artLinks'] = this.getArtLinks();
    }
    if (this._historyUnknown) {
      info['historyUnknown'] = true;
    }
    if (this._collapsed) {
      info['collapsed'] = true;
    }
    if (this.getDisorders().length > 0) {
      info['disorders'] = this.getDisordersForExport();
    }
    if (this.getHPO().length > 0) {
      info['hpoTerms'] = this.getHPOForExport();
    }
    if (this.getGenes().length > 0) {
      info['candidateGenes'] = this.getGenes();
    }
    if (this._geneticTests.length > 0) {
      info['geneticTests'] = this.getGeneticTests();
    }
    if (Object.keys(this._disorderDetails).length > 0) {
      info['disorderDetails'] = this.getDisorderDetails();
    }
    if (this._invitaeExtra) {
      info['invitaeExtra'] = this.getInvitaeExtra();
    }
    if (this._ancestry.length > 0) {
      info['ethnicities'] = this.getAncestry();
    }
    if (this._ageAtDeath) {
      info['ageAtDeath'] = this._ageAtDeath;
    }
    if (this._twinGroup !== null) {
      info['twinGroup'] = this._twinGroup;
    }
    if (this._monozygotic) {
      info['monozygotic'] = this._monozygotic;
    }
    if (this._zygosityUnknown) {
      info['zygosityUnknown'] = true;
    }
    if (this._consultand) {
      info['consultand'] = true;
    }
    if (this._evaluated) {
      info['evaluated'] = this._evaluated;
    }
    if (this._carrierStatus) {
      info['carrierStatus'] = this._carrierStatus;
    }
    if (this.getLostContact()) {
      info['lostContact'] = this.getLostContact();
    }
    // node 0 is the proband by default, so only record deviations from that default
    if (this._isProband && this.getID() != 0) {
      info['probandFlag'] = true;
    } else if (!this._isProband && this.getID() == 0) {
      info['probandFlag'] = false;
    }
    if (this.getDobApprox()) {
      info['dobApprox'] = true;
    }
    if (this.getAgeInput() && this.getAgeInput() !== '') {
      info['ageInput'] = this.getAgeInput();
    }
    return info;
  },

  /**
      * Applies the properties found in info to this node.
      *
      * @method assignProperties
      * @param properties Object
      * @return {Boolean} True if info was successfully assigned
      */
  assignProperties: function ($super, info) {
    // every property redraws its own label: lay the labels out once, after all of them are set
    var _this = this;
    var graphics = this.getGraphics();
    if (graphics && graphics.batchLabelUpdates) {
      return graphics.batchLabelUpdates(function () { return _this._assignProperties($super, info); });
    }
    return this._assignProperties($super, info);
  },

  _assignProperties: function (superAssign, info) {
    this._setDefault();

    if (superAssign(info)) {
      if (info.name && this.getName() != info.name) {
        this.setName(info.name);
      } else if ((info.fName || info.lName) && (this.getName() != info.fName || (info.lName && this.getLastName() != info.lName))) {
        var combined = ((info.fName || '') + ' ' + (info.lName || '')).trim();
        this.setName(combined);
      }
      if (info.externalID && this.getExternalID() != info.externalID) {
        this.setExternalID(info.externalID);
      }
      if (info.dob && this.getBirthDate() != info.dob) {
        this.setBirthDate(info.dob);
      }
      if (info.disorders) {
        this.setDisorders(info.disorders);
      }
      if (info.hpoTerms) {
        this.setHPO(info.hpoTerms);
      }
      if (info.candidateGenes) {
        this.setGenes(info.candidateGenes);
      }
      if (info.geneticTests) {
        this.setGeneticTests(info.geneticTests);
      }
      if (info.disorderDetails) {
        this.setDisorderDetails(info.disorderDetails);
      }
      if (info.invitaeExtra && typeof info.invitaeExtra === 'object') {
        this._invitaeExtra = clone(info.invitaeExtra);
      }
      // ancestry: "ethnicities" (PhenoTips format); earlier versions of this editor used a
      // single "ashkenazi" flag, which becomes the "Ashkenazi Jewish" ancestry
      var ancestry = normalizeAncestry(info.ethnicities);
      if (info.ashkenazi && !hasAshkenaziAncestry(ancestry)) {
        ancestry.push('Ashkenazi Jewish');
      }
      this.setAncestry(ancestry); // also refreshes (or clears) the ancestry label
      if (info.ageAtDeath) {
        this._ageAtDeath = String(info.ageAtDeath);
      } else if (this.getComments && /^Age at death:\s*(.+)$/m.test(this.getComments() || '')) {
        // older Invitae/Progeny imports kept the age at death as a line in the comments: move it
        var m = this.getComments().match(/^Age at death:\s*(.+)$/m);
        this._ageAtDeath = m[1].trim();
        this._comments = this.getComments().replace(/^Age at death:.*(\r?\n)?/m, '').trim();
        this.getGraphics().updateCommentsLabel && this.getGraphics().updateCommentsLabel();
      }
      if (this._ageAtDeath) {
        this.getGraphics().updateAgeLabel && this.getGraphics().updateAgeLabel();
      }
      if (info.hasOwnProperty('isAdopted') && this.isAdopted() != info.isAdopted) {
        this.setAdopted(info.isAdopted);
      }
      this._adoptedOut = !!info.adoptedOut && !this.isAdopted();
      this._updateAdoptedShape();
      if (info.hasOwnProperty('lifeStatus') && this.getLifeStatus() != info.lifeStatus) {
        this.setLifeStatus(info.lifeStatus);
      }
      if (info.dod && this.getDeathDate() != info.dod) {
        this.setDeathDate(info.dod);
      }
      if (info.gestationAge && this.getGestationAge() != info.gestationAge) {
        this.setGestationAge(info.gestationAge);
      }
      if (info.childlessStatus && this.getChildlessStatus() != info.childlessStatus) {
        this.setChildlessStatus(info.childlessStatus);
      } else if (!info.childlessStatus && this.getChildlessStatus()) {
        this.setChildlessStatus(null);
      }
      // _setDefault() cleared the values but not what is drawn: the setters would see no change
      this._childlessReason = String(info.childlessReason || '').trim();
      this.getGraphics().updateChildlessStatusLabel();
      this._sexAtBirth = ['AMAB', 'AFAB', 'UAAB'].indexOf(info.sexAtBirth) !== -1 ? info.sexAtBirth : '';
      this.getGraphics().updateSexAtBirthLabel();
      this._artRole = (info.artRole === 'donor' || info.artRole === 'surrogate') ? info.artRole : '';
      this._historyUnknown = !!info.historyUnknown;
      this._collapsed = !!info.collapsed;
      this.setArtKey(info.artKey);
      this.setArtLinks(info.artLinks);
      if (info.hasOwnProperty('twinGroup') && this._twinGroup != info.twinGroup) {
        this.setTwinGroup(info.twinGroup);
      }
      if (info.hasOwnProperty('monozygotic') && this._monozygotic != info.monozygotic) {
        this.setMonozygotic(info.monozygotic);
      }
      this._zygosityUnknown = !!info.zygosityUnknown && !this._monozygotic;
      if (this._consultand != !!info.consultand) {
        this._consultand = !!info.consultand;
        this.getGraphics().setGenderGraphics();  // the arrow was drawn before this was known
      }
      if (info.hasOwnProperty('evaluated') && this._evaluated != info.evaluated) {
        this.setEvaluated(info.evaluated);
      }
      if (info.hasOwnProperty('carrierStatus') && this._carrierStatus != info.carrierStatus) {
        this.setCarrierStatus(info.carrierStatus);
      }
      if (info.hasOwnProperty('lostContact') && this.getLostContact() != info.lostContact) {
        this.setLostContact(info.lostContact);
      }
      // drawn as the proband only if the data says this is THE proband (one per pedigree)
      this._isProband = Person._isGraphProband(this.getID());
      if (info.hasOwnProperty('dobApprox')) {
        this.setDobApprox(info.dobApprox);
      }
      if (info.hasOwnProperty('ageInput') && info.ageInput !== '') {
        this._ageInput = info.ageInput;
      }
      if (info.hasOwnProperty('isVirtualParent')) {
        this._isVirtualParent = !!info.isVirtualParent;
      }
      if (info.hasOwnProperty('isVirtualDummyChild')) {
        this._isVirtualDummyChild = !!info.isVirtualDummyChild;
      }
      if (info.hasOwnProperty('isPlaceholder')) {
        this._isVirtualDummyChild = this._isVirtualDummyChild || !!info.isPlaceholder;
      }
      if (this.isVirtual() || this.isHiddenBranch()) {
        this.getGraphics().hideAll();
      }
      return true;
    }
    return false;
  }
});

//ATTACHES CHILDLESS BEHAVIOR METHODS TO THIS CLASS
Person.addMethods(ChildlessBehavior);

/** True when the data names this person as the proband (see DynamicGraph.getProbandId) */
Person._isGraphProband = function (id) {
  try {
    return editor.getGraph().getProbandId() == id;
  } catch (e) {
    return id == 0;
  }
};

export default Person;
