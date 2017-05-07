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

/*global Tree*/

// The tree of automation nodes, utilizing lazy loading for better performatnce

class NodeTree extends Tree {
  init(rootAutomationNode) {
    this.ID_PREFIX = 'nd_';
    this.ERROR_NO_DATA = 'Error: no data';

    const EXTENSIONS = ['filter', 'table', 'ariagrid'];
    const CONTAINER_ID = '#node-treegrid';
    const $container = $(CONTAINER_ID);
    const treeOptions = $.extend(this.DEFAULT_TREE_OPTIONS, {
      idPrefix: this.ID_PREFIX,
      extensions: EXTENSIONS, // Column view makes things easier to read
      ariagrid: {
        cellFocus: 'allow', // Can also be start or force
        extendedMode: false,
        label: 'Node tree'
      },      
      source: [ rootAutomationNode ].map((node) => this.toTreeData(node) ),
      lazyLoad: (event, data) => {
        const node = data.node;
        // Issue an ajax request to load child nodes
        const params = {
          type: 'getRelated',
          key: parseInt(node.key),
          relation: 'children'
        };
        data.result = window.client.sendMessage(params)
          .then((response) =>
            response.nodes.map((node) => this.toTreeData(node), this)
          );
      },
      // Use only in treegrid mode
      renderColumns: (event, data) => {
        const node = data.node,
          $tdList = $(node.tr).find('>td'),
          automationData = node.data.automationData;

        // (Column #0 is rendered by fancytree adding the title)

        // Column 1: state
        $tdList.eq(1)
          .text(Tree.formatStateForTreeGrid(automationData.state));

        // Column 2: name
        const name = automationData.name;
        if (typeof name === 'undefined') {
          // Will show difference between no name and ''
          $tdList.eq(2)
            .text('')
            .addClass('name-undefined');
        }
        else {
          $tdList.eq(2)
            .text(name);
        }
      },
      activate: (event, data) => {
        const node = data.node,
          automationData = node.data.automationData;

        if (automationData) {
          const automationNodeKey = automationData.key;

          // Highlight events that occurred on this node
          window.eventTree.selectAllEventsForAutomationNode(automationNodeKey);

          // Show properties for the current node
          window.propsTree.showProps(automationData);
        }
      }
    });

    // Do not automatically re-apply last filter if lazy data is loaded.
    // We will do this on a timer for performance reasons, as trees are
    // potentially huge and there are constant changes. When a text filter is
    // applied we load the entire tree a little bit at a time.
    treeOptions.filter.autoApply = false;

    this.finalize($container, treeOptions);

    this.nodeFilter = new NodeFilter();
  }

  formatTitleForTreeGrid(node) {
    return node ? node.role : this.ERROR_NO_DATA;
  }

  // Optional cell num to flash individual cell, otherwise flashes entire row
  highlight(key, cellNum, fadeMs) {
    const row = this.getRowElement(key),
      $target = cellNum >= 0 ? $(row).children('td').eq(cellNum) : $(row);

    $target.addClass('highlight');
    if (fadeMs) {
      setTimeout(() => {
        $target.removeClass('highlight');
      }, fadeMs);
    }
  }

  clearHighlights() {
    this.$container.find('.highlight').removeClass('highlight');
  }

  // Highlight areas that changed when a treeChange occurred
  highlightNodeDiff(automationNode, nodeDiff, doHighlightProps, fadeMs) {
    if (!nodeDiff) {
      return; // Nothing to highlight
    }
    const nodeKey = automationNode.key;
    if (nodeDiff.role) {
      // TODO is this possible? Can a nodeChanged be fired when a role
      // changes or would the node be removed and re-added with the new role?
      this.highlight(nodeKey, 0, fadeMs);
    }
    if (nodeDiff.state) {
      this.highlight(nodeKey, 1, fadeMs);
    }
    if (nodeDiff.name) {
      this.highlight(nodeKey, 2, fadeMs);
    }
    // TODO this is a bit spaghetti-ish, we should probably
    // have an event that fires and is listened to. This code shouldn't
    // know about the props tree.
    if (doHighlightProps) {
      window.propsTree.highlight(nodeKey, nodeDiff, fadeMs);
    }
  }

  toTreeData(node) {
    if (!node) {
      return { title: this.ERROR_NO_DATA };
    }
    return {
      title: this.formatTitleForTreeGrid(node),
      automationData: node,
      key: node.key,
      lazy: node.children && node.children.length > 0
    };
  }

  getParentChain(key) {
    return window.client.sendMessage({ type: 'getParentKeys', key });
  }

  // Given a list of keys, ensure all ancestors for each key are loaded/expanded
  // If expandParams is truthy, will also expand. Can be an object with
  // FancyTreeNode.expand options.
  // If doMarkMatched is truthy, then this is a list of matches.
  expandAndShow(keys, expandParams, onNodeReadyFn, isCancelledFn) {
    const expandPromiseCache = {};
    const getChild = (parent, key) => {
      return parent.children.find((child) => {
        return parseInt(child.key) === key; // Fancytree stores as number
      });
    };
    const expandAll = (keys) => {
      let expandPromises = Promise.resolve(this.getViewRootNode());
      keys.forEach((key) => {
        if (isCancelledFn && isCancelledFn()) {
          return { isCancelled: true };
        }
        expandPromises = expandPromises.then((parent) => {
          const viewNode = getChild(parent, key);
          // Find child of parent that matches key
          if (viewNode) {
            const key = viewNode.key;
            // Reuse existing promise if still available;
            let expandIt = expandPromiseCache[key];
            if (!expandIt) {
              expandIt = viewNode.setExpanded(true, expandParams);
              expandPromiseCache[key] = expandIt;
            }
            return expandIt.then(() => viewNode);
          }
          else {
            throw new Error('Could not find node to expand for key ' + key);
          }
        });
      });
      return expandPromises;
    };

    const allParentChains = keys.map((key) => {
      return this.getParentChain(key)
        .then((result) => {
          return expandAll(result.parentKeys);
        })
        .then((lastParent) => {
          if (isCancelledFn && isCancelledFn()) {
            return { isCancelled: true };
          }
          if (onNodeReadyFn) {
            const child = getChild(lastParent, key);
            if (child) {
              onNodeReadyFn(child);
            }
          }
        })
        .catch((err) => {
          console.error(err);
        });
    });

    return Promise.all(allParentChains);
  }

  activate(key, opts) {
    // Batch view updates for performance
    this.tree.enableUpdate(false);

    // Expand all ancestors so the current item can be shown
    this.expandAndShow([key])
      .then(() => {
        const viewNode = this.getViewNodeByKey(key);
        if (viewNode) {
          viewNode.setActive(true, opts);
        }
        this.tree.enableUpdate(true); // Batch view updates for performance
      });
  }

  // Get the difference between 2 objects
  // (so that we can highlight what changed)
  getNodeDiff(oldObj, newObj) {
    let diff;
    const keys = new Set(Object.keys(oldObj).concat(Object.keys(newObj)));
    if (oldObj && newObj)
      for (let key of keys) {
        if (JSON.stringify(oldObj[key]) !== JSON.stringify(newObj[key])) {
          if (!diff) {
            diff = {};
          }
          if (typeof oldObj[key] === 'object' && oldObj[key] &&
            newObj[key]) {
            diff[key] = this.getNodeDiff(oldObj[key], newObj[key]);
          }
          else {
            diff[key] = oldObj[key];  // Store the old value
          }
        }
      }

    return diff;
  }

  // If tree change occurs, we must invalidate part of the view
  processTreeChanges(treeChanges) {
    function processTreeChange(treeChange) {
      const type = treeChange.type;
      const parentViewNode = treeChange.parentKey ?
        this.getViewNodeByKey(treeChange.parentKey) :
        this.getViewRootNode();
      const automationNode = treeChange.node;
      const viewNode = this.getViewNodeByKey(automationNode.key);

      if (!parentViewNode) {
        // If no nodes found, there is nothing to update in the view now
        return;
      }

      switch (type) {
      case 'nodeCreated':
      case 'subtreeCreated':
        {
          // Similar treeChanges -- nodeCreated is the subset of subtreeCreated
          // where the new node has no children

          // View node should not exist yet
          console.assert(!viewNode);

          // If not loaded, no need to update since we haven't fetched them yet
          if (parentViewNode.isLoaded()) {
            const newViewNode = this.toTreeData(automationNode);
            const insertBeforeNode = treeChange.nextSiblingKey ?
              this.getViewNodeByKey(treeChange.nextSiblingKey) : undefined;
            parentViewNode.addChildren([ newViewNode ], insertBeforeNode);
            if (itemsToKeepExpanded.has(parentViewNode)) {
              itemsToKeepExpanded.delete(parentViewNode);
              parentViewNode.setExpanded(true);
            }
            this.highlight(automationNode.key);
            // Apply current filter to changed content
            // this.nodeFilter.runOnNode(automationNode.key);
          }
        }
        break;
      case 'nodeRemoved':
        {
          // This node was removed.
          if (viewNode) {
            const wasExpanded = parentViewNode.isExpanded();
            parentViewNode.removeChild(viewNode);
            if (wasExpanded && !parentViewNode.isExpanded()) {
              // No longer expanded because all children removed
              // If we add new items, re-expand
              itemsToKeepExpanded.add(parentViewNode);
            }
          }
          break;
        }
      case 'textChanged':
        break;
      case 'nodeChanged':
        {
          // This node has changed
          // Note: based on experimentation,
          // this is the only treeChange/treeChange
          // where the automation data will be different afterwards
          // therefore we optimize and only compute the node diffs for
          // this one, hopefully this assumption holds valid
          if (viewNode) { // TODO how do we get changes if not viewed yet?
            const oldAutomationNode = viewNode.data.automationData;
            // Cache the difference that the nodeChanged represents
            // on the treeChange object so that we can use it again
            // later while traversing the event tree
            treeChange.diff = this.getNodeDiff(oldAutomationNode,
              automationNode);
            // Briefly show highlight so that node changes can be
            // seen as events occur in real time
            this.highlightNodeDiff(automationNode, treeChange.diff,
              viewNode.isActive(), 1500);

            // Update the current node with the new information
            viewNode.fromDict(this.toTreeData(automationNode));

            // Apply current filter to changed content
            this.nodeFilter.runOnSubtree(automationNode.key);
          }
          break;
        }
      }
    }
    const itemsToKeepExpanded = new Set();
    for (let treeChange of treeChanges) {
      processTreeChange.call(this, treeChange);
    }
  }

  getDocumentNodeKey() {
    return this.getViewRootNode().children[0].data.automationData.key;
  }
}

window.nodeTree = new NodeTree();
