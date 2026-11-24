/**
 * Base class for various "legend" widgets
 *
 * @class Legend
 * @constructor
 */

var Legend = Class.create( {

  initialize: function(title) {
    this._affectedNodes  = {};     // for each object: the list of affected person nodes

    this._objectColors = {};       // for each object: the corresponding object color
    this._enabled = true;

    var legendContainer = $('legend-container');
    if (legendContainer == undefined) {
      var legendContainer = new Element('div', {'class': 'legend-container', 'id': 'legend-container'});
      editor.getWorkspace().getWorkArea().insert(legendContainer);
    }

    this._legendBox = new Element('div', {'class' : 'legend-box', id: 'legend-box'});
    this._legendBox.hide();
    legendContainer.insert(this._legendBox);

    var legendTitle= new Element('h2', {'class' : 'legend-title'}).update(title);
    this._legendBox.insert(legendTitle);

    this._list = new Element('ul', {'class' : 'disorder-list'});
    this._legendBox.insert(this._list);

    Element.observe(this._legendBox, 'mouseover', function() {
      $$('.menu-box').invoke('setOpacity', .1);
    });
    Element.observe(this._legendBox, 'mouseout', function() {
      $$('.menu-box').invoke('setOpacity', 1);
    });
  },

  /**
   * Turns colouring and legend display on or off (configured in Label Display Options).
   *
   * @method setEnabled
   */
  setEnabled: function(enabled) {
    this._enabled = !!enabled;
    this._applyVisibility();
  },

  isEnabled: function() {
    return this._enabled !== false;
  },

  /**
     * Returns the prefix to be used on elements related to the object
     * (of type tracked by this legend) with the given id.
     *
     * @method _getPrefix
     * @param {String|Number} id ID of the object
     * @return {String} some identifier which should be a valid HTML id value (e.g. no spaces)
     */
  _getPrefix: function(id) {
    // To be overwritten in derived classes
    throw 'prefix not defined';
  },

  /**
   * Returns true if the given view node currently carries the object with the given id.
   * Overridden by derived classes for view reconciliation.
   */
  _nodeHasObject: function(node, id) {
    return true;
  },

  /**
   * Hook invoked when an object has no remaining cases in the pedigree.
   */
  _onObjectRemoved: function(id) {
  },

  /**
   * True when nodeID is a real person/group currently drawn on the pedigree chart
   * (exists in the graph, is not virtual, and is not inside a collapsed branch).
   */
  _isNodeVisibleOnChart: function(nodeID) {
    try {
      if (typeof editor === 'undefined' || !editor || !editor.getGraph) {
        return true;
      }
      var graph = editor.getGraph();
      if (!graph) {
        return true;
      }
      if (graph.isValidID && !graph.isValidID(nodeID)) {
        return false;
      }
      if (graph.isPerson && !graph.isPerson(nodeID)) {
        return false;
      }
      if ((graph.isVirtualParent && graph.isVirtualParent(nodeID)) ||
          (graph.isVirtualDummyChild && graph.isVirtualDummyChild(nodeID)) ||
          (graph.isPlaceholder && graph.isPlaceholder(nodeID))) {
        return false;
      }
      if (graph.isHiddenBranch && graph.isHiddenBranch(nodeID)) {
        return false;
      }
      return true;
    } catch (e) {
      return true;
    }
  },

  _visibleNodes: function(id) {
    if (!this._hasAffectedNodes(id)) {
      return [];
    }
    var _this = this;
    return this._affectedNodes[id].filter(function(nodeID) {
      return _this._isNodeVisibleOnChart(nodeID);
    });
  },

  _hasVisibleCases: function() {
    for (var id in this._affectedNodes) {
      if (this._affectedNodes.hasOwnProperty(id) && this._visibleNodes(id).length > 0) {
        return true;
      }
    }
    return false;
  },

  _applyVisibility: function() {
    if (this.isEnabled() && this._hasVisibleCases()) {
      this._legendBox.show();
    } else {
      this._legendBox.hide();
    }
  },

  /**
     * Retrieve the color associated with the given object
     *
     * @method getObjectColor
     * @param {String|Number} id ID of the object
     * @return {String} CSS color value for the object, displayed on affected nodes in the pedigree and in the legend
     */
  getObjectColor: function(id) {
    if (!this._objectColors.hasOwnProperty(id)) {
      return '#ff0000';
    }
    return this._objectColors[id];
  },

  /**
     * Returns True if there are nodes reported to have the object with the given id
     *
     * @method _hasAffectedNodes
     * @param {String|Number} id ID of the object
     * @private
     */
  _hasAffectedNodes: function(id) {
    return this._affectedNodes.hasOwnProperty(id);
  },

  /**
     * Registers an occurrence of an object type being tracked by this legend.
     *
     * @method addCase
     * @param {String|Number} id ID of the object
     * @param {String} Name The description of the object to be displayed
     * @param {Number} nodeID ID of the Person who has this object associated with it
     */
  addCase: function(id, name, nodeID) {
    if(!this._hasAffectedNodes(id)) {
      this._affectedNodes[id] = [nodeID];
      var listElement = this._generateElement(id, name);
      this._list.insert(listElement);
    } else if (this._affectedNodes[id].indexOf(nodeID) === -1) {
      this._affectedNodes[id].push(nodeID);
    }
    this._updateCaseNumbersForObject(id);
    this._applyVisibility();
  },

  _dropObject: function(id) {
    delete this._affectedNodes[id];
    delete this._objectColors[id];
    var htmlElement = this._getListElementForObjectWithID(id);
    htmlElement && htmlElement.remove();
    this._onObjectRemoved(id);
  },

  /**
     * Removes an occurrence of an object, if there are any. Removes the object
     * from the 'Legend' box if this object is not registered in any individual any more.
     *
     * @param {String|Number} id ID of the object
     * @param {Number} nodeID ID of the Person who has/is affected by this object
     */
  removeCase: function(id, nodeID) {
    if (this._hasAffectedNodes(id)) {
      this._affectedNodes[id] = this._affectedNodes[id].without(nodeID);
      if(this._affectedNodes[id].length == 0) {
        this._dropObject(id);
      } else {
        this._updateCaseNumbersForObject(id);
      }
      this._applyVisibility();
    }
  },

  /**
   * Updates stored node IDs when vertices are removed and higher IDs shift down.
   */
  replaceIDs: function(changedIdsSet) {
    if (!changedIdsSet) return;
    for (var id in this._affectedNodes) {
      if (!this._affectedNodes.hasOwnProperty(id)) continue;
      var updated = [];
      var list = this._affectedNodes[id];
      for (var i = 0; i < list.length; i++) {
        var oldID = list[i];
        var numOldID = parseInt(oldID, 10);
        var newID = changedIdsSet.hasOwnProperty(oldID) ? changedIdsSet[oldID] :
          (changedIdsSet.hasOwnProperty(numOldID) ? changedIdsSet[numOldID] : numOldID);
        if (updated.indexOf(newID) === -1) {
          updated.push(newID);
        }
      }
      this._affectedNodes[id] = updated;
    }
  },

  /**
   * Reconciles tracked cases and visible counts against the current view and hidden branches.
   * Ensures deleted nodes never leave stale entries and hidden-branch nodes are not shown in the legend.
   */
  syncWithView: function() {
    var view = (typeof editor !== 'undefined' && editor && editor.getView) ? editor.getView() : null;
    var graph = (typeof editor !== 'undefined' && editor && editor.getGraph) ? editor.getGraph() : null;
    if (!view || !graph) return;
    var _this = this;
    Object.keys(this._affectedNodes).forEach(function(id) {
      var valid = (_this._affectedNodes[id] || []).filter(function(nodeID) {
        if (graph.isValidID && !graph.isValidID(nodeID)) return false;
        if (graph.isPerson && !graph.isPerson(nodeID)) return false;
        var node = view.getNode(nodeID);
        if (!node || (node.isVirtual && node.isVirtual())) return false;
        return _this._nodeHasObject(node, id);
      });
      if (valid.length === 0) {
        _this._dropObject(id);
      } else {
        _this._affectedNodes[id] = valid;
        _this._updateCaseNumbersForObject(id);
      }
    });
    this._applyVisibility();
  },

  _getListElementForObjectWithID: function(id) {
    var targetId = this._getPrefix() + '-' + id;
    var el = $(targetId);
    if (el) return el;
    var children = (this._list && this._list.childElements) ? this._list.childElements() : [];
    for (var i = 0; i < children.length; i++) {
      if (children[i].id === targetId) return children[i];
    }
    return null;
  },

  /**
     * Updates the displayed number of visible nodes associated with/affected by the object
     *
     * @method _updateCaseNumbersForObject
     * @param {String|Number} id ID of the object
     * @private
     */
  _updateCaseNumbersForObject : function(id) {
    var item = this._getListElementForObjectWithID(id);
    if (!item) return;
    var cases = this._visibleNodes(id).length;
    if (cases > 0) {
      item.show();
      var label = item.down('.disorder-cases');
      if (label) {
        label.update(cases + '&nbsp;case' + ((cases - 1) && 's' || ''));
      }
    } else {
      item.hide();
      if (this._pickerID === id && this._closePicker) {
        this._closePicker();
      }
    }
  },

  /**
     * Generate the element that will display information about the given object in the legend
     *
     * @method _generateElement
     * @param {String|Number} id ID of the object
     * @param {String} name The human-readable object name or description
     * @return {HTMLLIElement} List element to be insert in the legend
     */
  _generateElement: function(id, name) {
    var color = this.getObjectColor(id);
    var item = new Element('li', {'class' : 'disorder', 'id' : this._getPrefix() + '-' + id}).update(new Element('span', {'class' : 'disorder-name'}).update(name));
    var bubble = new Element('span', {'class' : 'disorder-color'});
    bubble.style.backgroundColor = color;
    item.insert({'top' : bubble});
    var countLabel = new Element('span', {'class' : 'disorder-cases'});
    var countLabelContainer = new Element('span', {'class' : 'disorder-cases-container'}).insert('(').insert(countLabel).insert(')');
    item.insert(' ').insert(countLabelContainer);
    var me = this;
    Element.observe(item, 'mouseover', function() {
      //item.setStyle({'text-decoration':'underline', 'cursor' : 'default'});
      item.down('.disorder-name').setStyle({'background': me.getObjectColor(id), 'cursor' : 'default'});
      me._affectedNodes[id] && me._affectedNodes[id].forEach(function(nodeID) {
        if (!me._isNodeVisibleOnChart(nodeID)) return;
        var node = editor.getNode(nodeID);
        node && node.getGraphics().highlight();
      });
    });
    Element.observe(item, 'mouseout', function() {
      //item.setStyle({'text-decoration':'none'});
      item.down('.disorder-name').setStyle({'background':'', 'cursor' : 'default'});
      me._affectedNodes[id] && me._affectedNodes[id].forEach(function(nodeID) {
        var node = editor.getNode(nodeID);
        node && (!node.isHiddenBranch || !node.isHiddenBranch()) && node.getGraphics().unHighlight();
      });
    });
    return item;
  }
});

export default Legend;
