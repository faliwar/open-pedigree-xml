import Disorder from 'pedigree/disorder';
import HPOTerm from 'pedigree/hpoTerm';
import Raphael from 'pedigree/raphael';
import { Timer } from 'pedigree/model/helpers';
import AbstractPersonVisuals from 'pedigree/view/abstractPersonVisuals';
import { ChildlessBehaviorVisuals} from 'pedigree/view/abstractNodeVisuals';
import PersonHoverbox from 'pedigree/view/personHoverbox';
import ReadOnlyHoverbox from 'pedigree/view/readonlyHoverbox';
import PedigreeEditorParameters from 'pedigree/pedigreeEditorParameters';
import { getElementHalfHeight, sector } from 'pedigree/view/graphicHelpers';
import getAge from 'pedigree/view/ageCalc';
import { testLabel as clinicalTestLabel, compactAge } from 'pedigree/model/clinicalData';
import { translate } from 'pedigree/i18n';

/**
 * Class for organizing graphics for Person nodes.
 *
 * @class PersonVisuals
 * @extends AbstractPersonVisuals
 * @constructor
 * @param {Person} node The node for which the graphics are handled
 * @param {Number} x The x coordinate on the canvas
 * @param {Number} y The y coordinate on the canvas
 */

/**
 * Helper function to extract full name from a person node or object,
 * supporting unified name field and falling back to legacy firstName and lastName fields.
 *
 * @param {Person|Object} person
 * @return {String}
 */
function getIndividualFullName(person) {
  if (!person) return '';
  var name = '';
  if (typeof person.getName === 'function') {
    name = person.getName();
  }
  if (!name && typeof person.name === 'string') {
    name = person.name;
  }
  if (!name && typeof person._name === 'string') {
    name = person._name;
  }
  if (!name) {
    var fName = (typeof person.getFirstName === 'function'
      ? person.getFirstName()
      : (person.firstName || person.fName || person._firstName)) || '';
    var lName = (typeof person.getLastName === 'function'
      ? person.getLastName()
      : (person.lastName || person.lName || person._lastName)) || '';
    name = (fName + ' ' + lName).trim();
  }
  return (name || '').trim();
}

/**
 * Tokenizes and formats a person's name based on nameDisplayFormat setting:
 * - 'full': Full Name (default)
 * - 'first_last': First & Last Name
 * - 'first': First Name Only
 * - 'none': Empty string (suppresses name label)
 *
 * @param {Person|Object} person
 * @param {String} [format] Optional format override
 * @return {String}
 */
function formatIndividualName(person, format) {
  var formatSetting = format;
  if (!formatSetting) {
    if (typeof PedigreeEditorParameters !== 'undefined' &&
        PedigreeEditorParameters.attributes &&
        PedigreeEditorParameters.attributes.nameDisplayFormat) {
      formatSetting = PedigreeEditorParameters.attributes.nameDisplayFormat;
    } else {
      formatSetting = 'full';
    }
  }

  if (formatSetting === 'none') {
    return '';
  }

  var fullName = getIndividualFullName(person);
  if (!fullName) {
    return '';
  }

  if (formatSetting === 'full') {
    return fullName;
  }

  var tokens = fullName.trim().split(/\s+/).filter(Boolean);
  if (tokens.length === 0) {
    return '';
  }

  if (formatSetting === 'first') {
    return tokens[0];
  }

  if (formatSetting === 'first_last') {
    if (tokens.length <= 1) {
      return tokens[0];
    }
    return tokens[0] + ' ' + tokens[tokens.length - 1];
  }

  return fullName;
}

var PersonVisuals = Class.create(AbstractPersonVisuals, {

  initialize: function($super, node, x, y) {
    //var timer = new Timer();
    //console.log("person visuals");
    $super(node, x, y);
    this._nameLabel = null;
    this._stillBirthLabel = null;
    this._ageLabel = null;
    this._externalIDLabel = null;
    this._commentsLabel = null;
    this._childlessStatusLabel = null;
    this._disorderShapes = null;
    this._deadShape = null;
    this._unbornShape = null;
    this._childlessShape = null;
    this._isSelected = false;
    this._carrierGraphic = null;
    this._evalLabel = null;
    this._disordersLabel = null;
    this._hpoLabel = null;
    this._genesLabel = null;
    this._testsLabel = null;
    this._ancestryLabel = null;
    //console.log("person visuals end");
    //timer.printSinceLast("Person visuals time");
  },

  _wrapText: function(text, maxChars) {
    if (!text) return '';
    maxChars = maxChars || 15;
    var paragraphs = text.split('\n');
    var allLines = [];
    for (var p = 0; p < paragraphs.length; p++) {
      var para = paragraphs[p];
      if (para.length === 0) continue;
      // Split strictly on standard ASCII space ' ' so \u00A0 stays attached
      var words = para.split(' ');
      var currentLine = '';
      for (var i = 0; i < words.length; i++) {
        var word = words[i];
        if (word.length === 0) continue;
        if (currentLine.length + word.length > maxChars && currentLine.length > 0) {
          allLines.push(currentLine.replace(/^ +| +$/g, ''));
          currentLine = word + ' ';
        } else {
          currentLine += word + ' ';
        }
      }
      if (currentLine.length > 0) {
        allLines.push(currentLine.replace(/^ +| +$/g, ''));
      }
    }
    return allLines.join('\n');
  },

  generateHoverbox: function(x, y) {
    if (this.getNode().isVirtual && this.getNode().isVirtual()) {
      var hb = new ReadOnlyHoverbox(this.getNode(), x, y, editor.getPaper().set());
      hb.disable();
      hb.getFrontElements().hide();
      hb.getBackElements().hide();
      return hb;
    }
    if (editor.isReadOnlyMode()) {
      return new ReadOnlyHoverbox(this.getNode(), x, y, this.getGenderGraphics());
    } else {
      return new PersonHoverbox(this.getNode(), x, y, this.getGenderGraphics());
    }
  },

  /**
     * Draws the icon for this Person depending on the gender, life status and whether this Person is the proband.
     * Updates the disorder shapes.
     *
     * @method setGenderGraphics
     */
  setGenderGraphics: function($super) {
    //console.log("set gender graphics");
    if (this.getNode().isVirtual && this.getNode().isVirtual()) {
      this._genderGraphics && this._genderGraphics.remove();
      this._genderShape = editor.getPaper().path('').hide();
      this._genderGraphics = editor.getPaper().set(this._genderShape);
      this._genderGraphics.hide();
      return;
    }
    if(this.getNode().getLifeStatus() == 'aborted' || this.getNode().getLifeStatus() == 'miscarriage') {
      this._genderGraphics && this._genderGraphics.remove();

      var radius = PedigreeEditorParameters.attributes.radius;
      if (this.getNode().isPersonGroup()) {
        radius *= PedigreeEditorParameters.attributes.groupNodesScale;
      }
      this._shapeRadius = radius;

      var side = radius * Math.sqrt(3.5),
        height = side/Math.sqrt(2),
        x = this.getX() - height,
        y = this.getY();
      var shape = editor.getPaper().path(['M',x, y, 'l', height, -height, 'l', height, height,'z']);
      shape.attr(PedigreeEditorParameters.attributes.nodeShape);
      this._genderShape = shape;
      shape = editor.getPaper().set(shape);

      if(this.getNode().isProband()) {
        shape.transform(['...s', 1.07]);
        shape.attr('stroke-width', 5);
      }

      if(this.getNode().getGender() == 'U') {
        this._genderGraphics = shape;
      } else {
        x = this.getX();
        y = this.getY() + radius/1.4;
        var text = (this.getNode().getGender() == 'M') ? 'Male' : 'Female';
        var genderLabel = editor.getPaper().text(x, y, text).attr(PedigreeEditorParameters.attributes.label);
        this._genderGraphics = editor.getPaper().set(shape, genderLabel);
      }
    } else {
      $super();
    }

    if(this.getNode().isProband()) {
      this._genderGraphics.push(this.generateProbandArrow());
      this.getGenderShape().transform(['...s', 1.08]);
      this.getGenderShape().attr('stroke-width', 5.5);
    }
    if(!editor.isUnsupportedBrowser() && this.getHoverBox()) {
      this._genderGraphics.flatten().insertBefore(this.getFrontElements().flatten());
    }
    this.updateDisorderShapes();
    this.updateCarrierGraphic();
    this.updateEvaluationLabel();
  },

  generateProbandArrow: function() {
    var icon = editor.getPaper().path(editor.getView().__probandArrowPath).attr({fill: '#000000', stroke: 'none', opacity: 1});
    var x = this.getX()-this._shapeRadius-26;
    var y = this.getY()+this._shapeRadius-12;
    if (this.getNode().getGender() == 'F') {
      x += 5;
      y -= 5;
    }
    icon.transform(['t' , x, y]);
    return icon;
  },

  /**
     * Returns all graphical elements that are behind the gender graphics
     *
     * @method getBackElements
     * @return {Raphael.st}
     */
  getBackElements: function() {
    return this.getHoverBox().getBackElements().concat(editor.getPaper().set(this.getChildlessStatusLabel(), this.getChildlessShape()));
  },

  /**
     * Returns all graphical elements that should receive mouse focus/clicks
     *
     * @method getFrontElements
     * @return {Raphael.st}
     */
  getFrontElements: function() {
    return this.getHoverBox().getFrontElements();
  },

  /**
     * Updates the external ID label for this Person
     *
     * @method updateExternalIDLabel
     */
  updateExternalIDLabel: function() {
    this._externalIDLabel && this._externalIDLabel.remove();

    if (this.getNode().getExternalID()) {
      var text = this._wrapText('[' + this.getNode().getExternalID() + ']', 15);
      this._externalIDLabel = editor.getPaper().text(this.getX(), this.getY() + PedigreeEditorParameters.attributes.radius, text).attr(PedigreeEditorParameters.attributes.externalIDLabels);
      this._externalIDLabel.alignTop = true;
    } else {
      this._externalIDLabel = null;
    }
    this.drawLabels();
  },

  /**
     * Returns the Person's external ID label
     *
     * @method getExternalIDLabel
     * @return {Raphael.el}
     */
  getExternalIDLabel: function() {
    return this._externalIDLabel;
  },

  /**
     * Updates the name label for this Person
     *
     * @method updateNameLabel
     */
  updateNameLabel: function() {
    this._nameLabel && this._nameLabel.remove();
    var text = formatIndividualName(this.getNode());
    if (text) {
      text = this._wrapText ? this._wrapText(text.trim(), 15) : text.trim();
    }

    if(text && text.trim() != '') {
      this._nameLabel = editor.getPaper().text(this.getX(), this.getY() + PedigreeEditorParameters.attributes.radius, text).attr(PedigreeEditorParameters.attributes.nameLabels);
      this._nameLabel.alignTop = true;
    } else {
      this._nameLabel = null;
    }
    this.drawLabels();
  },

  /**
     * Returns the Person's name label
     *
     * @method getNameLabel
     * @return {Raphael.el}
     */
  getNameLabel: function() {
    return this._nameLabel;
  },

  /**
     * Returns colored blocks representing disorders
     *
     * @method getDisorderShapes
     * @return {Raphael.st} Set of disorder shapes
     */
  getDisorderShapes: function() {
    return this._disorderShapes;
  },

  /**
     * Displays the disorders currently registered for this node.
     *
     * @method updateDisorderShapes
     */
  updateDisorderShapes: function() {
    this._disorderShapes && this._disorderShapes.remove();
    var colors = this.getNode().getAllNodeColors();
    if (colors.length == 0) {
      return;
    }

    var disorderShapes = editor.getPaper().set();
    var delta, color;

    if (this.getNode().getLifeStatus() == 'aborted' || this.getNode().getLifeStatus() == 'miscarriage') {
      var radius = PedigreeEditorParameters.attributes.radius;
      if (this.getNode().isPersonGroup()) {
        radius *= PedigreeEditorParameters.attributes.groupNodesScale;
      }

      var side = radius * Math.sqrt(3.5),
        height = side/Math.sqrt(2),
        x1 = this.getX() - height,
        y1 = this.getY();
      delta = (height * 2)/(colors.length);

      for(var k = 0; k < colors.length; k++) {
        var corner = [];
        var x2 = x1 + delta;
        var y2 = this.getY() - (height - Math.abs(x2 - this.getX()));
        if (x1 < this.getX() && x2 >= this.getX()) {
          corner = ['L', this.getX(), this.getY()-height];
        }
        var slice = editor.getPaper().path(['M', x1, y1, corner,'L', x2, y2, 'L',this.getX(), this.getY(),'z']);
        // Use flat/plain color fill (Invitae style - no gradients)
        color = colors[k];
        disorderShapes.push(slice.attr({fill: color, 'stroke-width':.5, stroke: 'none' }));
        x1 = x2;
        y1 = y2;
      }
      if(this.getNode().isProband()) {
        disorderShapes.transform(['...s', 1.04, 1.04, this.getX(), this.getY()-this._shapeRadius]);
      }
    } else {
      var disorderAngle = (360/colors.length).round();
      delta = (360/(colors.length))/2;
      if (colors.length == 1 && this.getNode().getGender() == 'U') {
        delta -= 45;
      } // since this will be rotated by shape transform later

      var radius = (this._shapeRadius-0.6);    // -0.6 to avoid disorder fills to overlap with shape borders (due to aliasing/Raphael pixel layout)
      if (this.getNode().getGender() == 'U') {
        radius *= 1.155;
      }                     // TODO: magic number hack: due to a Raphael transform bug (?) just using correct this._shapeRadius does not work

      for(var i = 0; i < colors.length; i++) {
        // Use flat/plain color fill (Invitae style - no gradients)
        color = colors[i];
        disorderShapes.push(sector(editor.getPaper(), this.getX(), this.getY(), radius,
          this.getNode().getGender(), i * disorderAngle, (i+1) * disorderAngle, color));
      }

      (disorderShapes.length < 2) ? disorderShapes.attr('stroke', 'none') : disorderShapes.attr({stroke: '#000000', 'stroke-width':.03});
      if(this.getNode().isProband()) {
        disorderShapes.transform(['...s', 1.04, 1.04, this.getX(), this.getY()]);
      }
    }
    this._disorderShapes = disorderShapes;
    this._disorderShapes.flatten().insertAfter(this.getGenderGraphics().flatten());
  },

  /**
     * Draws a line across the Person to display that he is dead (or aborted).
     *
     * @method drawDeadShape
     */
  drawDeadShape: function() {
    var strokeWidth = editor.getWorkspace().getSizeNormalizedToDefaultZoom(2.5);
    var x, y;
    if(this.getNode().getLifeStatus() == 'aborted') {
      var side   = PedigreeEditorParameters.attributes.radius * Math.sqrt(3.5);
      var height = side/Math.sqrt(2);
      if (this.getNode().isPersonGroup()) {
        height *= PedigreeEditorParameters.attributes.groupNodesScale;
      }

      var x = this.getX() - height/1.5;
      if (this.getNode().isPersonGroup()) {
        x -= PedigreeEditorParameters.attributes.radius/4;
      }

      var y = this.getY() + height/3;
      this._deadShape = editor.getPaper().path(['M', x, y, 'l', height + height/3, -(height+ height/3), 'z']);
      this._deadShape.attr('stroke-width', strokeWidth);
    } else {
      x = this.getX();
      y = this.getY();
      var coeff = 10.0/8.0 * (this.getNode().isPersonGroup() ? PedigreeEditorParameters.attributes.groupNodesScale : 1.0);
      var x1 = x - coeff * PedigreeEditorParameters.attributes.radius,
        y1 = y + coeff * PedigreeEditorParameters.attributes.radius,
        x2 = x + coeff * PedigreeEditorParameters.attributes.radius,
        y2 = y - coeff * PedigreeEditorParameters.attributes.radius;
      this._deadShape = editor.getPaper().path(['M', x1,y1,'L',x2, y2]).attr('stroke-width', strokeWidth);
    }
    if(!editor.isUnsupportedBrowser()) {
      this._deadShape.toFront();
      this._deadShape.node.setAttribute('class', 'no-mouse-interaction');
    }
  },

  /**
     * Returns the line drawn across a dead Person's icon
     *
     * @method getDeadShape
     * @return {Raphael.st}
     */
  getDeadShape: function() {
    return this._deadShape;
  },

  /**
     * Returns this Person's age label
     *
     * @method getAgeLabel
     * @return {Raphael.el}
     */
  getAgeLabel: function() {
    return this._ageLabel;
  },

  /**
     * Updates the age label for this Person
     *
     * @method updateAgeLabel
     */
  updateAgeLabel: function() {
    var text,
      person = this.getNode();
    if (person.isFetus()) {
      var date = person.getGestationAge();
      text = (date) ? date + ' weeks' : null;
    } else if(person.getLifeStatus() == 'alive') {
      if (person.getBirthDate()) {
        var age = getAge(person.getBirthDate(), null);
        if (age.indexOf(' y') !== -1) {
            text = age.replace(' y', ' yrs');
        } else {
            text = age;
        }
        // Add ~ prefix for approximate ages
        if (person.getDobApprox() && text) {
          text = '~' + text;
        }
      }
    } else {
      var ageAtDeath = person.getAgeAtDeath ? person.getAgeAtDeath() : '';
      if (ageAtDeath && !(person.getDeathDate() && person.getBirthDate() && !person.getDobApprox())) {
        // age at death as entered ("72" -> "d. 72 yrs"); exact dates win when both are known
        text = 'd. ' + (/^\d{1,3}$/.test(ageAtDeath) ? ageAtDeath + ' yrs' : ageAtDeath);
      } else if(person.getDeathDate() && person.getBirthDate()) {
        var age = getAge(person.getBirthDate(), person.getDeathDate());
        if (age.indexOf(' y') !== -1) {
            text = 'd. ' + age.replace(' y', ' yrs');
        } else {
            text = 'd. ' + age;
        }
        // Add ~ prefix for approximate ages
        if (person.getDobApprox() && text) {
          text = text.replace('d. ', 'd. ~');
        }
      } else if (person.getDeathDate()) {
        text = 'd. ' + person.getDeathDate().getFullYear();
      } else if(person.getBirthDate()) {
        text = person.getBirthDate().getFullYear() + ' – ?';
        if (person.getDobApprox()) {
          text = '~' + text;
        }
      }
    }

    if (text) {
      text = this._wrapText(text, 15);
    }

    this.getAgeLabel() && this.getAgeLabel().remove();
    this._ageLabel = text ? editor.getPaper().text(this.getX(), this.getY(), text).attr(PedigreeEditorParameters.attributes.label) : null;
    if (this._ageLabel) {
      this._ageLabel.alignTop = true;
    }
    this.drawLabels();
  },

  /**
     * Returns the shape marking a Person's 'unborn' life-status
     *
     * @method getUnbornShape
     * @return {Raphael.el}
     */
  getUnbornShape: function() {
    return this._unbornShape;
  },

  /**
     * Draws a "P" on top of the node to display this Person's 'unborn' life-status
     *
     * @method drawUnbornShape
     */
  drawUnbornShape: function() {
    this._unbornShape && this._unbornShape.remove();
    if(this.getNode().getLifeStatus() == 'unborn') {
      this._unbornShape = editor.getPaper().text(this.getX(), this.getY(), 'P').attr(PedigreeEditorParameters.attributes.unbornShape);
      if(!editor.isUnsupportedBrowser()) {
        this._unbornShape.insertBefore(this.getHoverBox().getFrontElements());
      }
    } else {
      this._unbornShape = null;
    }
  },

  /**
     * Draws the evaluation status symbol for this Person
     *
     * @method updateEvaluationLabel
     */
  updateEvaluationLabel: function() {
    this._evalLabel && this._evalLabel.remove();
    var evaluated = this.getNode().getEvaluated();
    if (evaluated) {
      if (this.getNode().getLifeStatus() == 'aborted' || this.getNode().getLifeStatus() == 'miscarriage') {
        var x = this.getX() + this._shapeRadius * 1.6;
        var y = this.getY() + this._shapeRadius * 0.6;
      } else {
        var mult = 1.1;
        if (this.getNode().getGender() == 'U') {
          mult = 1.3;
        } else if (this.getNode().getGender() == 'M') {
          mult = 1.4;
        }
        if (this.getNode().isProband()) {
          mult *= 1.1;
        }
        var x = this.getX() + this._shapeRadius*mult - 5;
        var y = this.getY() + this._shapeRadius*mult;
      }
      
      var displayChar = '*';
      if (evaluated === '+') {
        displayChar = '+';
      } else if (evaluated === '-') {
        displayChar = '-';
      }
      
      this._evalLabel = editor.getPaper().text(x, y, displayChar).attr(PedigreeEditorParameters.attributes.evaluationShape);
    } else {
      this._evalLabel = null;
    }
  },

  /**
     * Returns this Person's evaluation label
     *
     * @method getEvaluationGraphics
     * @return {Raphael.el}
     */
  getEvaluationGraphics: function() {
    return this._evalLabel;
  },

  /**
     * Draws various distorder carrier graphics such as a dot (for carriers) or
     * a vertical line (for pre-symptomatic)
     *
     * @method updateCarrierGraphic
     */
  updateCarrierGraphic: function() {
    var x;
    var y;

    this._carrierGraphic && this._carrierGraphic.remove();
    var status = this.getNode().getCarrierStatus();

    if (status != '' && status != 'affected') {
      if (status == 'carrier') {
        if (this.getNode().getLifeStatus() == 'aborted' || this.getNode().getLifeStatus() == 'miscarriage') {
          x = this.getX();
          y = this.getY() - this._radius/2;
        } else {
          x = this.getX();
          y = this.getY();
        }
        this._carrierGraphic = editor.getPaper().circle(x, y, PedigreeEditorParameters.attributes.carrierDotRadius).attr(PedigreeEditorParameters.attributes.carrierShape);
      } else if (status == 'presymptomatic') {
        if (this.getNode().getLifeStatus() == 'aborted' || this.getNode().getLifeStatus() == 'miscarriage') {
          this._carrierGraphic = null;
          return;
        }
        editor.getPaper().setStart();
        var startX = (this.getX()-PedigreeEditorParameters.attributes.presymptomaticShapeWidth/2);
        var startY = this.getY()-this._radius;
        editor.getPaper().rect(startX, startY, PedigreeEditorParameters.attributes.presymptomaticShapeWidth, this._radius*2).attr(PedigreeEditorParameters.attributes.presymptomaticShape);
        if (this.getNode().getGender() == 'U') {
          editor.getPaper().path('M '+startX + ' ' + startY +
                                           'L ' + (this.getX()) + ' ' + (this.getY()-this._radius*1.1) +
                                           'L ' + (startX + PedigreeEditorParameters.attributes.presymptomaticShapeWidth) + ' ' + (startY) + 'Z').attr(PedigreeEditorParameters.attributes.presymptomaticShape);
          var endY = this.getY()+this._radius;
          editor.getPaper().path('M '+startX + ' ' + endY +
                                           'L ' + (this.getX()) + ' ' + (this.getY()+this._radius*1.1) +
                                           'L ' + (startX + PedigreeEditorParameters.attributes.presymptomaticShapeWidth) + ' ' + endY + 'Z').attr(PedigreeEditorParameters.attributes.presymptomaticShape);
        }
        this._carrierGraphic = editor.getPaper().setFinish();
      }
      if (editor.isReadOnlyMode()) {
        this._carrierGraphic.toFront();
      } else {
        this._carrierGraphic.insertBefore(this.getHoverBox().getFrontElements());
      }
    } else {
      this._carrierGraphic = null;
    }
  },

  /**
     * Returns this Person's disorder carrier graphics
     *
     * @method getCarrierGraphics
     * @return {Raphael.el}
     */
  getCarrierGraphics: function() {
    return this._carrierGraphic;
  },

  /**
     * Returns this Person's stillbirth label
     *
     * @method getSBLabel
     * @return {Raphael.el}
     */
  getSBLabel: function() {
    return this._stillBirthLabel;
  },

  /**
     * Updates the stillbirth label for this Person
     *
     * @method updateSBLabel
     */
  updateSBLabel: function() {
    this.getSBLabel() && this.getSBLabel().remove();
    if (this.getNode().getLifeStatus() == 'stillborn') {
      this._stillBirthLabel = editor.getPaper().text(this.getX(), this.getY(), 'SB').attr(PedigreeEditorParameters.attributes.label);
    } else {
      this._stillBirthLabel = null;
    }
    this.drawLabels();
  },

  /**
     * Returns this Person's comments label
     *
     * @method getCommentsLabel
     * @return {Raphael.el}
     */
  getCommentsLabel: function() {
    return this._commentsLabel;
  },

  /**
     * Updates the stillbirth label for this Person
     *
     * @method updateCommentsLabel
     */
  updateCommentsLabel: function() {
    this.getCommentsLabel() && this.getCommentsLabel().remove();
    this._commentsLabel = null;

    if (PedigreeEditorParameters.attributes.showCommentsInLabel === false) {
      this.drawLabels();
      return;
    }

    var comments = this.getNode().getComments ? this.getNode().getComments() : '';
    if (comments && comments.trim() !== '') {
      var prefix = PedigreeEditorParameters.attributes.showLabelPrefixes ? '\uD83D\uDDCE\uFE0E\u00A0' : '';
      var text = prefix + comments.trim();
      text = this._wrapText(text, 20);
      this._commentsLabel = editor.getPaper().text(this.getX(), this.getY(), text)
        .attr(PedigreeEditorParameters.attributes.commentLabel);
      this._commentsLabel.alignTop = true;
    }
    this.drawLabels();
  },

  /**
     * Displays the correct graphics to represent the current life status for this Person.
     *
     * @method updateLifeStatusShapes
     */
  updateLifeStatusShapes: function(oldStatus) {
    var status = this.getNode().getLifeStatus();

    this.getDeadShape()   && this.getDeadShape().remove();
    this.getUnbornShape() && this.getUnbornShape().remove();
    this.getSBLabel()     && this.getSBLabel().remove();

    // save some redraws if possible
    var oldShapeType = (oldStatus == 'aborted' || oldStatus == 'miscarriage');
    var newShapeType = (status    == 'aborted' || status    == 'miscarriage');
    if (oldShapeType != newShapeType) {
      this.setGenderGraphics();
    }

    if(status == 'deceased' || status == 'aborted') {  // but not "miscarriage"
      this.drawDeadShape();
    } else if (status == 'stillborn') {
      this.drawDeadShape();
      this.updateSBLabel();
    } else if (status == 'unborn') {
      this.drawUnbornShape();
    }
    this.updateAgeLabel();
  },

  /**
     * Marks this node as hovered, and moves the labels out of the way
     *
     * @method setSelected
     */
  setSelected: function($super, isSelected) {
    $super(isSelected);
    if(isSelected) {
      this.shiftLabels();
    } else {
      this.unshiftLabels();
    }
  },

  /**
     * Moves the labels down to make space for the hoverbox
     *
     * @method shiftLabels
     */
  shiftLabels: function() {
    var shift  = this._labelSelectionOffset();
    var labels = this.getLabels();
    for(var i = 0; i<labels.length; i++) {
      labels[i].stop().animate({'y': labels[i].oy + shift}, 200,'>');
    }
    if (this._labelsBox) {
      this._labelsBox.stop().animate({'y': this._labelsBox.oy + shift}, 200,'>');
    }
  },

  /**
     * Animates the labels of this node to their original position under the node
     *
     * @method unshiftLabels
     */
  unshiftLabels: function() {
    var labels = this.getLabels();
    var firstLable = this._childlessStatusLabel ? 1 : 0;
    for(var i = 0; i<labels.length; i++) {
      labels[i].stop().animate({'y': labels[i].oy}, 200,'>');
    }
    if (this._labelsBox) {
      this._labelsBox.stop().animate({'y': this._labelsBox.oy}, 200,'>');
    }
  },

  /**
     * Returns set of labels for this Person
     *
     * @method getLabels
     * @return {Raphael.st}
     */

  getDisordersLabel: function() {
    return this._disordersLabel;
  },

  updateDisordersLabel: function() {
    this._disordersLabel && this._disordersLabel.remove();
    this._disordersLabel = null;

    if (!PedigreeEditorParameters.attributes.showDisordersInLabel) {
      this.drawLabels();
      return;
    }

    var person = this.getNode();
    var disorders = person.getDisorders ? person.getDisorders() : [];
    if (disorders.length === 0) {
      this.drawLabels();
      return;
    }

    var names = [];
    var nameIds = [];
    for (var i = 0; i < disorders.length; i++) {
      var dId = disorders[i];
      var disorder = editor.getDisorderLegend ? editor.getDisorderLegend().getDisorder(dId) : null;
      var name = (disorder && disorder.getName && disorder.getName() !== 'loading...') ? disorder.getName() : Disorder.desanitizeID(dId);
      if (name === 'affected') {
        name = 'Affected';
      }
      if (name && names.indexOf(name) === -1) {
        names.push(name);
        nameIds.push(dId);
      }
    }

    if (names.length === 0) {
      this.drawLabels();
      return;
    }

    var prefix = PedigreeEditorParameters.attributes.showLabelPrefixes ? '\u2B22\u00A0' : '';
    var formattedLines = [];
    for (var j = 0; j < names.length; j++) {
      // standard notation: age at diagnosis after the condition, e.g. "Breast cancer dx 51y"
      var detail = person.getDisorderDetail ? person.getDisorderDetail(nameIds[j]) : null;
      var line = prefix + names[j] + (detail && detail.atdiag ? ' dx ' + compactAge(detail.atdiag) : '');
      formattedLines.push(this._wrapText(line, 20));
    }
    var text = formattedLines.join('\n');

    this._disordersLabel = editor.getPaper().text(this.getX(), this.getY(), text)
      .attr(PedigreeEditorParameters.attributes.disorderLabel || PedigreeEditorParameters.attributes.label);
    this._disordersLabel.alignTop = true;
    this.drawLabels();
  },

  getHPOLabel: function() {
    return this._hpoLabel;
  },

  updateHPOLabel: function() {
    this._hpoLabel && this._hpoLabel.remove();
    this._hpoLabel = null;

    if (!PedigreeEditorParameters.attributes.showHPOInLabel) {
      this.drawLabels();
      return;
    }

    var person = this.getNode();
    var hpos = person.getHPO ? person.getHPO() : [];
    if (hpos.length === 0) {
      this.drawLabels();
      return;
    }

    var names = [];
    for (var i = 0; i < hpos.length; i++) {
      var hId = hpos[i];
      var term = editor.getHPOLegend ? editor.getHPOLegend().getTerm(hId) : null;
      var name = (term && term.getName && term.getName() !== 'loading...') ? term.getName() : HPOTerm.desanitizeID(hId);
      if (name && names.indexOf(name) === -1) {
        names.push(name);
      }
    }

    if (names.length === 0) {
      this.drawLabels();
      return;
    }

    var prefix = PedigreeEditorParameters.attributes.showLabelPrefixes ? '\u25C8\u00A0' : '';
    var text = prefix + names.join(', ');
    text = this._wrapText(text, 20);

    this._hpoLabel = editor.getPaper().text(this.getX(), this.getY(), text)
      .attr(PedigreeEditorParameters.attributes.hpoLabel || PedigreeEditorParameters.attributes.label);
    this._hpoLabel.alignTop = true;
    this.drawLabels();
  },

  getGenesLabel: function() {
    return this._genesLabel;
  },

  updateGenesLabel: function() {
    this._genesLabel && this._genesLabel.remove();
    this._genesLabel = null;

    if (!PedigreeEditorParameters.attributes.showGenesInLabel) {
      this.drawLabels();
      return;
    }

    var person = this.getNode();
    var genes = person.getGenes ? person.getGenes() : [];
    if (genes.length === 0) {
      this.drawLabels();
      return;
    }

    var prefix = PedigreeEditorParameters.attributes.showLabelPrefixes ? '\u29D3\u00A0' : '';
    var text = prefix + genes.join(', ');
    text = this._wrapText(text, 20);

    this._genesLabel = editor.getPaper().text(this.getX(), this.getY(), text)
      .attr(PedigreeEditorParameters.attributes.geneLabel || PedigreeEditorParameters.attributes.label);
    this._genesLabel.alignTop = true;
    this.drawLabels();
  },

  getAncestryLabel: function() {
    return this._ancestryLabel;
  },

  /**
   * Ancestry under the person, e.g. "Ancestry: Ashkenazi Jewish" (Labels option, off by default)
   *
   * @method updateAncestryLabel
   */
  updateAncestryLabel: function() {
    this._ancestryLabel && this._ancestryLabel.remove();
    this._ancestryLabel = null;
    var person = this.getNode();
    var list = (PedigreeEditorParameters.attributes.showAncestryInLabel && person.getAncestry) ? person.getAncestry() : [];
    if (list.length === 0) {
      this.drawLabels();
      return;
    }
    var text = this._wrapText(translate('Ancestry:') + ' ' + list.map(function(a) { return translate(a); }).join(', '), 24);
    this._ancestryLabel = editor.getPaper().text(this.getX(), this.getY(), text)
      .attr(PedigreeEditorParameters.attributes.commentLabel || PedigreeEditorParameters.attributes.label);
    this._ancestryLabel.alignTop = true;
    this.drawLabels();
  },

  getTestsLabel: function() {
    return this._testsLabel;
  },

  /**
   * One line per genetic test result, e.g. "BRCA1 c.68_69del P", "MSH2 −".
   *
   * @method updateTestsLabel
   */
  updateTestsLabel: function() {
    this._testsLabel && this._testsLabel.remove();
    this._testsLabel = null;

    var person = this.getNode();
    var tests = (PedigreeEditorParameters.attributes.showTestsInLabel !== false && person.getGeneticTests) ? person.getGeneticTests() : [];
    if (tests.length === 0) {
      this.drawLabels();
      return;
    }
    var prefix = PedigreeEditorParameters.attributes.showLabelPrefixes ? '⧓ ' : '';
    var text = tests.map(function(t) { return prefix + clinicalTestLabel(t); })
      .map(function(line) { return this._wrapText(line, 24); }, this)
      .join('\n');
    this._testsLabel = editor.getPaper().text(this.getX(), this.getY(), text)
      .attr(PedigreeEditorParameters.attributes.testLabel || PedigreeEditorParameters.attributes.label);
    this._testsLabel.alignTop = true;
    this.drawLabels();
  },

  getLabels: function() {
    var labels = editor.getPaper().set();
    this.getSBLabel() && labels.push(this.getSBLabel());
    this.getNameLabel() && labels.push(this.getNameLabel());
    this.getAgeLabel() && labels.push(this.getAgeLabel());
    this.getExternalIDLabel() && labels.push(this.getExternalIDLabel());
    this.getDisordersLabel() && labels.push(this.getDisordersLabel());
    this.getHPOLabel() && labels.push(this.getHPOLabel());
    this.getGenesLabel() && labels.push(this.getGenesLabel());
    this.getTestsLabel() && labels.push(this.getTestsLabel());
    this.getAncestryLabel() && labels.push(this.getAncestryLabel());
    this.getCommentsLabel() && labels.push(this.getCommentsLabel());
    return labels;
  },

  /**
     * Displays all the appropriate labels for this Person in the correct layering order
     *
     * @method drawLabels
     */
  drawLabels: function() {
    if (this.getNode().isVirtual && this.getNode().isVirtual()) {
      return;
    }
    var labels = this.getLabels();
    var selectionOffset = this._labelSelectionOffset();
    var childlessOffset = this.getChildlessStatusLabel() ? PedigreeEditorParameters.attributes.label['font-size'] : 0;
    childlessOffset += ((this.getNode().getChildlessStatus() !== null) ? (PedigreeEditorParameters.attributes.infertileMarkerHeight + 2) : 0);

    var lowerBound = PedigreeEditorParameters.attributes.radius * (this.getNode().isPersonGroup() ? PedigreeEditorParameters.attributes.groupNodesScale : 1.0);

    var startY = this.getY() + lowerBound * 1.8 + selectionOffset + childlessOffset;
    
    var minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    var hasLabels = false;

    // Labels carry translate transforms from previous moves (setPos). Work in absolute
    // coordinates: stop pending animations, drop transforms and re-anchor on the node's X.
    var curX = this.getX();
    if (this._labelsBox) {
      this._labelsBox.stop();
      this._labelsBox.transform('');
    }
    for (var j = 0; j < labels.length; j++) {
      labels[j].stop();
      labels[j].transform('');
      labels[j].attr('x', curX);
    }

    for (var i = 0; i < labels.length; i++) {
      var offset = (labels[i].alignTop) ? (getElementHalfHeight(labels[i]) - 7) : 0;
      labels[i].attr('y', startY + offset);
      labels[i].oy = (labels[i].attr('y') - selectionOffset);
      startY = labels[i].getBBox().y2 + 11;
      
      var bbox = labels[i].getBBox();
      if (bbox.x < minX) minX = bbox.x;
      if (bbox.x2 > maxX) maxX = bbox.x2;
      if (bbox.y < minY) minY = bbox.y;
      if (bbox.y2 > maxY) maxY = bbox.y2;
      hasLabels = true;
    }
    if(!editor.isUnsupportedBrowser()) {
      labels.flatten().insertBefore(this.getHoverBox().getFrontElements().flatten());
    }

    if (hasLabels) {
      if (!this._labelsBox) {
        this._labelsBox = editor.getPaper().rect(0, 0, 10, 10).attr({
          fill: '#FFFFFF',
          'fill-opacity': 0.75,
          stroke: 'none'
        });
      }
      this._labelsBox.attr({
        x: minX - 4,
        y: minY - 2,
        width: Math.max(0, (maxX - minX) + 8),
        height: Math.max(0, (maxY - minY) + 4)
      });
      this._labelsBox.oy = (this._labelsBox.attr('y') - selectionOffset);
      this._labelsBox.insertBefore(labels[0]);
    } else {
      if (this._labelsBox) {
        this._labelsBox.remove();
        this._labelsBox = null;
      }
    }
  },

  _labelSelectionOffset: function() {
    var selectionOffset = this.isSelected() ? PedigreeEditorParameters.attributes.radius/1.4 : 0;

    if (this.isSelected() && this.getNode().isPersonGroup()) {
      selectionOffset += PedigreeEditorParameters.attributes.radius * (1-PedigreeEditorParameters.attributes.groupNodesScale) + 5;
    }

    if (this.getChildlessStatusLabel()) {
      selectionOffset = selectionOffset/2;
    }
    return selectionOffset;
  },

  /**
     * Returns set with the gender icon, disorder shapes and life status shapes.
     *
     * @method getShapes
     * @return {Raphael.st}
     */
  getShapes: function($super) {
    var lifeStatusShapes = editor.getPaper().set();
    this.getUnbornShape() && lifeStatusShapes.push(this.getUnbornShape());
    this.getChildlessShape() && lifeStatusShapes.push(this.getChildlessShape());
    this.getChildlessStatusLabel() && lifeStatusShapes.push(this.getChildlessStatusLabel());
    this.getDeadShape() && lifeStatusShapes.push(this.getDeadShape());
    return $super().concat(editor.getPaper().set(this.getDisorderShapes(), lifeStatusShapes));
  },

  /**
     * Returns all the graphics and labels associated with this Person.
     *
     * @method getAllGraphics
     * @return {Raphael.st}
     */
  getAllGraphics: function($super) {
    //console.log("Node " + this.getNode().getID() + " getAllGraphics");
    var g = $super().push(this.getHoverBox().getBackElements(), this.getLabels(), this.getCarrierGraphics(), this.getEvaluationGraphics(), this.getHoverBox().getFrontElements());
    if (this._labelsBox) g.push(this._labelsBox);
    return g;
  },

  hideAll: function() {
    this.getAllGraphics().hide();
    if (this.getHoverBox()) {
      this.getHoverBox().disable();
      this.getHoverBox().getFrontElements().hide();
      this.getHoverBox().getBackElements().hide();
    }
  },

  /**
     * Changes the position of the node to (x,y)
     *
     * @method setPos
     * @param [$super]
     * @param {Number} x the x coordinate on the canvas
     * @param {Number} y the y coordinate on the canvas
     * @param {Boolean} animate set to true if you want to animate the transition
     * @param {Function} callback a function that will be called at the end of the animation
     */
  setPos: function($super, x, y, animate, callback) {
    var funct = callback;
    if(animate) {
      var me = this;
      this.getHoverBox().disable();
      funct = function () {
        me.getHoverBox().enable();
        callback && callback();
      };
    }
    $super(x, y, animate, funct);
  }
});

//ATTACHES CHILDLESS BEHAVIOR METHODS
PersonVisuals.addMethods(ChildlessBehaviorVisuals);

PersonVisuals.getIndividualFullName = getIndividualFullName;
PersonVisuals.formatIndividualName = formatIndividualName;
if (typeof window !== 'undefined') {
  window.getIndividualFullName = getIndividualFullName;
  window.formatIndividualName = formatIndividualName;
}

export { getIndividualFullName, formatIndividualName };
export default PersonVisuals;
