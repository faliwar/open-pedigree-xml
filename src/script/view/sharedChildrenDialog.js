/**
 * SharedChildrenDialog allows the user to select which children of a single parent
 * are shared (common children) when adding a partner to that parent.
 *
 * @class SharedChildrenDialog
 */

var SharedChildrenDialog = Class.create({

  initialize: function() {
    this.dialog = null;
    this._onConfirm = null;
    this._onCancel = null;
    this._confirmed = false;
  },

  /**
   * Displays the shared children selection dialog.
   *
   * @param {Object} options Configuration object:
   *   - parentID {Number} ID of the single parent
   *   - childrenIDs {Array} Array of child IDs
   *   - onConfirm {Function} Callback receiving array of selected child IDs
   *   - onCancel {Function} Callback if canceled
   */
  show: function(options) {
    var _this = this;
    this._confirmed = false;
    this._onConfirm = options.onConfirm || function() {};
    this._onCancel = options.onCancel || function() {};

    var parentID = options.parentID;
    var childrenIDs = options.childrenIDs || [];

    var mainDiv = new Element('div', { 'class': 'shared-children-dialog-content' });

    // Header explanation
    var parentNode = editor.getView().getNode(parentID);
    var parentName = '';
    if (parentNode) {
      parentName = (parentNode.getName ? parentNode.getName() : (parentNode.getFirstName() + ' ' + parentNode.getLastName())).trim();
      if (!parentName) {
        parentName = 'Individual ' + parentID;
      }
    } else {
      parentName = 'Parent ' + parentID;
    }

    var headerDiv = new Element('div', { 'class': 'shared-children-header' });
    var headerTitle = new Element('p', { 'class': 'shared-children-intro' }).update(
      '<strong>' + parentName + '</strong> has multiple children. Please select which children are shared with this partner:'
    );
    headerDiv.insert(headerTitle);
    mainDiv.insert(headerDiv);

    // Toolbar with Select All / Deselect All
    var toolbar = new Element('div', { 'class': 'shared-children-toolbar' });
    var selectAllBtn = new Element('button', { type: 'button', 'class': 'shared-children-link-btn' }).update('Select All');
    var deselectAllBtn = new Element('button', { type: 'button', 'class': 'shared-children-link-btn' }).update('Deselect All');
    var countSpan = new Element('span', { 'class': 'shared-children-count' }).update(childrenIDs.length + ' children');

    toolbar.insert(selectAllBtn);
    toolbar.insert(new Element('span', { 'class': 'shared-children-sep' }).update('|'));
    toolbar.insert(deselectAllBtn);
    toolbar.insert(countSpan);
    mainDiv.insert(toolbar);

    // List of children
    var listContainer = new Element('div', { 'class': 'shared-children-list' });

    for (var i = 0; i < childrenIDs.length; i++) {
      var childID = childrenIDs[i];
      var childNode = editor.getView().getNode(childID);
      var gender = 'U';
      var childLabel = 'Individual ' + childID;
      var ageText = '';

      if (childNode) {
        gender = childNode.getGender();
        var name = (childNode.getName ? childNode.getName() : (childNode.getFirstName() + ' ' + childNode.getLastName())).trim();
        if (name) {
          childLabel = name + ' (ID: ' + childID + ')';
        }
        var age = childNode.getAgeInput ? childNode.getAgeInput() : '';
        if (age) {
          ageText = 'Age: ' + age;
        }
      }

      var row = new Element('div', { 'class': 'shared-child-row', 'data-child-id': childID });
      var checkbox = new Element('input', {
        type: 'checkbox',
        value: childID,
        checked: 'checked',
        'class': 'shared-child-checkbox',
        id: 'shared_child_' + childID
      });

      var iconSpan = new Element('span', { 'class': 'shared-child-icon gender-' + gender.toLowerCase() });
      if (gender == 'M') {
        iconSpan.update('&#9632; <span class="gender-label">Male</span>'); // square
      } else if (gender == 'F') {
        iconSpan.update('&#9679; <span class="gender-label">Female</span>'); // circle
      } else {
        iconSpan.update('&#9670; <span class="gender-label">Unknown</span>'); // diamond
      }

      var infoSpan = new Element('span', { 'class': 'shared-child-info' });
      infoSpan.insert(new Element('span', { 'class': 'shared-child-name' }).update(childLabel));
      if (ageText) {
        infoSpan.insert(new Element('span', { 'class': 'shared-child-meta' }).update(' &bull; ' + ageText));
      }

      row.insert(checkbox);
      row.insert(iconSpan);
      row.insert(infoSpan);

      // Clicking row toggles checkbox
      (function(cb, r) {
        r.observe('click', function(ev) {
          if (ev.target === cb) {
            r.toggleClassName('selected', cb.checked);
          } else {
            cb.checked = !cb.checked;
            r.toggleClassName('selected', cb.checked);
          }
        });
        cb.observe('change', function() {
          r.toggleClassName('selected', cb.checked);
        });
        r.addClassName('selected');
      })(checkbox, row);

      listContainer.insert(row);
    }

    mainDiv.insert(listContainer);

    // Toolbar events
    selectAllBtn.observe('click', function() {
      listContainer.select('.shared-child-checkbox').each(function(cb) {
        cb.checked = true;
        cb.up('.shared-child-row').addClassName('selected');
      });
    });

    deselectAllBtn.observe('click', function() {
      listContainer.select('.shared-child-checkbox').each(function(cb) {
        cb.checked = false;
        cb.up('.shared-child-row').removeClassName('selected');
      });
    });

    // Buttons
    var buttons = new Element('div', { 'class': 'buttons shared-children-buttons' });
    var confirmBtn = new Element('input', {
      type: 'button',
      value: 'Confirm',
      'class': 'button shared-children-confirm-btn'
    });
    var cancelBtn = new Element('input', {
      type: 'button',
      value: 'Cancel',
      'class': 'button secondary shared-children-cancel-btn'
    });

    buttons.insert(new Element('span', { 'class': 'buttonwrapper' }).insert(confirmBtn));
    buttons.insert(new Element('span', { 'class': 'buttonwrapper' }).insert(cancelBtn));
    mainDiv.insert(buttons);

    var onConfirm = function(ev) {
      if (ev) {
        try { ev.stop(); } catch (err) {}
      }
      var selected = [];
      listContainer.select('.shared-child-checkbox').each(function(cb) {
        if (cb.checked) {
          selected.push(parseInt(cb.value, 10));
        }
      });
      _this._confirmed = true;
      _this.hide();
      _this._onConfirm(selected);
    };
    confirmBtn.observe('click', onConfirm);
    confirmBtn.observe('touchend', onConfirm);

    var onCancel = function(ev) {
      if (ev) {
        try { ev.stop(); } catch (err) {}
      }
      _this.hide();
    };
    cancelBtn.observe('click', onCancel);
    cancelBtn.observe('touchend', onCancel);

    var closeShortcut = ['Esc'];
    this.dialog = new PhenoTips.widgets.ModalPopup(
      mainDiv,
      {
        close: {
          method: function() {
            _this._handleCancel();
          },
          keys: closeShortcut
        }
      },
      {
        extraClassName: 'shared-children-modal-box',
        title: 'Choose Common Children',
        displayCloseButton: true,
        removeOnClose: true
      }
    );

    this.dialog.show();
  },

  _handleCancel: function() {
    this.hide();
  },

  hide: function() {
    if (this.dialog) {
      var wasConfirmed = this._confirmed;
      this.dialog.closeDialog();
      this.dialog = null;
      if (!wasConfirmed && typeof this._onCancel === 'function') {
        this._onCancel();
      }
    }
  }
});

export default SharedChildrenDialog;
