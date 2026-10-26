import Raphael from 'pedigree/raphael';
import Legend from 'pedigree/view/legend';
import Person from 'pedigree/view/person';

/**
 * Class responsible for keeping track of candidate genes.
 * This information is graphically displayed in a 'Legend' box.
 *
 * @class GeneLegend
 * @constructor
 */
var GeneLegend = Class.create( Legend, {

  initialize: function($super) {
    // genes with a positive test result, plus candidate genes from older files
    $super('Genes');
    this._enabled = true;
  },

  _getPrefix: function(id) {
    return 'gene';
  },

  /**
   * Turns colouring by gene on or off ("Colour individuals by gene" in the Labels dialog).
   * When off, the legend is hidden and person symbols get no gene colours.
   *
   * @method setEnabled
   */
  setEnabled: function(enabled) {
    this._enabled = !!enabled;
    this._applyVisibility();
  },

  isEnabled: function() {
    return this._enabled;
  },

  _applyVisibility: function() {
    if (this._enabled && Object.keys(this._affectedNodes).length > 0) {
      this._legendBox.show();
    } else {
      this._legendBox.hide();
    }
  },

  addCase: function($super, id, name, nodeID) {
    $super(id, name, nodeID);
    this._applyVisibility();
  },

  removeCase: function($super, id, nodeID) {
    $super(id, nodeID);
    this._applyVisibility();
  },

  /**
     * Generate the element that will display information about the given disorder in the legend
     *
     * @method _generateElement
     * @param {String} geneID The id for the gene
     * @param {String} name The human-readable gene description
     * @return {HTMLLIElement} List element to be insert in the legend
     */
  _generateElement: function($super, geneID, name) {
    if (!this._objectColors.hasOwnProperty(geneID)) {
      var color = this._generateColor(geneID);
      this._objectColors[geneID] = color;
      document.fire('gene:color', {'id' : geneID, color: color});
    }

    return $super(geneID, name);
  },

  /**
     * Generates a CSS color.
     * Has preference for some predefined colors that can be distinguished in gray-scale
     * and are distint from disorder colors.
     *
     * @method generateColor
     * @return {String} CSS color
     */
  _generateColor: function(geneID) {
    if(this._objectColors.hasOwnProperty(geneID)) {
      return this._objectColors[geneID];
    }

    var usedColors = Object.values(this._objectColors),
      // green palette
      prefColors = ['#81a270', '#c4e8c4', '#56a270', '#b3b16f', '#4a775a', '#65caa3'];
    usedColors.each( function(color) {
      prefColors = prefColors.without(color);
    });
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

export default GeneLegend;
