/**
 * modalPatch.js
 * Enhances PhenoTips and XWiki ModalPopup widgets for:
 * 1. Mobile touch responsiveness (Done / Small X touch dismissals).
 * 2. Proper vertical and horizontal centering within the viewer on Desktop.
 * 3. Robust show/hide state tracking with .hidden class to prevent display override conflicts.
 */

(function () {
  function patchWidgets() {
    // 1. Patch PhenoTips.widgets.ModalPopup
    if (window.PhenoTips && window.PhenoTips.widgets && window.PhenoTips.widgets.ModalPopup) {
      var PTProto = window.PhenoTips.widgets.ModalPopup.prototype;

      var origPTPosition = PTProto.positionDialog;
      PTProto.positionDialog = function () {
        if (origPTPosition) {
          try {
            origPTPosition.call(this);
          } catch (e) {}
        }
        if (!this.options.verticalPosition || this.options.verticalPosition === 'center') {
          var winH = window.innerHeight || document.documentElement.clientHeight || 700;
          var boxH = (this.dialogBox && (this.dialogBox.getHeight ? this.dialogBox.getHeight() : this.dialogBox.offsetHeight)) || 400;
          var topPx = Math.max(12, Math.floor((winH - boxH) / 2));
          if (this.dialogBox) {
            this.dialogBox.setStyle({
              top: topPx + 'px',
              left: '',
              right: '',
              margin: '0 auto'
            });
          }
        }
      };

      var origPTCreate = PTProto.createDialog;
      PTProto.createDialog = function (e) {
        if (origPTCreate) {
          origPTCreate.call(this, e);
        }
        if (this.dialogBox) {
          var closeBtn = this.dialogBox.down('.msdialog-close');
          if (closeBtn) {
            var _this = this;
            var onTouchClose = function (ev) {
              if (ev) {
                try { ev.stop(); } catch (err) {}
              }
              _this.closeDialog(ev);
            };
            closeBtn.observe('touchend', onTouchClose);
            closeBtn.observe('click', onTouchClose);
          }
        }
      };

      var origPTClose = PTProto.closeDialog;
      PTProto.closeDialog = function (c) {
        if (c && c.stop) {
          try { c.stop(); } catch (err) {}
        }
        if (origPTClose) {
          origPTClose.call(this, c);
        }
        if (this.dialog) {
          this.dialog.setStyle({ display: 'none' });
          this.dialog.addClassName('hidden');
        }
      };

      var origPTShow = PTProto.showDialog;
      PTProto.showDialog = function (c) {
        if (this.dialog) {
          this.dialog.removeClassName('hidden');
          this.dialog.setStyle({ display: '' });
        }
        if (origPTShow) {
          origPTShow.call(this, c);
        }
        if (this.options.resetPositionOnShow !== false) {
          this.positionDialog();
        }
      };
    }

    // 2. Patch XWiki.widgets.ModalPopup
    if (window.XWiki && window.XWiki.widgets && window.XWiki.widgets.ModalPopup) {
      var XWProto = window.XWiki.widgets.ModalPopup.prototype;

      var origXWPosition = XWProto.positionDialog;
      XWProto.positionDialog = function () {
        if (origXWPosition) {
          try {
            origXWPosition.call(this);
          } catch (e) {}
        }
        if (!this.options.verticalPosition || this.options.verticalPosition === 'center') {
          var winH = window.innerHeight || document.documentElement.clientHeight || 700;
          var boxH = (this.dialogBox && (this.dialogBox.getHeight ? this.dialogBox.getHeight() : this.dialogBox.offsetHeight)) || 400;
          var topPx = Math.max(12, Math.floor((winH - boxH) / 2));
          if (this.dialogBox) {
            this.dialogBox.setStyle({
              top: topPx + 'px',
              left: '',
              right: '',
              margin: '0 auto'
            });
          }
        }
      };

      var origXWCreate = XWProto.createDialog;
      XWProto.createDialog = function (e) {
        if (origXWCreate) {
          origXWCreate.call(this, e);
        }
        if (this.dialogBox) {
          var closeBtn = this.dialogBox.down('.xdialog-close');
          if (closeBtn) {
            var _this = this;
            var onTouchClose = function (ev) {
              if (ev) {
                try { ev.stop(); } catch (err) {}
              }
              _this.closeDialog(ev);
            };
            closeBtn.observe('touchend', onTouchClose);
            closeBtn.observe('click', onTouchClose);
          }
        }
      };

      var origXWClose = XWProto.closeDialog;
      XWProto.closeDialog = function (c) {
        if (c && c.stop) {
          try { c.stop(); } catch (err) {}
        }
        if (origXWClose) {
          origXWClose.call(this, c);
        }
        if (this.dialog) {
          this.dialog.setStyle({ display: 'none' });
          this.dialog.addClassName('hidden');
        }
      };

      var origXWShow = XWProto.showDialog;
      XWProto.showDialog = function (c) {
        if (this.dialog) {
          this.dialog.removeClassName('hidden');
          this.dialog.setStyle({ display: '' });
        }
        if (origXWShow) {
          origXWShow.call(this, c);
        }
        if (this.options.resetPositionOnShow !== false) {
          this.positionDialog();
        }
      };
    }
  }

  // Execute patch immediately or on dom loaded
  if (window.PhenoTips && window.PhenoTips.widgets && window.PhenoTips.widgets.ModalPopup) {
    patchWidgets();
  } else if (document.observe) {
    document.observe('dom:loaded', patchWidgets);
  }

  // Global fallback observer for touch / click on modal close buttons
  if (typeof document !== 'undefined' && document.observe) {
    document.observe('touchend', function (e) {
      var closeBtn = e.findElement && e.findElement('.msdialog-close, .xdialog-close');
      if (closeBtn) {
        try {
          e.stop();
        } catch (err) {}
        closeBtn.click();
      }
    });
  }
})();
