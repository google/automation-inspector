/**
 * @license
 * Copyright 2017 Google Inc. All rights reserved.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

/**
  * Base class for a view tree on the client, extended by
  * NodeTree, EventTree and PropsTree
  */

// Qs:
//   - Why isn't source=user happening for every click event
//--
//   - DCHECK failing in ax_enums.cc at end of ToString(AXState)
//   - Automation docs:
//   - textChanged event, why both event and treeChange?
//   - treeChanged event, how is this different from other tree changes?
//      - findAll syntax does not work as it is not valid JS:
//       { StateType.disabled: false }
//      - Some methods use callbacks -- should be documented
//   - Cannot find sub-objects with find/findAll, e.g. htmlAttributes ala:
//     tree.rootNode.findAll({ attributes: {"htmlAttributes": {"id": "foo"}}})

/* exported Tree  */

class Tree {

  constructor() {
    this.DEFAULT_TREE_OPTIONS = {
      // Get config options at http://wwwendt.de/tech/fancytree/demo/sample-configurator.html
      activeVisible: true, // Make sure, active nodes are visible (expanded)
      aria: true, // Enable WAI-ARIA support
      autoActivate: true, // Automatically activate a node when it is focused using keyboard
      autoCollapse: false, // Automatically collapse all siblings, when a node is expanded
      autoScroll: true, // Automatically scroll nodes into visible area
      clickFolderMode: 4, // 1:activate, 2:expand, 3:activate and expand, 4:activate (dblclick expands)
      checkbox: false, // Show checkboxes
      debugLevel: 1, // 0:quiet, 1:normal, 2:debug
      disabled: false, // Disable control
      filter: {
        autoApply: false,   // Overridden by specific implementation
        autoExpand: true, // Expand all branches that contain matches while filtered
        counter: false,     // Show a badge with number of matching child nodes near parent icons
        fuzzy: false,      // Match single characters in order, e.g. 'fb' will match 'FooBar'
        hideExpandedCounter: true,  // Hide counter badge if parent is expanded
        hideExpanders: false,       // Hide expanders if all child nodes are hidden by filter
        highlight: false,   // Highlight matches by wrapping inside <mark> tags
        leavesOnly: false, // Match end nodes only
        nodata: true,      // Display a 'no data' status node if result is empty
        mode: 'hide'      // Grayout unmatched nodes (pass "hide" to remove unmatched node instead)
      },
      focusOnSelect: false, // Set focus when node is checked by a mouse click
      escapeTitles: false, // Escape `node.title` content for display
      generateIds: true, // Generate id attributes like <span id='fancytree-id-KEY'>
      icon: false, // Display node icons
      keyboard: true, // Support keyboard navigation
      keyPathSeparator: '/', // Used by node.getKeyPath() and tree.loadKeyPath()
      minExpandLevel: 1, // 1: root node is not collapsible
      quicksearch: false, // Navigate to next node by typing the first letters
      rtl: false, // Enable RTL (right-to-left) mode
      selectMode: 2, // 1:single, 2:multi, 3:multi-hier
      tabindex: '0', // Whole tree behaves as one single control
      titlesTabbable: false, // Node titles can receive keyboard focus
      tooltip: false, // Use title as tooltip (also a callback could be specified)
      focusTree: (event, data) => {
        const tree = data.tree;
        if (!tree.getFocusNode()) {
          const firstVisible = tree.rootNode.getFirstChild();
          if (firstVisible) {
            firstVisible.setActive();
          }
        }
      }
    };

    const onDocumentReady = () => {
      window.client.getRootAutomationNode()
      .then((rootNode) => this.init(rootNode));
    };

    $(document).ready(onDocumentReady);
  }

  onResize() {
    const fieldsetHeight = this.$container.parent('fieldset').height();
    const containerTop = this.$container.position().top;
    const desiredHeight = fieldsetHeight - containerTop;
    this.$container.css('max-height', desiredHeight + 'px');
    this.$container.find('>.fancytree-container').css('max-height', desiredHeight + 'px');
  }

  finalize($container, treeOptions) {
    this.$container = $container;

    // Prepare size and handle window resizing
    this.onResize($container);
    $(window).on('resize', () => { this.onResize(); });

    // Create and cache Fancytree
    this.tree = $container
      .fancytree(treeOptions)
      .fancytree('getTree');
  }

  static getStateText(state) {
    return state.join(' ');
  }

  static formatStateForTreeGrid(state) {
    return Tree.getStateText(state);
  }

  // TODO Remove if we decide only to use treegrid
  static formatStateForTree(state) {
    return '<span class="state">'
      + state.join('</span> <span class="state">')
      + '</span>';
  }

  // This is the invisible root node of the tree widget implementation,
  // currently implemented by FancyTree
  getViewRootNode() {
    return this.tree && this.tree.rootNode;
  }

  filter(filterFn, opts) {
    this.filterFn = filterFn;
    return this.tree.filterNodes(filterFn, opts);
  }

  clearFilter() {
    this.filterFn = null;
    this.tree.clearFilter();
  }

  getRowElement(key) {
    return document.getElementById(this.ID_PREFIX + key);
  }

  getViewNodeByKey(key, startNode) {
    // Ensure string key as this is how fancytree stores it
    return this.tree.getNodeByKey('' + key, startNode);
  }

  clearAll() {
    this.tree.clear();
  }

  enableUpdate(doEnable) {
    this.tree.enableUpdate(doEnable);
  }
}

