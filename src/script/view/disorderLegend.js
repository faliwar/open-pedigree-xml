import Raphael from 'pedigree/raphael';
import { isInt } from 'pedigree/model/helpers';
import Disorder from 'pedigree/disorder';
import Legend from 'pedigree/view/legend';
import { INVITAE_PALETTE, AUTO_ORDER, normalizeHex } from 'pedigree/model/conditionColors';
import { translate } from 'pedigree/i18n';

/**
 * Class responsible for keeping track of disorders and their properties, and for
 * caching disorders data as loaded from the OMIM database.
 * This information is graphically displayed in a 'Legend' box.
 *
 * @class DisorderLegend
 * @constructor
 */
var DisorgerLegend = Class.create( Legend, {

  initialize: function($super) {
    $super('Disorders');

    this._disorderCache = {};

    this._specialDisordersRegexps = [new RegExp('^1BrCa', 'i'),
      new RegExp('^2BrCa', 'i'),
      new RegExp('^OvCa',  'i'),
      new RegExp('^ProCa', 'i'),
      new RegExp('^PanCa', 'i') ];

    this._autoColors = {}; // automatic colour of each condition, used again when a chosen colour is removed

    var _this = this;
    document.observe('pedigree:info:changed', function() {
      _this._applyChosenColors();
    });
    document.observe('pedigree:condition:rename', function(event) {
      _this._onRename(event);
    });
    document.observe('mousedown', function(event) {
      if (_this._picker && !event.findElement('.condition-color-picker') && !event.findElement('.disorder-color') && !event.findElement('.disorder-name')) {
        _this._closePicker();
      }
    });
  },

  /** Colour chosen by the user for this condition (saved with the pedigree), or '' */
  _getChosenColor: function(disorderID) {
    try {
      var info = editor.getPedigreeInfo && editor.getPedigreeInfo();
      return info ? info.getConditionColor(disorderID) : '';
    } catch (e) {
      return '';
    }
  },

  /**
   * Shows each condition in the colour chosen for it (or its automatic colour) in the legend,
   * the person menus and the pedigree.
   */
  _applyChosenColors: function() {
    for (var id in this._affectedNodes) {
      if (!this._affectedNodes.hasOwnProperty(id)) continue;
      var color = this._getChosenColor(id);
      if (!color) {
        if (!this._autoColors[id]) {
          delete this._objectColors[id];
          this._autoColors[id] = this._generateColor(id);
        }
        color = this._autoColors[id];
      }
      this._setColor(id, color);
    }
    if (this._picker) {
      this._refreshPicker();
    }
  },

  _setColor: function(disorderID, color) {
    if (this._objectColors[disorderID] === color) return;
    this._objectColors[disorderID] = color;
    var li = this._getListElementForObjectWithID(disorderID);
    var bubble = li && li.down('.disorder-color');
    if (bubble) bubble.style.backgroundColor = color;
    document.fire('disorder:color', {'id' : disorderID, color: color});
    (this._affectedNodes[disorderID] || []).forEach(function(nodeID) {
      var node = editor.getNode(nodeID);
      node && node.getGraphics() && node.getGraphics().updateDisorderShapes && node.getGraphics().updateDisorderShapes();
    });
  },

  // -------------------------------------------------------------------------------------------
  // Colour picker: opens from the colour square of a condition in the legend

  _openPicker: function(disorderID, anchor) {
    this._closePicker();
    var _this = this;
    var picker = new Element('div', {'class': 'condition-color-picker'});

    // name (free-text conditions and coded ones alike; 'affected' is the generic shading and keeps its name)
    if (disorderID !== 'affected') {
      picker.insert(new Element('div', {'class': 'condition-color-title'}).update(translate('Name')));
      var nameRow = new Element('div', {'class': 'condition-name-row'});
      var nameInput = new Element('input', {'type': 'text', 'class': 'condition-name-input', 'value': this.getDisorder(disorderID).getName()});
      var renameBtn = new Element('button', {'type': 'button', 'class': 'condition-rename'}).update(translate('Rename'));
      var doRename = function() {
        _this.renameCondition(disorderID, nameInput.value);
      };
      renameBtn.observe('click', doRename);
      nameInput.observe('keydown', function(event) {
        if (event.keyCode === 13) {
          event.stop();
          doRename();
        } else if (event.keyCode === 27) {
          event.stop();
          _this._closePicker();
        }
      });
      nameRow.insert(nameInput).insert(renameBtn);
      picker.insert(nameRow);
    }

    picker.insert(new Element('div', {'class': 'condition-color-title'}).update(translate('Condition color')));

    var swatches = new Element('div', {'class': 'condition-color-swatches'});
    INVITAE_PALETTE.forEach(function(hex) {
      var sw = new Element('button', {'type': 'button', 'class': 'condition-color-swatch', 'title': hex, 'data-color': hex});
      sw.style.backgroundColor = hex;
      sw.observe('click', function() { _this._chooseColor(disorderID, hex); });
      swatches.insert(sw);
    });
    picker.insert(swatches);

    var row = new Element('div', {'class': 'condition-color-row'});
    var custom = new Element('input', {'type': 'color', 'class': 'condition-color-custom'});
    custom.observe('change', function() { _this._chooseColor(disorderID, custom.value); });
    var customLabel = new Element('label', {'class': 'condition-color-custom-label'}).insert(custom)
      .insert(new Element('span').update(translate('Other color')));
    row.insert(customLabel);
    var reset = new Element('button', {'type': 'button', 'class': 'condition-color-reset'}).update(translate('Automatic color'));
    reset.observe('click', function() { _this._chooseColor(disorderID, ''); });
    row.insert(reset);
    picker.insert(row);

    document.body.insert(picker);
    var r = anchor.getBoundingClientRect();
    var left = Math.max(8, Math.min(r.left, window.innerWidth - picker.offsetWidth - 8));
    var top = r.bottom + 6;
    if (top + picker.offsetHeight > window.innerHeight - 8) top = Math.max(8, r.top - picker.offsetHeight - 6);
    picker.style.left = left + 'px';
    picker.style.top = top + 'px';

    this._picker = picker;
    this._pickerID = disorderID;
    this._refreshPicker();
    var input = picker.down('.condition-name-input');
    if (input) {
      input.focus();
      input.select();
    }
  },

  // -------------------------------------------------------------------------------------------
  // Renaming: every person with the condition gets the new name, keeping its colour and
  // diagnosis details. One undo step.

  /**
   * @param {String} disorderID current id
   * @param {String} newName the name to show from now on
   */
  renameCondition: function(disorderID, newName) {
    newName = String(newName || '').replace(/\s+/g, ' ').trim();
    if (!newName || !this._hasAffectedNodes(disorderID)) return;
    var toID = Disorder.sanitizeID(newName);
    if (toID === disorderID) {
      this._closePicker();
      return;
    }
    var oldName = this.getDisorder(disorderID).getName();
    this._closePicker();
    document.fire('pedigree:condition:rename', {
      fromID: disorderID,
      toID: toID,
      nodes: this._affectedNodes[disorderID].slice(0),
      _opxDesc: translate('Renamed the condition') + ' ' + oldName + ' → ' + newName
    });
  },

  _onRename: function(event) {
    var memo = event.memo || {};
    var fromID = memo.fromID, toID = memo.toID;
    if (!fromID || !toID || fromID === toID || !this._hasAffectedNodes(fromID)) return;

    // keep the colour: a chosen colour moves to the new name; an automatic one is reused
    var info = editor.getPedigreeInfo && editor.getPedigreeInfo();
    if (info && info.renameConditionColor) {
      info.renameConditionColor(fromID, toID);
    }
    if (!this._objectColors.hasOwnProperty(toID)) {
      this._objectColors[toID] = this.getObjectColor(fromID);
      this._autoColors[toID] = this._autoColors[fromID] || this._objectColors[toID];
    }

    // diagnosis details are keyed by condition name (or id)
    var fromKeys = [Disorder.desanitizeID(fromID), fromID, this.getDisorder(fromID).getName()];
    var toKey = Disorder.desanitizeID(toID);

    (memo.nodes || []).forEach(function(nodeID) {
      var node = editor.getNode(nodeID);
      if (!node || !node.getDisorders) return;
      var list = [];
      node.getDisorders().forEach(function(d) {
        var id = (d === fromID) ? toID : d;
        if (list.indexOf(id) === -1) list.push(id);
      });
      var details = node.getDisorderDetails ? node.getDisorderDetails() : {};
      fromKeys.forEach(function(k) {
        if (k && details.hasOwnProperty(k)) {
          if (!details.hasOwnProperty(toKey)) details[toKey] = details[k];
          delete details[k];
        }
      });
      node.setDisorders(list);
      node.setDisorderDetails && node.setDisorderDetails(details);
      editor.getGraph().setProperties(nodeID, node.getProperties());
    });

    if (!memo.noUndoRedo && editor.getActionStack) {
      // undo restores the saved state as a whole (also right when two conditions were merged)
      editor.getActionStack().addState({ eventName: 'pedigree:condition:rename', memo: memo }, null);
    }
  },

  _refreshPicker: function() {
    if (!this._picker) return;
    if (!this._hasAffectedNodes(this._pickerID)) {
      this._closePicker();
      return;
    }
    var current = normalizeHex(this.getObjectColor(this._pickerID));
    var chosen = this._getChosenColor(this._pickerID);
    this._picker.select('.condition-color-swatch').each(function(sw) {
      if (sw.readAttribute('data-color') === current) {
        sw.addClassName('selected');
      } else {
        sw.removeClassName('selected');
      }
    });
    var custom = this._picker.down('.condition-color-custom');
    if (custom && current) custom.value = current.toLowerCase();
    var reset = this._picker.down('.condition-color-reset');
    if (reset) reset.disabled = !chosen;
  },

  _closePicker: function() {
    if (this._picker) {
      this._picker.remove();
    }
    this._picker = null;
    this._pickerID = null;
  },

  _chooseColor: function(disorderID, color) {
    var info = editor.getPedigreeInfo && editor.getPedigreeInfo();
    if (!info) return;
    var name = this.getDisorder(disorderID).getName();
    info.setConditionColor(disorderID, color, translate('Changed the color of') + ' ' + name);
  },

  _getPrefix: function(id) {
    return 'disorder';
  },

  /**
     * Returns the disorder object with the given ID. If object is not in cache yet
     * returns a newly created one which may have the disorder name & other attributes not loaded yet
     *
     * @method getDisorder
     * @return {Object}
     */
  getDisorder: function(disorderID) {
    if (!isInt(disorderID)) {
      disorderID = Disorder.sanitizeID(disorderID);
    }
    if (!this._disorderCache.hasOwnProperty(disorderID)) {
      var whenNameIsLoaded = function() {
        this._updateDisorderName(disorderID);
      };
      this._disorderCache[disorderID] = new Disorder(disorderID, null, whenNameIsLoaded.bind(this));
    }
    return this._disorderCache[disorderID];
  },

  /**
     * Registers an occurrence of a disorder. If disorder hasn't been documented yet,
     * designates a color for it.
     *
     * @method addCase
     * @param {Number|String} disorderID ID for this disorder taken from the OMIM database
     * @param {String} disorderName The name of the disorder
     * @param {Number} nodeID ID of the Person who has this disorder
     */
  addCase: function($super, disorderID, disorderName, nodeID) {
    if (!this._disorderCache.hasOwnProperty(disorderID)) {
      this._disorderCache[disorderID] = new Disorder(disorderID, disorderName);
    }

    $super(disorderID, disorderName, nodeID);
  },

  /**
     * Updates the displayed disorder name for the given disorder
     *
     * @method _updateDisorderName
     * @param {Number} disorderID The identifier of the disorder to update
     * @private
     */
  _updateDisorderName: function(disorderID) {
    var name = this._legendBox.down('li#' + this._getPrefix() + '-' + disorderID + ' .disorder-name');
    if (name) {
      name.update(this.getDisorder(disorderID).getName());
    }
    if (window.editor && editor.getView && editor.getView().updateAllLabels) { editor.getView().updateAllLabels(); }
  },

  /**
     * Generate the element that will display information about the given disorder in the legend
     *
     * @method _generateElement
     * @param {Number} disorderID The id for the disorder, taken from the OMIM database
     * @param {String} name The human-readable disorder name
     * @return {HTMLLIElement} List element to be insert in the legend
     */
  _generateElement: function($super, disorderID, name) {
    var chosen = this._getChosenColor(disorderID);
    if (chosen) {
      this._objectColors[disorderID] = chosen;
      document.fire('disorder:color', {'id' : disorderID, color: chosen});
    } else if (!this._objectColors.hasOwnProperty(disorderID)) {
      var color = this._generateColor(disorderID);
      this._objectColors[disorderID] = color;
      this._autoColors[disorderID] = color;
      document.fire('disorder:color', {'id' : disorderID, color: color});
    }

    var item = $super(disorderID, name);
    var bubble = item.down('.disorder-color');
    if (bubble) {
      var _this = this;
      bubble.addClassName('editable-color');
      bubble.title = translate('Click to change the color');
      var toggle = function(event) {
        event.stop();
        if (_this._picker && _this._pickerID === disorderID) {
          _this._closePicker();
        } else {
          _this._openPicker(disorderID, bubble);
        }
      };
      bubble.observe('click', toggle);
      var nameEl = item.down('.disorder-name');
      if (nameEl) {
        nameEl.addClassName('editable-name');
        nameEl.title = translate('Click to rename or change the color');
        nameEl.observe('click', toggle);
      }
    }
    return item;
  },

  removeCase: function($super, disorderID, nodeID) {
    $super(disorderID, nodeID);
    if (!this._hasAffectedNodes(disorderID)) {
      delete this._autoColors[disorderID];
      if (this._pickerID === disorderID) this._closePicker();
    }
  },

  /**
     * Generates a CSS color.
     * Has preference for some predefined colors that can be distinguished in gray-scale
     * and are distint from gene colors.
     *
     * @method generateColor
     * @return {String} CSS color
     */
  _generateColor: function(disorderID) {
    if(this._objectColors.hasOwnProperty(disorderID)) {
      return this._objectColors[disorderID];
    }

    // check special disorder prefixes
    for (var i = 0; i < this._specialDisordersRegexps.length; i++) {
      if (disorderID.match(this._specialDisordersRegexps[i]) !== null) {
        for (var disorder in this._objectColors) {
          if (this._objectColors.hasOwnProperty(disorder)) {
            if (disorder.match(this._specialDisordersRegexps[i]) !== null) {
              return this._objectColors[disorder];
            }
          }
        }
        break;
      }
    }

    var usedColors = Object.values(this._objectColors),
      // Invitae palette: red first, then muted clinical colors
      prefColors = AUTO_ORDER.map(function(i) { return INVITAE_PALETTE[i]; });
    usedColors.each( function(color) {
      prefColors = prefColors.without(color);
    });
    if (disorderID == 'affected') {
      if (usedColors.indexOf(INVITAE_PALETTE[0]) > -1 ) {
        return '#990000';
      } else {
        return INVITAE_PALETTE[0];
      }
    }
    if(prefColors.length > 0) {
      return prefColors[0];
    } else {
      var randomColor = Raphael.getColor();
      while(randomColor == '#ffffff' || usedColors.indexOf(randomColor) != -1) {
        randomColor = '#'+((1<<24)*Math.random()|0).toString(16);
      }
      return randomColor;
    }
  }
});

export default DisorgerLegend;
