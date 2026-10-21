import AbstractHoverbox from 'pedigree/view/abstractHoverbox';
import Raphael from 'pedigree/raphael';
import DriveBackend from '../DriveBackend';

/**
 * Workspace contains the Raphael canvas, the zoom/pan controls and the menu bar
 * on the top. The class includes functions for managing the Raphael paper object and coordinate transformation methods
 * for taking pan and zoom levels into account.
 *
 * @class Workspace
 * @constructor
 */

var Workspace = Class.create({

  initialize: function() {
    var me = this;
    this.canvas = new Element('div', {'id' : 'canvas'});
    this.workArea = new Element('div', {'id' : 'work-area'}).update(this.canvas);
    $('body').update(this.workArea);
    this.canvas.setStyle({touchAction: 'none'});
    this.workArea.setStyle({touchAction: 'none'});
    var screenDimensions = document.viewport ? document.viewport.getDimensions() : null;
    this.generateTopMenu();
    var topOffset = (this.canvas && this.canvas.cumulativeOffset) ? this.canvas.cumulativeOffset().top : 62;
    var viewportWidth = (window.innerWidth && window.innerWidth > 0) ? window.innerWidth : ((screenDimensions && screenDimensions.width > 0) ? screenDimensions.width : 800);
    var viewportHeight = (window.innerHeight && window.innerHeight > 0) ? window.innerHeight : ((screenDimensions && screenDimensions.height > 0) ? screenDimensions.height : 600);
    this.width = Math.max(100, viewportWidth);
    this.height = Math.max(100, viewportHeight - topOffset - 4);
    this._paper = Raphael('canvas', this.width, this.height);
    if (this._paper && this._paper.canvas) {
      this._paper.canvas.style.touchAction = 'none';
    }
    this.viewBoxX = 0;
    this.viewBoxY = 0;
    this.zoomCoefficient = 1;

    this.background = this.getPaper().rect(0,0, this.width, this.height).attr({fill: 'blue', stroke: 'none', opacity: 0}).toBack();
    this.background.node.setAttribute('class', 'panning-background');

    this.workArea.insert(new Element('div', {'id': 'attribution'})
      .insert('&copy; 2019-2022 Gene42 Inc. | &copy; 2026 Fabiano Poswar'));

    this.adjustSizeToScreen = this.adjustSizeToScreen.bind(this);
    Event.observe (window, 'resize', me.adjustSizeToScreen);
    this.generateViewControls();

    // Initialize pan by dragging (desktop mouse)
    var start = function(x, y, evt) {
      if (evt && (evt.type === 'touchstart' || (evt.touches && evt.touches.length > 0))) return;
      if (editor && editor.isAnyMenuVisible && editor.isAnyMenuVisible()) {
        me.background.isDragged = false;
        return;
      }
      me.background.isDragged = false;
      if (!isFinite(me.viewBoxX)) me.viewBoxX = 0;
      if (!isFinite(me.viewBoxY)) me.viewBoxY = 0;
      me.background.ox = me.viewBoxX;
      me.background.oy = me.viewBoxY;
      me.background.attr({cursor: 'move'});
    };
    var move = function(dx, dy, x, y, evt) {
      if (evt && (evt.type === 'touchmove' || (evt.touches && evt.touches.length > 0))) return;
      if (me._isPinching) return;
      if (me.background.ox === undefined || !isFinite(me.background.ox) || !isFinite(dx) || !isFinite(dy)) {
        return;
      }
      if (Math.abs(dx) > 3 || Math.abs(dy) > 3) {
        me.background.isDragged = true;
        AbstractHoverbox.unpinAll && AbstractHoverbox.unpinAll(true);
      }
      var zoom = (typeof me.zoomCoefficient === 'number' && isFinite(me.zoomCoefficient) && me.zoomCoefficient > 0) ? me.zoomCoefficient : 1;
      var w = Math.max(10, (me.width || 800) / zoom);
      var h = Math.max(10, (me.height || 600) / zoom);
      var baseOx = isFinite(me.background.ox) ? me.background.ox : (isFinite(me.viewBoxX) ? me.viewBoxX : 0);
      var baseOy = isFinite(me.background.oy) ? me.background.oy : (isFinite(me.viewBoxY) ? me.viewBoxY : 0);
      var deltax = baseOx - dx / zoom;
      var deltay = baseOy - dy / zoom;

      if (isFinite(deltax) && isFinite(deltay) && isFinite(w) && isFinite(h)) {
        me.getPaper().setViewBox(deltax, deltay, w, h);
        me.background.curOx = deltax;
        me.background.curOy = deltay;
        me.background.attr({x: deltax, y: deltay, width: w, height: h });
      }
    };
    var end = function(evt) {
      if (evt && (evt.type === 'touchend' || (evt.touches && evt.touches.length > 0))) return;
      if (me.background.curOx !== undefined && isFinite(me.background.curOx)) {
        me.viewBoxX = me.background.curOx;
      } else if (me.background.ox !== undefined && isFinite(me.background.ox)) {
        me.viewBoxX = me.background.ox;
      }
      if (me.background.curOy !== undefined && isFinite(me.background.curOy)) {
        me.viewBoxY = me.background.curOy;
      } else if (me.background.oy !== undefined && isFinite(me.background.oy)) {
        me.viewBoxY = me.background.oy;
      }
      if (!isFinite(me.viewBoxX)) me.viewBoxX = 0;
      if (!isFinite(me.viewBoxY)) me.viewBoxY = 0;
      delete me.background.curOx;
      delete me.background.curOy;
      me.background.attr({cursor: 'default'});
      AbstractHoverbox.unpinAll && AbstractHoverbox.unpinAll(true);
    };
    me.background.drag(move, start, end);
    me.background.click(function() {
      AbstractHoverbox.unpinAll && AbstractHoverbox.unpinAll(true);
    });

    // Mobile Touch Gestures: 1-finger canvas panning and 2-finger pinch-to-zoom
    var isPinching = false;
    var pinchStartDist = 0;
    var pinchStartZoom = 1;
    var pinchAnchorCanvas = {x: 0, y: 0};

    var isPanning = false;
    var panStartTouch = {clientX: 0, clientY: 0};
    var panStartViewBox = {x: 0, y: 0};
    var isPanMoved = false;
    var lastTap = null;

    var isBackgroundTarget = function(target) {
      if (!target) return false;
      if (target === me.background.node || target === me._paper.canvas || target === me.canvas) return true;
      if (target.classList && target.classList.contains('panning-background')) return true;
      if (target.tagName && target.tagName.toLowerCase() === 'svg') return true;
      return false;
    };

    var onCanvasTouchStart = function(e) {
      if (editor && editor.isAnyMenuVisible && editor.isAnyMenuVisible()) {
        return;
      }
      if (e.touches.length === 2) {
        var t1 = e.touches[0];
        var t2 = e.touches[1];
        if (t1 && t2) {
          isPinching = true;
          isPanning = false;
          me._isPinching = true;

          pinchStartDist = Math.hypot(t2.clientX - t1.clientX, t2.clientY - t1.clientY);
          pinchStartZoom = (typeof me.zoomCoefficient === 'number' && isFinite(me.zoomCoefficient) && me.zoomCoefficient > 0) ? me.zoomCoefficient : 1;

          var midClientX = (t1.clientX + t2.clientX) / 2;
          var midClientY = (t1.clientY + t2.clientY) / 2;
          var midDiv = me.viewportToDiv(midClientX, midClientY);
          pinchAnchorCanvas = me.divToCanvas(midDiv.x, midDiv.y);

          e.preventDefault();
          e.stopPropagation();
        }
      } else if (e.touches.length === 1) {
        isPinching = false;
        me._isPinching = false;
        if (isBackgroundTarget(e.target)) {
          isPanning = true;
          isPanMoved = false;
          var t0 = e.touches[0];
          panStartTouch = { clientX: t0.clientX, clientY: t0.clientY };
          panStartViewBox = {
            x: (isFinite(me.viewBoxX) ? me.viewBoxX : 0),
            y: (isFinite(me.viewBoxY) ? me.viewBoxY : 0)
          };
        } else {
          isPanning = false;
        }
      }
    };

    var onCanvasTouchMove = function(e) {
      if (isPinching && e.touches.length >= 2) {
        e.preventDefault();
        e.stopPropagation();

        var t1 = e.touches[0];
        var t2 = e.touches[1];
        if (!t1 || !t2) return;
        var currentDist = Math.hypot(t2.clientX - t1.clientX, t2.clientY - t1.clientY);
        if (pinchStartDist > 0 && isFinite(currentDist) && isFinite(pinchStartDist)) {
          var scale = currentDist / pinchStartDist;
          var newZoom = Math.min(1.25, Math.max(0.15, pinchStartZoom * scale));
          newZoom = Math.round(newZoom * 100) / 100;

          var currentMidClientX = (t1.clientX + t2.clientX) / 2;
          var currentMidClientY = (t1.clientY + t2.clientY) / 2;
          var curMidDiv = me.viewportToDiv(currentMidClientX, currentMidClientY);

          var newW = Math.max(10, (me.width || 800) / newZoom);
          var newH = Math.max(10, (me.height || 600) / newZoom);

          var newX = pinchAnchorCanvas.x - curMidDiv.x / newZoom;
          var newY = pinchAnchorCanvas.y - curMidDiv.y / newZoom;

          if (isFinite(newX) && isFinite(newY) && isFinite(newW) && isFinite(newH)) {
            me.viewBoxX = newX;
            me.viewBoxY = newY;
            me.zoomCoefficient = newZoom;

            me.getPaper().setViewBox(me.viewBoxX, me.viewBoxY, newW, newH);
            me.background.attr({x: me.viewBoxX, y: me.viewBoxY, width: newW, height: newH});
            me.syncSliderToZoom(newZoom);
          }
        }
      } else if (isPanning && e.touches.length === 1) {
        e.preventDefault();
        var t0 = e.touches[0];
        if (!t0) return;
        var dx = t0.clientX - panStartTouch.clientX;
        var dy = t0.clientY - panStartTouch.clientY;
        if (Math.abs(dx) > 3 || Math.abs(dy) > 3) {
          isPanMoved = true;
          AbstractHoverbox.unpinAll && AbstractHoverbox.unpinAll(true);
        }
        var zoom = (typeof me.zoomCoefficient === 'number' && isFinite(me.zoomCoefficient) && me.zoomCoefficient > 0) ? me.zoomCoefficient : 1;
        var w = Math.max(10, (me.width || 800) / zoom);
        var h = Math.max(10, (me.height || 600) / zoom);
        var curX = panStartViewBox.x - dx / zoom;
        var curY = panStartViewBox.y - dy / zoom;

        if (isFinite(curX) && isFinite(curY) && isFinite(w) && isFinite(h)) {
          me.getPaper().setViewBox(curX, curY, w, h);
          me.background.attr({x: curX, y: curY, width: w, height: h});
          me.viewBoxX = curX;
          me.viewBoxY = curY;
        }
      }
    };

    var onCanvasTouchEnd = function(e) {
      if (isPinching) {
        e.preventDefault();
        e.stopPropagation();
        if (e.touches.length === 1) {
          // Smooth 2-to-1 finger transition: update pan reference so canvas does not jump
          isPinching = false;
          me._isPinching = false;
          isPanning = true;
          isPanMoved = true;
          var t0 = e.touches[0];
          panStartTouch = { clientX: t0.clientX, clientY: t0.clientY };
          panStartViewBox = {
            x: (isFinite(me.viewBoxX) ? me.viewBoxX : 0),
            y: (isFinite(me.viewBoxY) ? me.viewBoxY : 0)
          };
        } else if (e.touches.length === 0) {
          isPinching = false;
          me._isPinching = false;
          isPanning = false;
        }
      } else if (isPanning) {
        if (e.touches.length === 0) {
          isPanning = false;
          AbstractHoverbox.unpinAll && AbstractHoverbox.unpinAll(true);
          // Double-tap on empty background: zoom in one step around the tap (only if not panned)
          var tap = e.changedTouches && e.changedTouches[0];
          if (!isPanMoved && tap && e.type === 'touchend') {
            var now = Date.now();
            if (lastTap && now - lastTap.time < 300 &&
                Math.hypot(tap.clientX - lastTap.x, tap.clientY - lastTap.y) < 30) {
              lastTap = null;
              var curZoom = (typeof me.zoomCoefficient === 'number' && isFinite(me.zoomCoefficient) && me.zoomCoefficient > 0) ? me.zoomCoefficient : 1;
              var targetZoom = curZoom >= 1.25 - 0.001 ? 0.5 : Math.min(1.25, curZoom + 0.15);
              targetZoom = Math.round(targetZoom * 100) / 100;
              var tapDiv = me.viewportToDiv(tap.clientX, tap.clientY);
              var tapCanvas = me.divToCanvas(tapDiv.x, tapDiv.y);
              var targetX = tapCanvas.x - tapDiv.x / targetZoom;
              var targetY = tapCanvas.y - tapDiv.y / targetZoom;
              var tw = Math.max(10, (me.width || 800) / targetZoom);
              var th = Math.max(10, (me.height || 600) / targetZoom);
              if (isFinite(targetX) && isFinite(targetY) && isFinite(tw) && isFinite(th)) {
                me.viewBoxX = targetX;
                me.viewBoxY = targetY;
                me.zoomCoefficient = targetZoom;
                me.getPaper().setViewBox(me.viewBoxX, me.viewBoxY, tw, th);
                me.background.attr({x: me.viewBoxX, y: me.viewBoxY, width: tw, height: th});
                me.syncSliderToZoom(targetZoom);
              }
            } else {
              lastTap = {time: now, x: tap.clientX, y: tap.clientY};
            }
          }
        }
      }
    };

    this.canvas.addEventListener('touchstart', onCanvasTouchStart, {passive: false});
    window.addEventListener('touchmove', onCanvasTouchMove, {passive: false});
    window.addEventListener('touchend', onCanvasTouchEnd, {passive: false});
    window.addEventListener('touchcancel', onCanvasTouchEnd, {passive: false});

    if (document.addEventListener) {
      me.handleMouseWheel = function(evt) {
        if (evt.preventDefault) {
          evt.preventDefault();
        } else {
          evt.returnValue = false;
        }

        if (editor && editor.isAnyMenuVisible && editor.isAnyMenuVisible()) {
          return;
        }

        var delta = 0;
        if (evt.deltaY !== undefined) {
          delta = evt.deltaY;
        } else if (evt.wheelDelta !== undefined) {
          delta = -evt.wheelDelta;
        } else if (evt.detail !== undefined) {
          delta = evt.detail;
        }

        if (delta > 0) {
          me.__zoom['out'].click();
        } else if (delta < 0) {
          me.__zoom['in'].click();
        }
      };

      this.canvas.addEventListener('wheel', me.handleMouseWheel, {passive: false});
      if (navigator.userAgent.toLowerCase().indexOf('webkit') >= 0) {
        this.canvas.addEventListener('mousewheel', me.handleMouseWheel, false); // Chrome/Safari
      } else {
        this.canvas.addEventListener('DOMMouseScroll', me.handleMouseWheel, false); // Others
      }
    }
  },

  /**
     * Returns the Raphael paper object.
     *
     * @method getPaper
     * @return {Object} Raphael Paper element
     */
  getPaper: function() {
    return this._paper;
  },

  /**
     * Returns the div element containing everything except the top menu bar
     *
     * @method getWorkArea
     * @return {HTMLElement}
     */
  getWorkArea: function() {
    return this.workArea;
  },

  /**
     * Returns width of the work area
     *
     * @method getWidth
     * @return {Number}
     */
  getWidth: function() {
    return this.width;
  },

  /**
     * Returns height of the work area
     *
     * @method getHeight
     * @return {Number}
     */
  getHeight: function() {
    return this.height;
  },

  /**
     * Creates the menu on the top
     *
     * @method generateTopMenu
     */
  generateTopMenu: function() {
    var menu = new Element('div', {'id' : 'editor-menu'});

    menu.insert(new Element('a', {'class': 'title', 'href': 'https://github.com/faliwar/open-pedigree-xml'})
        .update('Open Pedigree X'));

    // Mobile-only app bar controls (hidden on desktop via CSS)
    var mobileBar = new Element('div', {'class': 'mobile-bar-actions'});
    menu.insert(mobileBar);

    // Container for all action groups: inline on desktop, dropdown sheet on mobile
    var actions = new Element('div', {'class': 'menu-actions', 'id': 'editor-menu-actions'});
    menu.insert(actions);

    this.getWorkArea().insert({before : menu});
    var submenus = [];

    if (editor.isUnsupportedBrowser()) {
      submenus = [{
        name : 'input',
        title: 'Info',
        items: [
          { key : 'readonlymessage', label : 'Unsuported browser mode', icon : 'exclamation-triangle'}
        ]
      }, {
        name : 'output',
        title: 'Output',
        items: [
          { key : 'export',    label : 'Export', icon : 'file-export'},
          { key : 'close',     label : 'Close', icon : 'times'}
        ]
      }];
    } else {
      submenus = [];
      
      if (DriveBackend.isAppScriptEnvironment() || (typeof window !== 'undefined' && window.location && window.location.search && window.location.search.indexOf('drive=1') !== -1)) {
        submenus.push({
          name : 'drive',
          title: 'Google Drive',
          items: [
            { key : 'open-drive', label : 'Open XML', icon : 'folder-open'},
            { key : 'save-drive', label : 'Save XML', icon : 'save'},
            { key : 'rename-drive', label : 'Rename XML', icon : 'edit'}
          ]
        });
      }

      submenus = submenus.concat([{
        name : 'input',
        title: 'Load',
        items: [
          { key : 'templates', label : 'Templates', icon : 'copy'},
          { key : 'import',    label : 'Import', icon : 'file-import'}
        ]
      }, {
        name : 'edit',
        title: 'Edit',
        items: [
          { key : 'undo',     label : 'Undo', icon : 'undo'},
          { key : 'redo',     label : 'Redo', icon : 'redo'},
          { key : 'relayout', label : 'Re-layout', icon : 'sitemap'},
            { key : 'labels',   label : 'Labels',     icon : 'tags'}
        ]
      }, {
        name : 'reset',
        title: 'Reset',
        items: [
          { key : 'clear',  label : 'Clear all', icon : 'times-circle'}
        ]
      }, {
        name : 'output',
        title: 'Output',
        items: [
          { key : 'export',    label : 'Export', icon : 'file-export'},
          { key : 'close',     label : 'Close', icon : 'times'}
        ]
      }]);
    }
    var _createSubmenu = function(data) {
      var submenu = new Element('div', {'class' : data.name + '-actions action-group', 'data-title' : data.title || ''});
      actions.insert(submenu);
      data.items.each(function (item) {
        submenu.insert(_createMenuItem(item));
      });
    };
    var _createMenuItem = function(data) {
      var mi = new Element('span', {'id' : 'action-' + data.key, 'class' : 'menu-item ' + data.key}).insert(new Element('span', {'class' : 'fa fa-' + data.icon})).insert(' ').insert(data.label);
      if (data.callback && typeof(this[data.callback]) == 'function') {
        mi.observe('click', function() {
          this[data.callback]();
        });
      }
      return mi;
    };
    submenus.each(_createSubmenu);

    actions.insert(new Element('div', {'class': 'powered-by'})
      .insert('Powered by ')
      .insert(new Element('a', {'href': 'https://phenotips.com/'})
        .update('PhenoTips')
        .insert(new Element('sup').update('&reg;'))));

    this._setupMobileMenu(menu, mobileBar, actions);
  },

  /**
   * Adds the compact mobile app bar behaviour: quick Undo/Redo shortcuts and a
   * hamburger toggle that shows all actions in a dropdown sheet over the canvas.
   * Shortcuts proxy clicks to the original menu items so all handlers stay in one place.
   *
   * @method _setupMobileMenu
   */
  _setupMobileMenu: function(menu, mobileBar, actions) {
    var _createBarButton = function(cls, icon, title) {
      var btn = new Element('button', {'type': 'button', 'class': 'mobile-bar-button ' + cls, 'title': title, 'aria-label': title});
      btn.insert(new Element('span', {'class': 'fa fa-fw fa-' + icon}));
      mobileBar.insert(btn);
      return btn;
    };

    ['undo', 'redo'].each(function(key) {
      var original = $('action-' + key);
      if (!original) {
        return;
      }
      menu.addClassName('has-quick-' + key);
      var quick = _createBarButton('quick-' + key, key, key.charAt(0).toUpperCase() + key.slice(1));
      quick.observe('click', function(e) {
        e.stop();
        original.click();
      });
    });

    var toggle = new Element('button', {'type': 'button', 'class': 'mobile-bar-button menu-toggle', 'title': 'Menu', 'aria-label': 'Menu'});
    toggle.insert(new Element('span', {'class': 'fa fa-fw fa-bars icon-open'}));
    toggle.insert(new Element('span', {'class': 'fa fa-fw fa-times icon-close'}));
    toggle.writeAttribute({'aria-expanded': 'false', 'aria-controls': 'editor-menu-actions'});
    mobileBar.insert(toggle);

    try {
      if (window.FontAwesome && window.FontAwesome.dom && typeof window.FontAwesome.dom.i2svg === 'function') {
        window.FontAwesome.dom.i2svg({node: mobileBar});
      }
    } catch (e) {}

    var backdrop = new Element('div', {'class': 'mobile-menu-backdrop'});
    menu.insert(backdrop);

    var setOpen = function(open) {
      if (open) {
        menu.addClassName('mobile-open');
      } else {
        menu.removeClassName('mobile-open');
      }
      toggle.writeAttribute('aria-expanded', open ? 'true' : 'false');
    };
    this.closeMobileMenu = function() {
      setOpen(false);
    };

    toggle.observe('click', function(e) {
      e.stop();
      setOpen(!menu.hasClassName('mobile-open'));
    });
    backdrop.observe('click', function(e) {
      e.stop();
      setOpen(false);
    });
    // Close after an action was chosen (the item's own handler still runs)
    actions.observe('click', function(e) {
      if (e.findElement('.menu-item')) {
        setOpen(false);
      }
    });
    document.observe('keydown', function(e) {
      if (e.keyCode === 27 && menu.hasClassName('mobile-open')) {
        setOpen(false);
      }
    });
    Event.observe(window, 'resize', function() {
      // e.g. orientation change or switching to the desktop layout
      if (menu.hasClassName('mobile-open') && toggle.offsetParent === null) {
        setOpen(false);
      }
    });
  },

  /**
   * Converts zoom coefficient to slider value ratio [0, 1]
   */
  /**
   * Converts zoom coefficient to slider value ratio [0, 1]
   */
  zoomToSliderValue: function(zoom) {
    if (typeof zoom !== 'number' || !isFinite(zoom) || zoom <= 0) {
      zoom = 1;
    }
    if (zoom >= 0.25) {
      return Math.max(0, Math.min(0.9, (1.25 - zoom) * 0.9));
    } else {
      return Math.max(0.9, Math.min(1.0, 1.15 - zoom));
    }
  },

  /**
   * Converts slider value ratio [0, 1] to zoom coefficient
   */
  sliderValueToZoom: function(val) {
    if (typeof val !== 'number' || !isFinite(val)) {
      return 1;
    }
    var zoom;
    if (val <= 0.9) {
      zoom = 1.25 - (val / 0.9);
    } else {
      zoom = 1.15 - val;
    }
    if (!isFinite(zoom)) {
      return 1;
    }
    return Math.min(1.25, Math.max(0.15, zoom));
  },

  /**
   * Synchronizes the slider handle position and internal value with the given zoom
   */
  syncSliderToZoom: function(zoom) {
    var ratio = this.zoomToSliderValue(zoom);
    this.syncSliderHandlePosition(ratio);
    if (this.zoomSlider) {
      this.zoomSlider.value = ratio;
      this.zoomSlider.values = [ratio];
    }
  },

  /**
   * Sets the slider handle top position based on value ratio [0, 1]
   */
  syncSliderHandlePosition: function(ratio) {
    if (this.__zoom && this.__zoom.handle && this.__zoom.track) {
      var trackH = this.__zoom.track.offsetHeight || 200;
      var handleH = this.__zoom.handle.offsetHeight || 12;
      var topPx = Math.round(ratio * (trackH - handleH));
      this.__zoom.handle.style.top = topPx + 'px';
    }
  },

  /**
   * Adjusts the canvas viewbox to the given zoom coefficient
   *
   * @method zoom
   * @param {Number} zoomCoefficient The zooming ratio
   * @param {Boolean} skipSliderSync Optional flag to skip updating slider handle
   */
  zoom: function(zoomCoefficient, skipSliderSync) {
    if (typeof zoomCoefficient !== 'number' || !isFinite(zoomCoefficient) || zoomCoefficient <= 0) {
      zoomCoefficient = (typeof this.zoomCoefficient === 'number' && isFinite(this.zoomCoefficient) && this.zoomCoefficient > 0) ? this.zoomCoefficient : 1;
    }
    if (zoomCoefficient < 0.15) {
      zoomCoefficient = 0.15;
    }
    if (zoomCoefficient > 1.25) {
      zoomCoefficient = 1.25;
    }
    zoomCoefficient = Math.round(zoomCoefficient * 100) / 100;
    var w = Math.max(100, isFinite(this.width) ? this.width : 800);
    var h = Math.max(100, isFinite(this.height) ? this.height : 600);
    var currentZoom = (typeof this.zoomCoefficient === 'number' && isFinite(this.zoomCoefficient) && this.zoomCoefficient > 0) ? this.zoomCoefficient : 1;
    var newWidth  = Math.max(10, w / zoomCoefficient);
    var newHeight = Math.max(10, h / zoomCoefficient);

    // Self-healing: if viewBoxX or viewBoxY were ever corrupted to NaN, restore to 0
    if (!isFinite(this.viewBoxX)) {
      this.viewBoxX = 0;
    }
    if (!isFinite(this.viewBoxY)) {
      this.viewBoxY = 0;
    }

    var newX = this.viewBoxX + (w / currentZoom - newWidth) / 2;
    var newY = this.viewBoxY + (h / currentZoom - newHeight) / 2;

    this.viewBoxX = isFinite(newX) ? newX : 0;
    this.viewBoxY = isFinite(newY) ? newY : 0;
    this.zoomCoefficient = zoomCoefficient;

    this.getPaper().setViewBox(this.viewBoxX, this.viewBoxY, newWidth, newHeight);
    if (this.background) {
      this.background.attr({x: this.viewBoxX, y: this.viewBoxY, width: newWidth, height: newHeight});
    }
    if (!skipSliderSync) {
      this.syncSliderToZoom(zoomCoefficient);
    }
  },

  /**
   * Creates the controls for panning and zooming
   *
   * @method generateViewControls
   */
  generateViewControls : function() {
    var _this = this;
    this.__controls = new Element('div', {'class' : 'view-controls'});

    // Pan controls
    this.__pan = new Element('div', {'class' : 'view-controls-pan', title : 'Pan'});
    this.__controls.insert(this.__pan);

    var triggerPanAction = function(direction, evt) {
      if (evt) {
        evt.preventDefault && evt.preventDefault();
        evt.stopPropagation && evt.stopPropagation();
        if (evt.stop) evt.stop();
      }
      if (direction === 'home') {
        _this.centerAroundNode();
      } else if (direction === 'up') {
        _this.panTo(_this.viewBoxX, _this.viewBoxY - 300);
      } else if (direction === 'down') {
        _this.panTo(_this.viewBoxX, _this.viewBoxY + 300);
      } else if (direction === 'left') {
        _this.panTo(_this.viewBoxX - 300, _this.viewBoxY);
      } else if (direction === 'right') {
        _this.panTo(_this.viewBoxX + 300, _this.viewBoxY);
      }
    };

    ['up', 'right', 'down', 'left', 'home'].each(function (direction) {
      var faIconClass = (direction == 'home') ? 'fa-user' : 'fa-arrow-' + direction;
      _this.__pan[direction] = new Element('span', {
        'class' : 'view-control-pan pan-' + direction,
        'title' : (direction == 'home' ? 'Center on proband' : 'Pan ' + direction)
      });
      _this.__pan[direction].insert(new Element('i', {'class' : 'fa fa-fw ' + faIconClass}));
      _this.__pan.insert(_this.__pan[direction]);

      var lastDirTouchTime = 0;
      _this.__pan[direction].addEventListener('touchend', function(e) {
        lastDirTouchTime = Date.now();
        triggerPanAction(direction, e);
      }, {passive: false});
      _this.__pan[direction].addEventListener('click', function(e) {
        if (Date.now() - lastDirTouchTime < 400) return;
        triggerPanAction(direction, e);
      });
    });

    // Circular widget container handler (supports clicking anywhere in quadrants or center)
    var lastPanTouchTime = 0;
    var handlePanInput = function(e) {
      if (e) {
        e.preventDefault && e.preventDefault();
        e.stopPropagation && e.stopPropagation();
        if (e.stop) e.stop();
      }

      var target = e.target;
      while (target && target !== _this.__pan && !(target.classList && target.classList.contains('view-control-pan'))) {
        target = target.parentNode;
      }
      if (target && target.classList && target.classList.contains('view-control-pan')) {
        var foundDir = null;
        ['up', 'right', 'down', 'left', 'home'].each(function(dir) {
          if (target.classList.contains('pan-' + dir)) {
            foundDir = dir;
          }
        });
        if (foundDir) {
          triggerPanAction(foundDir, e);
          return;
        }
      }

      // Check coordinates relative to center of circle
      var rect = _this.__pan.getBoundingClientRect();
      var clientX = e.clientX;
      var clientY = e.clientY;
      if (e.changedTouches && e.changedTouches.length > 0) {
        clientX = e.changedTouches[0].clientX;
        clientY = e.changedTouches[0].clientY;
      } else if (e.touches && e.touches.length > 0) {
        clientX = e.touches[0].clientX;
        clientY = e.touches[0].clientY;
      }
      if (clientX !== undefined && clientY !== undefined) {
        var relX = clientX - (rect.left + rect.width / 2);
        var relY = clientY - (rect.top + rect.height / 2);
        var dist = Math.hypot(relX, relY);
        if (dist <= 15) {
          triggerPanAction('home', e);
        } else if (Math.abs(relX) > Math.abs(relY)) {
          triggerPanAction(relX > 0 ? 'right' : 'left', e);
        } else {
          triggerPanAction(relY > 0 ? 'down' : 'up', e);
        }
      }
    };

    this.__pan.addEventListener('touchstart', function(e) {
      e.stopPropagation();
      e.preventDefault();
    }, {passive: false});

    this.__pan.addEventListener('touchend', function(e) {
      lastPanTouchTime = Date.now();
      handlePanInput(e);
    }, {passive: false});

    this.__pan.addEventListener('click', function(e) {
      if (Date.now() - lastPanTouchTime < 400) return;
      handlePanInput(e);
    });

    // Zoom controls
    var trackLength = 200;
    this.__zoom = new Element('div', {'class' : 'view-controls-zoom', title : 'Zoom'});
    this.__controls.insert(this.__zoom);
    this.__zoom.track  = new Element('div', {'class' : 'zoom-track'});
    this.__zoom.handle = new Element('div', {'class' : 'zoom-handle', title : 'Drag to zoom'});
    this.__zoom['in']  = new Element('div', {'class' : 'zoom-button zoom-in', title : 'Zoom in'});
    this.__zoom['in'].insert(new Element('i', {'class' : 'fa fa-fw fa-search-plus'}));
    this.__zoom['out'] = new Element('div', {'class' : 'zoom-button zoom-out', title : 'Zoom out'});
    this.__zoom['out'].insert(new Element('i', {'class' : 'fa fa-fw fa-search-minus'}));
    this.__zoom.label  = new Element('div', {'class' : 'zoom-crt-value'});

    this.__zoom.insert(this.__zoom['in']);
    this.__zoom.insert(this.__zoom.track);
    this.__zoom.track.insert(this.__zoom.handle);
    this.__zoom.track.style.height = trackLength + 'px';
    this.__zoom.insert(this.__zoom['out']);
    this.__zoom.insert(this.__zoom.label);

    // Scriptaculous slider for desktop mouse dragging
    this.zoomSlider = new Control.Slider(this.__zoom.handle, this.__zoom.track, {
      axis:'vertical',
      minimum: 0,
      maximum: trackLength,
      increment : 1,
      alignY: 6,
      onSlide : function (value) {
        _this.zoom(_this.sliderValueToZoom(value), true);
      },
      onChange : function (value) {
        _this.zoom(_this.sliderValueToZoom(value), true);
      }
    });

    if (editor && editor.isUnsupportedBrowser && editor.isUnsupportedBrowser()) {
      this.zoomSlider.setValue(0.25 * 0.9);
    } else {
      this.zoomSlider.setValue(0.5 * 0.9);
    }

    // Step zoom helper for + and - buttons
    var lastZoomTouchTime = 0;
    var stepZoom = function(delta, evt) {
      if (evt) {
        evt.preventDefault && evt.preventDefault();
        evt.stopPropagation && evt.stopPropagation();
        if (evt.stop) evt.stop();
      }
      var curZoom = _this.zoomCoefficient || 1;
      var newZoom = Math.min(1.25, Math.max(0.15, Math.round((curZoom + delta) * 100) / 100));
      if (Math.abs(newZoom - curZoom) > 0.001) {
        _this.zoom(newZoom);
      }
    };

    this.__zoom['in'].addEventListener('touchstart', function(e) {
      e.stopPropagation();
      e.preventDefault();
    }, {passive: false});

    this.__zoom['in'].addEventListener('touchend', function(e) {
      lastZoomTouchTime = Date.now();
      stepZoom(+0.15, e);
    }, {passive: false});

    this.__zoom['in'].addEventListener('click', function(e) {
      if (Date.now() - lastZoomTouchTime < 400) return;
      stepZoom(+0.15, e);
    });

    this.__zoom['out'].addEventListener('touchstart', function(e) {
      e.stopPropagation();
      e.preventDefault();
    }, {passive: false});

    this.__zoom['out'].addEventListener('touchend', function(e) {
      lastZoomTouchTime = Date.now();
      stepZoom(-0.15, e);
    }, {passive: false});

    this.__zoom['out'].addEventListener('click', function(e) {
      if (Date.now() - lastZoomTouchTime < 400) return;
      stepZoom(-0.15, e);
    });

    // Touch support for slider track and handle (mobile touch dragging & tapping)
    var isDraggingSlider = false;
    var updateSliderFromTouch = function(e) {
      var touch = (e.touches && e.touches[0]) || (e.changedTouches && e.changedTouches[0]);
      if (!touch) return;
      var trackRect = _this.__zoom.track.getBoundingClientRect();
      var trackH = trackRect.height || 200;
      var offsetY = touch.clientY - trackRect.top;
      var ratio = Math.max(0, Math.min(1, offsetY / trackH));
      var targetZoom = _this.sliderValueToZoom(ratio);
      _this.zoom(targetZoom, true);
      _this.syncSliderHandlePosition(ratio);
      if (_this.zoomSlider) {
        _this.zoomSlider.value = ratio;
        _this.zoomSlider.values = [ratio];
      }
    };

    var onSliderTouchStart = function(e) {
      e.preventDefault();
      e.stopPropagation();
      isDraggingSlider = true;
      updateSliderFromTouch(e);
      window.addEventListener('touchmove', onWindowSliderTouchMove, {passive: false});
      window.addEventListener('touchend', onWindowSliderTouchEnd, {passive: false});
      window.addEventListener('touchcancel', onWindowSliderTouchEnd, {passive: false});
    };

    var onWindowSliderTouchMove = function(e) {
      if (!isDraggingSlider) return;
      e.preventDefault();
      e.stopPropagation();
      updateSliderFromTouch(e);
    };

    var onWindowSliderTouchEnd = function(e) {
      if (!isDraggingSlider) return;
      e.preventDefault();
      e.stopPropagation();
      isDraggingSlider = false;
      updateSliderFromTouch(e);
      window.removeEventListener('touchmove', onWindowSliderTouchMove);
      window.removeEventListener('touchend', onWindowSliderTouchEnd);
      window.removeEventListener('touchcancel', onWindowSliderTouchEnd);
    };

    this.__zoom.track.addEventListener('touchstart', onSliderTouchStart, {passive: false});
    this.__zoom.handle.addEventListener('touchstart', onSliderTouchStart, {passive: false});

    // Insert all controls in the document
    this.getWorkArea().insert(this.__controls);
  },

  /* To work around a bug in Raphael or Raphaelzpd (?) which creates differently sized lines
     * @ different zoom levels given the same "stroke-width" in pixels this function computes
     * the pixel size to be used at this zoom level to create a line of the correct size.
     *
     * Returns the pixel value to be used in stoke-width
     */
  getSizeNormalizedToDefaultZoom: function(pixelSizeAtDefaultZoom) {
    return pixelSizeAtDefaultZoom;
  },

  /**
     * Returns the current zoom level (not normalized to any value, larger numbers mean deeper zoom-in)
     */
  getCurrentZoomLevel: function(pixelSizeAtDefaultZoom) {
    return this.zoomCoefficient;
  },

  /**
     * Converts the coordinates relative to the Raphael canvas to coordinates relative to the canvas div
     * and returns them
     *
     * @method canvasToDiv
     * @param {Number} canvasX The x coordinate relative to the Raphael canvas (ie with pan/zoom transformations)
     * @param {Number} canvasY The y coordinate relative to the Raphael canvas (ie with pan/zoom transformations)
     * @return {{x: number, y: number}} Object with coordinates
     */
  canvasToDiv: function(canvasX,canvasY) {
    var zoom = (typeof this.zoomCoefficient === 'number' && isFinite(this.zoomCoefficient) && this.zoomCoefficient > 0) ? this.zoomCoefficient : 1;
    var vx = isFinite(this.viewBoxX) ? this.viewBoxX : 0;
    var vy = isFinite(this.viewBoxY) ? this.viewBoxY : 0;
    return {
      x: zoom * ((isFinite(canvasX) ? canvasX : 0) - vx),
      y: zoom * ((isFinite(canvasY) ? canvasY : 0) - vy)
    };
  },

  /**
     * Converts the coordinates relative to the canvas div to coordinates relative to the Raphael canvas
     * by applying zoom/pan transformations and returns them.
     *
     * @method divToCanvas
     * @param {Number} divX The x coordinate relative to the canvas
     * @param {Number} divY The y coordinate relative to the canvas
     * @return {{x: number, y: number}} Object with coordinates
     */
  divToCanvas: function(divX,divY) {
    var zoom = (typeof this.zoomCoefficient === 'number' && isFinite(this.zoomCoefficient) && this.zoomCoefficient > 0) ? this.zoomCoefficient : 1;
    var vx = isFinite(this.viewBoxX) ? this.viewBoxX : 0;
    var vy = isFinite(this.viewBoxY) ? this.viewBoxY : 0;
    return {
      x: (isFinite(divX) ? divX : 0)/zoom + vx,
      y: (isFinite(divY) ? divY : 0)/zoom + vy
    };
  },

  /**
     * Converts the coordinates relative to the browser viewport to coordinates relative to the canvas div,
     * and returns them.
     *
     * @method viewportToDiv
     * @param {Number} absX The x coordinate relative to the viewport
     * @param {Number} absY The y coordinate relative to the viewport
     * @return {{x: number, y: number}} Object with coordinates
     */
  viewportToDiv : function (absX, absY) {
    var left = 0;
    var top = 62;
    if (this.canvas) {
      if (typeof this.canvas.getBoundingClientRect === 'function') {
        var rect = this.canvas.getBoundingClientRect();
        left = rect.left;
        top = rect.top;
      } else if (typeof this.canvas.cumulativeOffset === 'function') {
        var off = this.canvas.cumulativeOffset();
        if (off) {
          left = off.left || off[0] || 0;
          top = off.top || off[1] || 0;
        }
      }
    }
    var safeX = (typeof absX === 'number' && isFinite(absX)) ? absX : 0;
    var safeY = (typeof absY === 'number' && isFinite(absY)) ? absY : 0;
    return {
      x : safeX - left,
      y : safeY - top
    };
  },

  /**
     * Animates a transformation of the viewbox to the given coordinate
     *
     * @method panTo
     * @param {Number} x The x coordinate relative to the Raphael canvas
     * @param {Number} y The y coordinate relative to the Raphael canvas
     */
  panTo: function(x, y, instant) {
    if (!isFinite(x)) x = 0;
    if (!isFinite(y)) y = 0;
    if (!isFinite(this.viewBoxX)) this.viewBoxX = 0;
    if (!isFinite(this.viewBoxY)) this.viewBoxY = 0;

    var me = this,
      oX = this.viewBoxX,
      oY = this.viewBoxY,
      xDisplacement = x - oX,
      yDisplacement = y - oY;

    if (editor.isUnsupportedBrowser()) {
      instant = true;
    }

    var numSeconds = instant ? 0 : .4;
    var frames     = instant ? 1 : 11;

    var xStep = xDisplacement/frames,
      yStep = yDisplacement/frames;

    if (!isFinite(xStep) || !isFinite(yStep) || (xStep === 0 && yStep === 0)) {
      me.viewBoxX = x;
      me.viewBoxY = y;
      var zoom = (typeof me.zoomCoefficient === 'number' && isFinite(me.zoomCoefficient) && me.zoomCoefficient > 0) ? me.zoomCoefficient : 1;
      var w = Math.max(10, (me.width || 800) / zoom);
      var h = Math.max(10, (me.height || 600) / zoom);
      me.getPaper().setViewBox(x, y, w, h);
      me.background && me.background.attr({x: x, y: y, width: w, height: h });
      return;
    }

    var progress = 0;

    (function draw() {
      setTimeout(function() {
        if(progress++ < frames) {
          var zoom = (typeof me.zoomCoefficient === 'number' && isFinite(me.zoomCoefficient) && me.zoomCoefficient > 0) ? me.zoomCoefficient : 1;
          var w = Math.max(10, (me.width || 800) / zoom);
          var h = Math.max(10, (me.height || 600) / zoom);
          var nextX = me.viewBoxX + xStep;
          var nextY = me.viewBoxY + yStep;
          me.viewBoxX = isFinite(nextX) ? nextX : x;
          me.viewBoxY = isFinite(nextY) ? nextY : y;
          me.getPaper().setViewBox(me.viewBoxX, me.viewBoxY, w, h);
          me.background && me.background.attr({x: me.viewBoxX, y: me.viewBoxY, width: w, height: h });
          draw();
        }
      }, 1000 * numSeconds / frames);
    })();
  },

  /**
     * Animates a transformation of the viewbox by the given delta in the X direction
     *
     * @method panTo
     * @param {Number} deltaX The move size
     */
  panByX: function(deltaX, instant) {
    if (!isFinite(deltaX)) deltaX = 0;
    var zoom = (typeof this.zoomCoefficient === 'number' && isFinite(this.zoomCoefficient) && this.zoomCoefficient > 0) ? this.zoomCoefficient : 1;
    var vx = isFinite(this.viewBoxX) ? this.viewBoxX : 0;
    var vy = isFinite(this.viewBoxY) ? this.viewBoxY : 0;
    this.panTo(vx + Math.floor(deltaX/zoom), vy, instant);
  },

  /**
     * Adjusts the canvas size to the current viewport dimensions.
     *
     * @method adjustSizeToScreen
     */
  adjustSizeToScreen : function() {
    var screenDimensions = document.viewport ? document.viewport.getDimensions() : null;
    var topOffset = (this.canvas && this.canvas.cumulativeOffset) ? this.canvas.cumulativeOffset().top : 62;
    var viewportWidth = (window.innerWidth && window.innerWidth > 0) ? window.innerWidth : ((screenDimensions && screenDimensions.width > 0) ? screenDimensions.width : 800);
    var viewportHeight = (window.innerHeight && window.innerHeight > 0) ? window.innerHeight : ((screenDimensions && screenDimensions.height > 0) ? screenDimensions.height : 600);

    // If viewport dimensions are collapsed (e.g. background tab or zero height), avoid invalid SVG sizing
    if (viewportWidth <= 10 || viewportHeight <= 10) {
      return;
    }

    var calculatedHeight = viewportHeight - topOffset - 4;
    this.width = Math.max(100, viewportWidth);
    this.height = Math.max(100, calculatedHeight);

    var zoom = (typeof this.zoomCoefficient === 'number' && isFinite(this.zoomCoefficient) && this.zoomCoefficient > 0) ? this.zoomCoefficient : 1;
    var newWidth = Math.max(10, this.width / zoom);
    var newHeight = Math.max(10, this.height / zoom);

    if (!isFinite(this.viewBoxX)) this.viewBoxX = 0;
    if (!isFinite(this.viewBoxY)) this.viewBoxY = 0;

    this.getPaper().setSize(this.width, this.height);
    this.getPaper().setViewBox(this.viewBoxX, this.viewBoxY, newWidth, newHeight);
    this.background && this.background.attr({
      'x': this.viewBoxX,
      'y': this.viewBoxY,
      'width': newWidth,
      'height': newHeight
    });
    if (editor.getNodeMenu()) {
      editor.getNodeMenu().reposition();
    }
  },

  /**
     * Pans the canvas to put the node with the given id at the center.
     *
     * When (xCenterShift, yCenterShift) are given positions the node with the given shift relative
     * to the center instead of exact center of the screen
     *
     * @method centerAroundNode
     * @param {Number} nodeID The id of the node
     */
  centerAroundNode: function(nodeID, instant, xCenterShift, yCenterShift) {
    var probandId = 0;
    if (editor && editor.getGraph && typeof editor.getGraph().getProbandId === 'function') {
      probandId = editor.getGraph().getProbandId();
    }
    var targetId = (nodeID !== undefined && editor && editor.getNode && editor.getNode(nodeID)) ? nodeID : probandId;
    var node = (editor && editor.getNode) ? (editor.getNode(targetId) || editor.getNode(0)) : null;
    if(node && typeof node.getX === 'function' && typeof node.getY === 'function') {
      var x = node.getX(),
        y = node.getY();
      if (!isFinite(x) || !isFinite(y)) {
        this.panTo(0, 0, instant);
        return;
      }
      if (!xCenterShift || !isFinite(xCenterShift)) {
        xCenterShift = 0;
      }
      if (!yCenterShift || !isFinite(yCenterShift)) {
        yCenterShift = 0;
      }
      var zoom = (typeof this.zoomCoefficient === 'number' && isFinite(this.zoomCoefficient) && this.zoomCoefficient > 0) ? this.zoomCoefficient : 1;
      var xOffset = (this.getWidth() || 800) / zoom;
      var yOffset = (this.getHeight() || 600) / zoom;
      this.panTo(x - xOffset/2 - xCenterShift, y - yOffset/2 - yCenterShift, instant);
    } else {
      this.panTo(0, 0, instant);
    }
  }
});

export default Workspace;
