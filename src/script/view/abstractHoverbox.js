import { Timer } from 'pedigree/model/helpers';
import { generateOrb } from 'pedigree/view/graphicHelpers';
import PedigreeEditorParameters from 'pedigree/pedigreeEditorParameters';

/**
 * AbstractHoverbox is an abstract class for all the UI elements and graphics surrounding a node on the canvas (a Person
 * or a partnership). This includes the box that appears around the node when it's hovered by a mouse, as
 * well as the handles used for creating connections and creating new nodes.
 *
 * @class AbstractHoverbox
 * @constructor
 * @param {AbstractNode} node The node Person or Partnership for which the hoverbox is drawn
 * @param {Number} x The x coordinate for the hoverbox
 * @param {Number} y The y coordinate for the hoverbox
 * @param {Number} width The width in pixels
 * @param {Number} height The height in pixels
 * @param {Number} nodeX The x coordinate of the node for which the hoverbox is drawn
 * @param {Number} nodeY The y coordinate of the node for which the hoverbox is drawn
 * @param {Raphael.st} nodeShapes Raphaël set containing the graphical elements that make up the node
 */

var AbstractHoverbox = Class.create({

  pin: function() {
    AbstractHoverbox.unpinAll(true, this);
    this._isPinned = true;
    AbstractHoverbox.pinnedHoverbox = this;
    AbstractHoverbox.activeHoverbox = this;
    this.animateDrawHoverZone();
  },

  unpin: function(hide) {
    this._isPinned = false;
    if (AbstractHoverbox.pinnedHoverbox === this) {
      AbstractHoverbox.pinnedHoverbox = null;
    }
    if (AbstractHoverbox.activeHoverbox === this) {
      AbstractHoverbox.activeHoverbox = null;
    }
    if (hide !== false) {
      this.animateHideHoverZone(true);
    }
  },

  isPinned: function() {
    return Boolean(this._isPinned);
  },

  updateHoveredTargetAt: function(canvasX, canvasY) {
    var view = editor.getView();
    var grownNodes = view._currentGrownNodes || [];
    var matchedNodeID = null;
    for (var i = 0; i < grownNodes.length; i++) {
      var nodeID = grownNodes[i];
      var targetNode = view.getNode(nodeID);
      if (!targetNode || !targetNode.getGraphics()) continue;
      var tX = targetNode.getGraphics().getX();
      var tY = targetNode.getGraphics().getY();
      var radius = PedigreeEditorParameters.attributes.personHoverBoxRadius || 90;
      if (Math.abs(canvasX - tX) <= radius && Math.abs(canvasY - tY) <= radius) {
        matchedNodeID = nodeID;
        break;
      }
    }
    if (view._currentHoveredNode !== matchedNodeID) {
      if (view._currentHoveredNode !== null) {
        var prevNode = view.getNode(view._currentHoveredNode);
        if (prevNode && prevNode.getGraphics() && prevNode.getGraphics().getHoverBox()) {
          prevNode.getGraphics().getHoverBox().setHighlighted(false);
        }
      }
      view._currentHoveredNode = matchedNodeID;
      if (matchedNodeID !== null) {
        var currNode = view.getNode(matchedNodeID);
        if (currNode && currNode.getGraphics() && currNode.getGraphics().getHoverBox()) {
          currNode.getGraphics().getHoverBox().setHighlighted(true);
        }
      }
    }
  },

  initialize: function (node, shiftX, shiftY, width, height, nodeX, nodeY, nodeShapes) {
    //var timer = new Timer();
    var me = this;
    this._node = node;
    this._relativeX = shiftX;
    this._relativeY = shiftY;
    this._nodeX = nodeX;
    this._nodeY = nodeY;
    this._hidden = true;
    this._enabled = false;
    this._width = width;
    this._height = height;
    this._isHovered = false;
    this._currentHandles = null;
    this._currentOrbs = null;
    this._currentButtons = null;
    this._handlesZoomSz = null;
    this._boxOnHover = editor.getPaper().rect(this.getX(), this.getY(), this._width, this._height, 5).attr(PedigreeEditorParameters.attributes.boxOnHover);
    this._backElements = editor.getPaper().set(this._boxOnHover);
    this._mask = this._boxOnHover.clone().attr({ fill: 'green', opacity: 0 });
    this._frontElements = editor.getPaper().set().push(this._mask);

    var nodeShapeSet = nodeShapes.flatten();
    this._backElements.insertBefore(nodeShapeSet);
    this._frontElements.insertAfter(nodeShapeSet);

    this.animateDrawHoverZone = this.animateDrawHoverZone.bind(this);
    this.animateHideHoverZone = this.animateHideHoverZone.bind(this);
    // hide initially
    this.getBoxOnHover().attr({ opacity: 0 });

    var onMaskTap = function(e) {
      if (e && e.stopPropagation) e.stopPropagation();
      if (!me.isPinned()) {
        me.pin();
      } else {
        if (typeof me.toggleMenu === 'function') {
          me.toggleMenu(!me.isMenuToggled());
        }
      }
    };
    this._mask.click(onMaskTap);
    if (this._mask.node) {
      var maskMoved = false;
      var maskStartX = 0, maskStartY = 0;
      this._mask.node.addEventListener('touchstart', function(e) {
        e.stopPropagation();
        maskMoved = false;
        var t = e.touches && e.touches[0];
        if (t) { maskStartX = t.clientX; maskStartY = t.clientY; }
      }, {passive: false});
      this._mask.node.addEventListener('touchmove', function(e) {
        var t = e.touches && e.touches[0];
        if (t && (Math.abs(t.clientX - maskStartX) > 8 || Math.abs(t.clientY - maskStartY) > 8)) {
          maskMoved = true;
        }
      }, {passive: true});
      this._mask.node.addEventListener('touchend', function(e) {
        e.stopPropagation();
        if (!maskMoved) {
          if (e.cancelable) e.preventDefault();
          onMaskTap(e);
        }
      }, {passive: false});
    }

    this.enable();
    //timer.printSinceLast("=== abstract howerbox runtime: ");
    this._isMenuToggled = false;
    this._justClosedMenu = false;
  },

  /**
     * Returns the x coordinate of the hoverbox
     *
     * @method getX
     * @return {Number} The x coordinate in pixels
     */
  getX: function () {
    return this.getNodeX() + this._relativeX;
  },

  /**
     * Returns the y coordinate of the hoverbox
     *
     * @method getY
     * @return {Number} The y coordinate in pixels
     */
  getY: function () {
    return this.getNodeY() + this._relativeY;
  },

  /**
     * Returns the x coordinate of the attached node
     *
     * @method getNodeX
     * @return {Number} The x coordinate in pixels
     */
  getNodeX: function () {
    // note: during construction getGraphics() isnot yet available, so need to store nodeX.
    //       however node may have been moved later, in which case we need to use current graphics X
    var nodeGraphics = this.getNode().getGraphics();
    if (nodeGraphics) {
      this._nodeX = nodeGraphics.getX();
    }
    return this._nodeX;
  },

  /**
     * Returns the y coordinate of the attached node
     *
     * @method getNodeY
     * @return {Number} The y coordinate in pixels
     */
  getNodeY: function () {
    var nodeGraphics = this.getNode().getGraphics();
    if (nodeGraphics) {
      this._nodeY = nodeGraphics.getY();
    }
    return this._nodeY;
  },

  /**
     * Returns the width of the hoverbox
     *
     * @method getWidth
     * @return {Number} The width in pixels
     */
  getWidth: function () {
    return this._width;
  },

  /**
     * Returns the height of the hoverbox
     *
     * @method getHeight
     * @return {Number} The height in pixels
     */
  getHeight: function () {
    return this._height;
  },

  /**
     * Returns the node for which the hoverbox is drawn
     *
     * @method getNode
     * @return {AbstractNode} Can be either a Partnership or a Person
     */
  getNode: function () {
    return this._node;
  },

  /**
     * Creates the buttons used in this hoverbox
     *
     * @method generateButtons
     * @return {Raphael.st} A set of buttons
     */
  generateButtons: function () {
    if (this._currentButtons !== null) {
      return;
    }
    this._currentButtons = [];
  },

  regenerateButtons: function () {
    this.removeButtons();
    this.generateButtons();
  },

  removeButtons: function () {
    if (!this._currentButtons) {
      return;
    }

    var enableState = this._enabled;

    enableState && this.disable();
    for (var i = 0; i < this._currentButtons.length; i++) {
      this.getFrontElements().exclude(this._currentButtons[i]);
      this._currentButtons[i].remove();
    }
    this._currentButtons = null;
    enableState && this.enable();
  },

  hideButtons: function () {
    if (!this._currentButtons) {
      return;
    }
    for (var i = 0; i < this._currentButtons.length; i++) {
      if (this._currentButtons[i].hasOwnProperty('mask')) {
        this._currentButtons[i].mask.attr(PedigreeEditorParameters.attributes.btnMaskHoverOff);
      }
      this._currentButtons[i].hide();
    }
  },

  showButtons: function () {
    if (!this._currentButtons) {
      return;
    }
    for (var i = 0; i < this._currentButtons.length; i++) {
      this._currentButtons[i].show();
    }
  },

  /**
     * Returns Raphael set of the buttons in this hoverbox
     *
     * @method getCurrentButtons
     * @return {Raphael.st} A set of buttons
     */
  getCurrentButtons: function () {
    return this._currentButtons;
  },

  /**
     * Removes all handles currently used in this hoverbox
     *
     * @method removeHandles
     */
  removeHandles: function () {
    if (!this._currentHandles) {
      return;
    }

    var enableState = this._enabled;
    enableState && this.disable();
    for (var i = 0; i < this._currentOrbs.length; i++) {
      this.getFrontElements().exclude(this._currentOrbs[i]);
    }
    this._currentOrbs = null;
    enableState && this.enable();

    for (var i = 0; i < this._currentHandles.length; i++) {
      this._currentHandles[i].remove();
    }
    this._currentHandles = null;
  },

  hideHandles: function () {
    if (!this._currentHandles) {
      return;
    }
    for (var i = 0; i < this._currentHandles.length; i++) {
      this._currentHandles[i].hide();
    }
  },

  showHandles: function () {
    if (!this._currentHandles) {
      return;
    }
    for (var i = 0; i < this._currentHandles.length; i++) {
      this._currentHandles[i].show();
    }
  },

  /**
     * Creates the handles used in this hoverbox. Returns a list of handles
     *
     * @method generateHandles
     */
  generateHandles: function () {
    if (this._currentHandles !== null) {
      return;
    }
    this._currentHandles = [];
    this._currentOrbs = [];
    this._handlesZoomSz = editor.getWorkspace().getCurrentZoomLevel();
  },

  /**
     * Iff handles are present, removes all and creates new set of handles
     *
     * @method regenerateHandles
     */
  regenerateHandles: function () {
    if (this._currentHandles) {
      this.removeHandles();
    }
    if (!this._hidden || this.isMenuToggled()) {
      this.generateHandles();
    }
  },

  /**
     * Generates a button and places it on the hoverbox
     *
     * @method createButton
     * @param {Number} x The x coordinate of the button
     * @param {Number} y The y coordinate of the button
     * @param {String|Array} svgPath The svg path for the button (correctly scaled)
     * @param {Object} svgPathBBox The BBox for the svg path. Precomputed for performance reasons
     * @param attributes The svg attributes
     * @param {Function} onClick Callback for the button
     * @param {String} className The class attribute for the button
     *
     * @return {Raphael.st} The generated button
     */
  createButton: function (x, y, svgPath, svgPathBBox, attributes, onClick, className, title) {
    var icon = editor.getPaper().path(svgPath).attr(attributes);
    icon.transform(['t', x, y]);

    // manually compute the size of the mask because Raphael.transform() is exptremely slow
    var minDim = 36;
    var rawW = svgPathBBox.width * 1.5;
    var rawH = svgPathBBox.height * 1.5;
    var newWidth  = Math.max(rawW, minDim);
    var newHeight = Math.max(rawH, minDim);
    var centerX = x + svgPathBBox.x + svgPathBBox.width / 2;
    var centerY = y + svgPathBBox.y + svgPathBBox.height / 2;
    var mask = editor.getPaper().rect(centerX - newWidth / 2, centerY - newHeight / 2, newWidth, newHeight, 4);
    mask.attr({fill: 'gray', opacity: 0, 'stroke-width' : 0, cursor: 'pointer'});

    var button = editor.getPaper().set(mask, icon).toFront();

    var me = this;
    var clickFunct = function () {
      if (me._hidden) {
        button.isClicked = false;
        return;
      }
      button.isClicked = !button.isClicked;
      if (button.isClicked) {
        mask.attr(PedigreeEditorParameters.attributes.btnMaskClick);
      } else {
        mask.attr(PedigreeEditorParameters.attributes.btnMaskHoverOn);
      }
      onClick && onClick();
    };
    button.click(clickFunct);
    button.mousedown(function () {
      mask.attr(PedigreeEditorParameters.attributes.btnMaskClick);
    });
    button.hover(function () {
      mask.attr(PedigreeEditorParameters.attributes.btnMaskHoverOn);
      if (title) {
        mask.attr({ 'title': title });
      }
    },
      function () {
        mask.attr(PedigreeEditorParameters.attributes.btnMaskHoverOff);
      });
    className && button.forEach(function (element) {
      element.node.setAttribute('class', className);
    });
    button.icon = icon;
    button.mask = mask;
    if (this._hidden && !this.isMenuToggled()) {
      button.hide();
    }

    this._currentButtons.push(button);
    this.disable();
    this.getFrontElements().push(button);
    this.enable();
  },

  /**
     * Creates a show-menu button
     *
     * @method generateMenuBtn
     * @return {Raphael.st} The generated button
     */
  generateMenuBtn: function () {
    var me = this;
    var action = function () {
      me.toggleMenu(!me.isMenuToggled());
    };
    var attributes = PedigreeEditorParameters.attributes.menuBtnIcon;
    var x = this.getX() + 4;
    var y = this.getY() + 4;
    this.createButton(x, y, editor.getView().__menuButton_svgPath, editor.getView().__menuButton_BBox,
      attributes, action, 'menu-trigger', 'node properties');
  },
  /**
     * Creates and returns a delete button (big red X).
     *
     * @method generateDeleteBtn
     * @return {Raphael.st} the generated button
     */
  generateDeleteBtn: function() {
    var me = this;
    var action = function() {
      me.unpin(true);
      me.animateHideHoverZone(true);
      var event = { 'nodeID': me.getNode().getID() };
      document.fire('pedigree:node:remove', event);
    };
    var attributes = PedigreeEditorParameters.attributes.deleteBtnIcon;
    var x = this.getX() + this.getWidth() - 20 - this.getWidth() / 40;
    var y = this.getY() + this.getHeight() / 40;
    this.createButton(x, y, editor.getView().__deleteButton_svgPath, editor.getView().__deleteButton_BBox,
      attributes, action, 'delete', 'remove node');
  },

  /**
     * Returns the gray box that appears when the node is hovered
     *
     * @method getBoxOnHover
     * @return {Raphael.el} Raphael rectangle element
     */
  getBoxOnHover: function () {
    return this._boxOnHover;
  },

  /**
     * Returns true box if the hoverbox is currently hovered
     *
     * @method isHovered
     * @return {Boolean} Raphael rectangle element
     */
  isHovered: function () {
    return this._isHovered;
  },

  /**
     * Sets the hovered property to isHovered.
     * @method setHovered
     * @param {Boolean} isHovered Set to true if the box is hovered
     */
  setHovered: function (isHovered) {
    this._isHovered = isHovered;
  },

  /**
     * Enbales or disables the highlighting of the node
     * @method setHighlighted
     * @param {Boolean} isHighlighted Set to true enables green highlight box, false disables it
     */
  setHighlighted: function (isHighlighted) {
    // autoimaticaly highlight and unhighlight the node being dragged over
    var box = this.getBoxOnHover();
    if (!box || typeof box.attr !== 'function') {
      return;
    }
    if (isHighlighted) {
      box.attr(PedigreeEditorParameters.attributes.boxOnHover);
      box.attr('fill', 'green');
    } else {
      box.attr(PedigreeEditorParameters.attributes.boxOnHover).attr('opacity', 0);
    }
  },

  /**
     * Returns the invisible mask layer in front of the hoverbox
     *
     * @method getHoverZoneMask
     * @return {Raphael.el} Raphael rectangle
     */
  getHoverZoneMask: function () {
    return this._mask;
  },

  /**
     * Returns a Raphael set containing all hoverbox elements that are layered
     * in front of the node graphics
     *
     * @method getFrontElements
     * @return {Raphael.st} set of Raphael elements
     */
  getFrontElements: function () {
    return this._frontElements;
  },

  /**
     * Returns a Raphael set containing all hoverbox elements that are layered
     * behind of the node graphics
     *
     * @method getBackElements
     * @return {Raphael.st} set of Raphael elements
     */
  getBackElements: function () {
    return this._backElements;
  },

  /**
     * Creates a handle with a blue orb from the center of the node and places it behind the node icon
     *
     * @method generateHandle
     * @param {String} type Should be 'parent', 'child' or 'partner'
     * @param {Number} orbX The x coordinate of the orb
     * @param {Number} orbY The y coordinate of the orb
     * @return {Raphael.st} Raphael set of elements that make up the handle
     */
  generateHandle: function (type, startX, startY, orbX, orbY, title, toHide) {
    var strokeWidth = editor.getWorkspace().getSizeNormalizedToDefaultZoom(PedigreeEditorParameters.attributes.handleStrokeWidth);
    var path = [['M', startX, startY], ['L', orbX, orbY]];
    var connection = editor.getPaper().path(path).attr({ 'stroke-width': strokeWidth, stroke: 'gray' }).toBack();
    connection.oPath = path;

    var touchPresent = ('ontouchstart' in window) || (navigator.maxTouchPoints > 0) || ('createTouch' in document);

    var orbRadius = touchPresent ? PedigreeEditorParameters.attributes.touchOrbRadius : PedigreeEditorParameters.attributes.orbRadius;
    var orbHue = PedigreeEditorParameters.attributes.orbHue;

    var normalOrbAttr = { fill: 'r(.5,.9)hsb(' + orbHue + ', 1, .75)-hsb(' + orbHue + ', .5, .25)', stroke: 'none' };
    var selectedOrbAttr = { fill: 'r(.5,.9)hsb(' + (orbHue + .36) + ', 1, .75)-hsb(' + (orbHue + .36) + ', .5, .25)' };
    var orbAttrX = 'cx';
    var orbAttrY = 'cy';

    var orb = generateOrb(editor.getPaper(), orbX, orbY, orbRadius * 1.1).attr('cursor', 'pointer');
    orb[0].attr(normalOrbAttr);

    var hitRadius = touchPresent ? 24 : 20;
    var hitArea = editor.getPaper().circle(orbX, orbY, hitRadius).attr({
      fill: '#ffffff',
      'fill-opacity': 0,
      opacity: 0,
      stroke: 'none',
      cursor: 'pointer'
    });

    var handle  = editor.getPaper().set().push(connection, orb, hitArea);
    handle.type = type;
    connection.insertBefore(this.getHoverZoneMask());
    orb.toFront();
    hitArea.toFront();

    var me = this;
    var inHoverMode = false;
    var interactionStarted = false;

    var onDragHandle = function () {
      if (!inHoverMode) {
        inHoverMode = true;
        if (editor.getView().getCurrentDraggable() !== null) {
          editor.getView().enterHoverMode(me.getNode(), type);
        }
        toHide && toHide.hide();
      }
    };

    // is true when any button other than the left mouse button is presses
    var wrongClick = false;
    var start = function (x, y, e) {
      if (interactionStarted) {
        return;
      }
      interactionStarted = true;

      wrongClick = false;
      if (e && e.button !== undefined && e.button !== 0) {
        interactionStarted = false;
        wrongClick = true;
        return;
      }
      if (e) {
        if (e.stopPropagation) e.stopPropagation();
        if (e.originalEvent && e.originalEvent.stopPropagation) e.originalEvent.stopPropagation();
      }
      if (false) {
        interactionStarted = false;
        wrongClick = true;
        return;
      }
      connection.toFront();
      orb.stop();
      orb.toFront();
      hitArea.stop();
      hitArea.toFront();
      hitArea.ox = orbX;
      hitArea.oy = orbY;
      hitArea.attr({cx: orbX, cy: orbY});
      connection.node.style.pointerEvents = 'none';
      orb[0].node.style.pointerEvents = 'none';
      orb[1].node.style.pointerEvents = 'none';
      inHoverMode = false;
      me.disable();
      me.getFrontElements().toFront();
      if (!orb.ot) {
        orb.ot = orb[0].transform();
        orb.ox = orb[0].attr(orbAttrX);
        orb.oy = orb[0].attr(orbAttrY);
      } else {
        // revert to base transformation if next click started while "end" animation was still running
        orb.transform('');
        orb.attr(orbAttrX, orb.ox);
        orb.attr(orbAttrY, orb.oy);
        orb.transform(orb.ot);
      }
      connection.ox = connection.oPath[1][1];
      connection.oy = connection.oPath[1][2];
      handle.isDragged = false;
      editor.getView().setCurrentDraggable(me.getNode().getID());
      // highlight valid targets (after a small delay - so that nothing gets annoyingly highlighted
      // and instantly un-highlighted if the person just clicks the orb without dragging)
      setTimeout(onDragHandle, 100);
    };
    var move = function (dx, dy) {
      if (wrongClick || !interactionStarted) {
        return;
      }
      onDragHandle();
      dx = dx / editor.getWorkspace().zoomCoefficient;
      dy = dy / editor.getWorkspace().zoomCoefficient;
      (orb.ot.length > 0) && orb.transform('');
      var curX = orb.ox + dx;
      var curY = orb.oy + dy;
      orb.attr(orbAttrX, curX);
      orb.attr(orbAttrY, curY);
      (orb.ot.length > 0) && orb.transform(orb.ot);
      connection.oPath[1][1] = connection.ox + dx;
      connection.oPath[1][2] = connection.oy + dy;
      connection.attr('path', connection.oPath);
      if (dx > 1 || dx < -1 || dy > 1 || dy < -1) {
        handle.isDragged = true;
      }

      // Actively track which valid target node the orb is inside right now
      var view = editor.getView();
      var validIds = view._currentGrownNodes || [];
      var hitNodeId = null;
      for (var i = 0; i < validIds.length; i++) {
        var candidate = view.getNode(validIds[i]);
        if (candidate && candidate.getGraphics() && candidate.getGraphics().containsXY(curX, curY)) {
          hitNodeId = validIds[i];
          break;
        }
      }
      if (view._currentHoveredNode !== hitNodeId) {
        if (view._currentHoveredNode !== null) {
          var prevNode = view.getNode(view._currentHoveredNode);
          if (prevNode && prevNode.getGraphics() && prevNode.getGraphics().getHoverBox()) {
            prevNode.getGraphics().getHoverBox().setHighlighted(false);
          }
        }
        view._currentHoveredNode = hitNodeId;
        if (hitNodeId !== null) {
          var nextNode = view.getNode(hitNodeId);
          if (nextNode && nextNode.getGraphics() && nextNode.getGraphics().getHoverBox()) {
            nextNode.getGraphics().getHoverBox().setHighlighted(true);
          }
        }
      }
    };
    var end = function () {
      inHoverMode = false;
      interactionStarted = false;
      if (wrongClick) {
        return;
      }

      connection.node.style.pointerEvents = 'auto';
      orb[0].node.style.pointerEvents = 'auto';
      orb[1].node.style.pointerEvents = 'auto';

      var view = editor.getView();
      var curHoveredId = view.getCurrentHoveredNode();

      // Fallback: check orb drop coordinates BEFORE exitHoverMode() clears _currentGrownNodes
      if ((curHoveredId === null || curHoveredId === undefined) && handle.isDragged) {
        var dropX = orb[0].attr(orbAttrX);
        var dropY = orb[0].attr(orbAttrY);
        var validIds = view._currentGrownNodes || [];
        for (var i = 0; i < validIds.length; i++) {
          var candidate = view.getNode(validIds[i]);
          if (candidate && candidate.getGraphics() && candidate.getGraphics().containsXY(dropX, dropY)) {
            curHoveredId = validIds[i];
            break;
          }
        }
      }

      view.setCurrentDraggable(null);
      view.exitHoverMode();

      if (handle.isDragged) {
        if (orb.ot.length == 0) {
          var finalPosition = {};
          finalPosition[orbAttrX] = orb.ox;
          finalPosition[orbAttrY] = orb.oy;
          orb.animate(finalPosition, 1000, 'elastic', function () { });
        } else {
          // animation for shapes with transformations (movement and animation via transform() could have been
          // used in all cases, but works noticeably slower than plain coordinate manipulation in some browsers)
          var dx = orb.ox - orb[0].attr(orbAttrX);
          var dy = orb.oy - orb[0].attr(orbAttrY);
          orb.animate({ 'transform': 'T' + dx + ',' + dy + 'R45' }, 1000, 'elastic', function () {
            orb.transform('');
            orb.attr(orbAttrX, orb.ox);
            orb.attr(orbAttrY, orb.oy);
            orb.transform(orb.ot);
          });
        }
        hitArea.animate({cx: hitArea.ox, cy: hitArea.oy}, 1000, 'elastic');
      }
      connection.oPath[1][1] = connection.ox;
      connection.oPath[1][2] = connection.oy;
      connection.animate({ 'path': connection.oPath }, 1000, 'elastic');
      orb[0].attr(normalOrbAttr);
      connection.insertBefore(me.getHoverZoneMask());

      me.enable();

      if (handle.isDragged && (curHoveredId === null || curHoveredId === undefined)) {
        toHide && toHide.show();
      }
      me.unpin(true);
      if (!handle.isDragged || (curHoveredId !== null && curHoveredId !== undefined)) {
        me.handleAction(handle.type, handle.isDragged, curHoveredId);
      }
    };

        orb.drag(move, start, end);
    hitArea.drag(move, start, end);

    var onHoverOver = function() {
      orb[0].attr(selectedOrbAttr);
      if (title) {
        hitArea.attr({'title': title});
        orb[0].attr({'title': title});
        orb[1].attr({'title': title});
      }
    };
    var onHoverOut = function() {
      orb[0].attr(normalOrbAttr);
    };

    orb.hover(onHoverOver, onHoverOut);
    hitArea.hover(onHoverOver, onHoverOut);

    var stopTouchProp = function(evt) {
      evt.stopPropagation();
    };
    if (hitArea.node) hitArea.node.addEventListener('touchstart', stopTouchProp, {passive: false});
    if (orb[0].node) orb[0].node.addEventListener('touchstart', stopTouchProp, {passive: false});
    if (orb[1].node) orb[1].node.addEventListener('touchstart', stopTouchProp, {passive: false});

    this._currentOrbs.push(orb[0]);
    this._currentOrbs.push(orb[1]);
    this._currentOrbs.push(hitArea);
    this.disable();
    this.getFrontElements().push(orb[0]);
    this.getFrontElements().push(orb[1]);
    this.getFrontElements().push(hitArea);
    this.enable();

    //handle.getType = function() {
    //    return type;
    //};
    return handle;
  },

  /**
     * Returns true if the menu for this node is open
     *
     * @method isMenuToggled
     * @return {Boolean}
     */
  isMenuToggled: function () {
    return false;
  },

  toggleMenu: function (isMenuToggled) {
  },

  /*
     * Fades the hoverbox graphics in
     *
     * @method animateDrawHoverZone
     */
  animateDrawHoverZone: function () {
    this._hidden = false;
    if (editor.getView().getCurrentDraggable() !== null) {
      return;
    } // do not redraw when dragging

    // Always enforce AT MOST ONE active hoverbox across the pedigree
    AbstractHoverbox.unpinAll(true, this);
    AbstractHoverbox.activeHoverbox = this;

    this.getNode().getGraphics().setSelected(true);
    var drawBox = this.getBoxOnHover();
    if (drawBox && typeof drawBox.stop === 'function') {
      drawBox.stop().animate({ opacity: 0.7 }, 200);
    }

    this.generateButtons();
    this.showButtons();
    this.getCurrentButtons().forEach(function (button) {
      if (button.hasOwnProperty('icon')) {
        button.icon.stop().animate({ opacity: 1 }, 200);
      }
    });

    if (this._handlesZoomSz != editor.getWorkspace().getCurrentZoomLevel()) {
      this.removeHandles();
    }
    this.generateHandles();
    this.showHandles();
  },

  /**
     * Fades the hoverbox graphics out
     *
     * @method animateHideHoverZone
     */
  animateHideHoverZone: function(force) {
    if (this._isPinned && !force) {
      return;
    }
    if (force) {
      this._isPinned = false;
      if (AbstractHoverbox.pinnedHoverbox === this) {
        AbstractHoverbox.pinnedHoverbox = null;
      }
    }
    if (AbstractHoverbox.activeHoverbox === this) {
      AbstractHoverbox.activeHoverbox = null;
    }
    this._hidden = true;
    if (editor.getView().getCurrentDraggable() !== null) {
      return;
    } // do not hide when dragging

    this.getNode().getGraphics().setSelected(false);
    var hideBox = this.getBoxOnHover();
    if (hideBox && typeof hideBox.stop === 'function') {
      if (force) {
        hideBox.stop().attr({ opacity: 0 });
      } else {
        hideBox.stop().animate({ opacity: 0 }, 200);
      }
    }

    this.hideButtons();
    this.hideHandles();
  },

  /**
     * Stops the hoverbox from responding to mouseovers
     *
     * @method disable
     */
  disable: function () {
    this._enabled = false;
    this.getFrontElements().unhover(this.animateDrawHoverZone, this.animateHideHoverZone);
  },

  /**
     * Attaches onMouseOver behavior to the hoverbox
     *
     * @method enable
     */
  enable: function () {
    this._enabled = true;
    this.getFrontElements().hover(this.animateDrawHoverZone, this.animateHideHoverZone);
  },

  /**
     * Deletes the hoverbox
     *
     * @method remove
     */
  remove: function () {
    this.disable();
    this.removeButtons();
    this.removeHandles();
    this.getBackElements().remove();
    this.getFrontElements().remove();
  },

  /**
     * Updates the hoverbox behavior after a widget (like the menu) is closed
     *
     * @method onWidgetHide
     */
  onWidgetHide: function () {
    this._isMenuToggled = false;
    // prevent menu from closing and opening right away upon a click on the menu button while menu is open
    this._justClosedMenu = true;
    var me = this;
    setTimeout(function () {
      me._justClosedMenu = false;
    }, 100);

    this.animateHideHoverZone(true);
  },

  onWidgetShow: function () {
    this._isMenuToggled = true;
  }
});

AbstractHoverbox.pinnedHoverbox = null;
AbstractHoverbox.activeHoverbox = null;

AbstractHoverbox.unpinAll = function (hide, exceptHoverbox) {
  if (AbstractHoverbox.pinnedHoverbox && AbstractHoverbox.pinnedHoverbox !== exceptHoverbox) {
    try {
      AbstractHoverbox.pinnedHoverbox.unpin(hide);
    } catch (e) {}
    AbstractHoverbox.pinnedHoverbox = null;
  }
  if (AbstractHoverbox.activeHoverbox && AbstractHoverbox.activeHoverbox !== exceptHoverbox) {
    try {
      AbstractHoverbox.activeHoverbox.animateHideHoverZone(true);
    } catch (e) {}
    AbstractHoverbox.activeHoverbox = null;
  }
  try {
    var view = editor && editor.getView && editor.getView();
    if (view && (view.getNodeMap || view._nodeMap)) {
      var map = typeof view.getNodeMap === 'function' ? view.getNodeMap() : view._nodeMap;
      for (var id in map) {
        if (map.hasOwnProperty(id)) {
          var node = map[id];
          var hb = node && node.getGraphics && node.getGraphics().getHoverBox && node.getGraphics().getHoverBox();
          if (hb && hb !== exceptHoverbox) {
            hb._isPinned = false;
            if (hide) {
              hb.animateHideHoverZone(true);
            }
          }
        }
      }
    }
  } catch (err) {}
};

export default AbstractHoverbox;