import { ChildlessBehavior } from 'pedigree/view/abstractNode';
import AbstractNode from 'pedigree/view/abstractNode';
import PartnershipVisuals from 'pedigree/view/partnershipVisuals';
import { inbreedingOfChildren, formatCoefficient, coupleIsConsanguineous } from 'pedigree/model/kinship';
import { getLanguage, translate } from 'pedigree/i18n';

/**
 * Partnership is a class that represents the relationship between two AbstractNodes
 * and their children.
 *
 * @class Partnership
 * @constructor
 * @extends AbstractNode
 * @param x the x coordinate at which the partnership junction will be placed
 * @param y the y coordinate at which the partnership junction will be placed
 * @param partner1 an AbstractPerson who's one of the partners in the relationship.
 * @param partner2 an AbstractPerson who's the other partner in the relationship. The order of partners is irrelevant.
 * @id the unique ID number of this node
 */

var Partnership = Class.create(AbstractNode, {

  initialize: function($super, x, y, id, properties) {
    this._childlessStatus = null;
    this._childlessReason = '';
    this._relationDegree  = '';  // stated degree of relationship of the couple, e.g. "third cousins"
    this._type            = 'Partnership';

    this._broken       = false;
    this._consangrMode = 'A';    //  Can be either "A" (autodetect), "Y" (always consider consangr.) or "N" (never)
    // "Autodetect": derived from the current pedigree

    // Hidden link that keeps a gamete donor or surrogate beside one of the parents: no relationship
    // line is drawn (Bennett et al. 2008, 2022); the donor's line of descent goes to the child
    this._artLink = !!properties['artLink'];

    // assign some properties before drawing so that relationship lines are drawn properly
    this.setBrokenStatus (properties['broken']);
    this.setConsanguinity(properties['consangr']);

    $super(x, y, id);

    this.assignProperties(properties);
  },

  /**
     * Generates and returns an instance of PartnershipVisuals
     *
     * @method _generateGraphics
     * @param {Number} x X coordinate of this partnership
     * @param {Number} y Y coordinate of this partnership
     * @return {PartnershipVisuals}
     * @private
     */
  _generateGraphics: function(x, y) {
    return new PartnershipVisuals(this, x, y);
  },

  /**
     * Changes the status of this partnership. Nullifies the status if the given status is not
     * "childless" or "infertile".
     *
     * @method setChildlessStatus
     * @param {String} status Can be "childless", "infertile" or null
     */
  setChildlessStatus: function(status) {
    if(!this.isValidChildlessStatus(status)) {
      status = null;
    }

    if(status != this.getChildlessStatus()) {
      this._childlessStatus = status;
      this.getGraphics().updateChildlessShapes();
      this.getGraphics().updateChildlessStatusLabel();
      this.getGraphics().updateChildhubConnection();
      this.getGraphics().getHoverBox().regenerateHandles();
    }

    return this.getChildlessStatus();
  },

  /**
     * Sets the consanguinity setting of this relationship. Valid inputs are "A" (automatic"), "Y" (yes) and "N" (no)
     *
     * @method setConsanguinity
     */
  setConsanguinity: function(value) {
    if (value != 'A' && value != 'N' && value != 'Y') {
      value = 'A';
    }
    if (this._consangrMode != value) {
      this._consangrMode = value;
    }
    this.getGraphics() && this.getGraphics().getHoverBox().regenerateButtons();
  },

  /**
     * Returns the consanguinity setting of this relationship: "A" (automatic"), "Y" (yes) or "N" (no)
     *
     * @method getConsanguinity
     */
  getConsanguinity: function() {
    return this._consangrMode;
  },

  isArtLink: function() {
    return this._artLink;
  },

  /**
     * Degree of relationship of a consanguineous couple, stated when it is not obvious from the
     * pedigree (e.g. "third cousins") and written above the relationship line (Bennett et al. 2008)
     *
     * @method getRelationDegree
     * @return {String}
     */
  getRelationDegree: function() {
    return this._relationDegree;
  },

  setRelationDegree: function(text) {
    text = String(text || '').replace(/\s+/g, ' ').trim();
    if (text != this._relationDegree) {
      this._relationDegree = text;
      editor.getOverlay && editor.getOverlay() && editor.getOverlay().scheduleRedraw();
    }
  },

  /**
     * Sets relationship as either broken or not
     *
     * @method getBrokenStatus
     */
  setBrokenStatus: function(value) {
    if (value === undefined) {
      value = false;
    }
    if (this._broken != value) {
      this._broken = value;
    }
  },

  /**
     * Returns the status of this relationship (broken or not)
     *
     * @method getBrokenStatus
     */
  getBrokenStatus: function() {
    return this._broken;
  },

  /**
     * Returns an object (to be accepted by the menu) with information about this Partnership
     *
     * @method getSummary
     * @return {Object}
     */
  getSummary: function() {
    var childlessInactive = editor.getGraph().hasNonPlaceholderNonAdoptedChildren(this.getID());
    return {
      identifier:    {value : this.getID()},
      childlessSelect : {value : this.getChildlessStatus() ? this.getChildlessStatus() : 'none', inactive: childlessInactive},
      childless_reason: {value : this.getChildlessReason(), inactive: !this.getChildlessStatus()},
      consangr: {value: this._consangrMode, inactive: false},
      relation_degree: {value: this.getRelationDegree(), inactive: false},
      inbreeding: this._inbreedingSummary(),
      broken: {value: this.getBrokenStatus(), inactive: false}
    };
  },

  /**
   * Wright's F of the couple's children, for the menu; hidden for unrelated couples
   */
  _inbreedingSummary: function() {
    var graph = editor.getGraph();
    var partners = [];
    try { partners = graph.DG.GG.getParents(this.getID()); } catch (e) {}
    if (partners.length !== 2) return { value: null, inactive: true };
    if (!coupleIsConsanguineous(graph, this.getID())) return { value: null, inactive: true };
    var f = inbreedingOfChildren(graph, partners[0], partners[1]);
    if (!(f > 0)) {
      // marked consanguineous, but the common ancestors are not drawn
      return this.getConsanguinity() === 'Y'
        ? { value: { text: translate('Not calculated: the common ancestors are not in the pedigree.') }, inactive: false }
        : { value: null, inactive: true };
    }
    var lang = getLanguage();
    return {
      value: {
        text: 'F = ' + formatCoefficient(f, lang),
        hint: translate('Coefficient of relationship of the couple:') + ' r = ' + formatCoefficient(2 * f, lang)
      },
      inactive: false
    };
  },

  /**
     * Returns an object containing all the properties of this node
     * except id, x, y & type
     *
     * @method getProperties
     * @return {Object} in the form
     *
     */
  getProperties: function($super) {
    var info = $super();
    if (this.getChildlessStatus() != null) {
      info['childlessStatus'] = this.getChildlessStatus();
    }
    if (this.getChildlessStatus() != null && this.getChildlessReason()) {
      info['childlessReason'] = this.getChildlessReason();
    }
    if (this.getConsanguinity() != 'A') {
      info['consangr'] = this.getConsanguinity();
    }
    if (this.getRelationDegree()) {
      info['relationDegree'] = this.getRelationDegree();
    }
    if (this._artLink) {
      info['artLink'] = true;
    }
    if (this.getBrokenStatus()) {
      info['broken'] = this.getBrokenStatus();
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
  assignProperties: function($super, info) {
    if($super(info)) {
      if(info.childlessStatus && info.childlessStatus != this.getChildlessStatus()) {
        this.setChildlessStatus(info.childlessStatus);
      } else if (!info.childlessStatus && this.getChildlessStatus()) {
        this.setChildlessStatus(null);
      }
      this.setChildlessReason(info.childlessReason);
      this.setRelationDegree(info.relationDegree);
      if (info.consangr && info.consangr != this.getConsanguinity()) {
        this.setConsanguinity(info.consangr);
      }
      if (info.broken && info.broken != this.getBrokenStatus()) {
        this.setBrokenStatus(info.broken);
      }
      return true;
    }
    return false;
  }
});

//ATTACH CHILDLESS BEHAVIOR METHODS TO PARTNERSHIP OBJECTS
Partnership.addMethods(ChildlessBehavior);

export default Partnership;
