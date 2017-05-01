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

// The property view tree, which groups similar properties for convenience

/*global Tree*/

class PropsTree extends Tree {
  init() {

    this.ID_PREFIX = 'pr_';

    const CONTAINER_ID = '#props-tree';
    const $container = $(CONTAINER_ID);
    const treeOptions = $.extend(this.DEFAULT_TREE_OPTIONS, {
      idPrefix: this.ID_PREFIX,
      quicksearch: true, // Navigate to next node by typing the first letters
      source: [ ],  // Nothing to show until a node is activated in node-tree
      keydown: (event, data) => {
        if (event.keyCode === 13 /* Enter */) {
          this.onClick(event, data);
        }
      },
      click: this.onClick.bind(this)
    });

    this.finalize($container, treeOptions);
  }

  onClick(event, data) {
    const node = data.node,
      relationKey = node.data.relationKey;
    if (relationKey) {
      window.nodeTree.activate(relationKey);
      window.nodeTree.tree.setFocus(true);
    }
    else {
      const fnName = node.data.functionName;
      if (fnName) {
        this.callAutomationFunction(fnName)
          .then((value) => {
            node.setTitle('<a href="#">' + fnName + '()</a> \u2192 ' +
              JSON.stringify(value));
          });
      }
    }
  }

  callAutomationFunction(functionName) {
    const functionCallParams = {
      type: 'call',
      key: this.lastKey,
      functionName,
      props: []
    };
    return window.client.sendMessage(functionCallParams);
  }

  // Groupings of properties
  // TODO move to JSON config file
  getPropMap() {
    return {
      'Global': [ 'name', 'nameFrom', 'role', 'state', 'description' ],
      'Widget': [ 'placeholder', 'value', 'valueForRange', 'minValueForRange',
        'maxValueForRange', 'textInputType', 'buttonMixed', 'accessKey',
        'ariaInvalidValue', 'ariaReadonly' ],
      'HTML': [ 'htmlTag', 'htmlAttributes', 'imageDataUrl' ],
      'Structure': [ 'posInSet', 'setSize', 'hierarchicalLevel', 'isRootNode' ],
      'Table': [ 'tableRowCount', 'tableColumnCount', 'tableCellColumnIndex',
        'tableCellColumnSpan', 'tableCellRowIndex', 'tableCellRowSpan',
        'tableColumnHeader', 'tableRowHeader' ],
      'Live region': [ 'liveStatus', 'liveRelevant', 'liveAtomic', 'liveBusy',
        'containerLiveStatus', 'containerLiveRelevant', 'containerLiveAtomic',
        'containerLiveBusy' ],
      'Selection': [ 'anchorOffset', 'anchorAffinity', 'anchorObject',
        'focusOffset', 'focusAffinity', 'focusObject', 'textSelStart',
        'textSelEnd' ],
      'Text': [ 'language', 'wordStarts', 'wordEnds',
        'lineStartOffsets', 'lineBreaks',
        'markerStarts', 'markerEnds', 'markerTypes' ],
      'Relations': 'relationProps',
      'Document': [ 'docTitle', 'docUrl', 'docLoaded', 'docLoadingProgress' ],
      'Appearance': [ 'location', 'color', 'backgroundColor', 'colorValue',
        'display' ],
      'Scrolling': [ 'scrollX', 'scrollXMin', 'scrollXMax',
        'scrollY', 'scrollYMin', 'scrollYMax' ],
      'Functions': '()',
      'Other': '*' // Show the rest
    };
  }

  // Should the given group be collapsed by default?
  // Use for properties that are less common, to save visual space
  // TODO move to JSON config file
  isCollapsedByDefault(propName) {
    const COLLAPSED = new Set(['Functions', 'location', 'Scrolling',
      'Text', 'Appearance' ]);
    return COLLAPSED.has(propName);
  }

  prettifyValue(propName, val) {
    if (propName === 'color' || propName === 'backgroundColor' ||
      propName === 'colorValue') {
      // Show hex value of color then a sample square with that color
      if (val < 0) {
        val = 0xffffff + val + 1;
      }
      const cssColor = '#' + ('00000' + val.toString(16)).slice(-6);
      return cssColor + ' ' + '<span style="background-color: ' + cssColor +
        '"> &nbsp; &nbsp; </span>';
    }
    else if (propName === 'nameFrom') {
      return val || undefined;
    }
    else {
      return val;
    }
  }

  // Get initialization data for a tree view  node holding a relation property
  getRelationTreeData(relation, relationDescription) {
    const text ='@' + relation.role + (relation.id ? '#' + relation.id : '');
    // Turn tabbing off via tabindex="-1" -- provides link activation via
    // custom  event handlers on tree node
    const linkName = '<a tabindex="-1" href="#">' + text + '</a>';
    return {
      title: relationDescription + ': ' + linkName,
      relationKey: relation.key,
      tooltip: 'Click or press enter to navigate to this relation'
    };
  }

  // Get initialization data for a tree view node holding |obj|
  // Recursive when there are child object properties
  toTreeData(obj, parentKey) {
    const childrenToAdd = [];
    for (let prop of Object.keys(obj)) {
      let newChild = {
        key: (parentKey || '' ) + prop,
        expanded: !this.isCollapsedByDefault(prop)
      };
      const val = this.prettifyValue(prop, obj[prop]);

      // Change behavior based on value type
      if (typeof val === 'object') {
        newChild.title = prop;
        if (val.isFunction) {  // ** Function **
          newChild.title = '<a href="#">' + prop + '()</a>';
          newChild.tooltip = 'Press enter to call this function';
          newChild.functionName = prop;
        }
        else if (Array.isArray(val)) { // ** Array **
          if (val.length === 0) {
            // ** Empty array **
            // Don't show values for arrays of length 0
            continue;
          }
          if (typeof val[0] === 'object' && 'key' in val[0]) {
            // ** Relation array **
            newChild.children = val.map((relation, index) => {
              return this.getRelationTreeData(relation, index);
            });
          }
          else {
            // ** Other array **
            newChild.children = val.map((arrayVal) => {
              return {
                title: arrayVal
              };
            });
          }
        }
        else {
          // ** Other object **
          if ('key' in val) {
            // ** Single relation **
            newChild = this.getRelationTreeData(val, prop);
          }
          else {
            // ** Generic object **
            newChild.children = this.toTreeData(val, prop + '.');
            if (newChild.children.length === 0) {
              continue;
            }
          }
        }
      }
      else {
        // ** Primitive value **
        if (typeof val === 'undefined') {
          // ** Undefined **
          continue;
        }
        if (val === '') {
          // ** Empty string **
          // Show 'n/a' in a different color to differentiate
          newChild.extraClasses = 'name-undefined';
        }
        newChild.title = prop + ': ' + val;
      }
      childrenToAdd.push(newChild);
    }

    return childrenToAdd;
  }

  // What properties should we show on the node?
  // TODO Move to JSON
  getPropsToShow(automationNode) {
    // Don't show these props as they are redundant or not useful to show
    const REDUNDANT_PROPS = [
      // These are implicitly shown in the treeview
      'children', 'parent', 'firstChild', 'lastChild', 'previousSibling',
      'nextSibling',
      // This is internal implementation data
      'key', 'relationProps',
      // These functions are used via the search field
      'domQuerySelector', 'find', 'findAll'
    ];
    const propsToShow = new Set(Object.keys(automationNode));
    REDUNDANT_PROPS.forEach((prop) => { propsToShow.delete(prop); });
    return propsToShow;
  }

  // Refresh the view, displaying properties for the automationNode
  // The sourceName describes whether the node data is from an event,
  // in which case we'll be seeing the node data as it was right after the event
  showProps(automationNode, sourceName) {
    this.lastKey = automationNode.key;

    const remainingProps = this.getPropsToShow(automationNode);
    const childrenToAdd = [];
    const propMap = this.getPropMap();

    $('#props-legend-source-name').text(sourceName || '');

    // Organize the properties by intuitive groupings
    for (let groupName in propMap) {
      if (!propMap.hasOwnProperty(groupName)) {
        continue;
      }
      let props;
      if (propMap[groupName] === '*') {
        // ** Other **
        // Show remaining properties not in another group
        props = remainingProps;
      }
      else if (propMap[groupName] === '()') {
        // ** Function **
        props = Array.from(remainingProps).filter((name) =>
          automationNode[name].isFunction);
      }
      else if (typeof propMap[groupName] === 'string') {
        // ** String **  -> Remap to a different property
        props = automationNode[propMap[groupName]];
      }
      else {
        // ** General **  -> Group the set of properties provided
        props = new Set(propMap[groupName]);
      }

      // Add props to |group| and remove from |remainingProps|
      const group = {};
      for (let prop of props) {
        if (remainingProps.has(prop)) {   // Only use each prop once
          group[prop] = automationNode[prop];
          remainingProps.delete(prop);
        }
      }

      // Get view initialization data for the group
      const groupTreeChildren =
        this.toTreeData(group);
      if (groupTreeChildren.length) {
        childrenToAdd.push({
          title: groupName,
          children: groupTreeChildren,
          expanded: !this.isCollapsedByDefault(groupName)
        });
      }
    }

    this.clearAll();
    this.getViewRootNode().addChildren(childrenToAdd);
  }

  // Highlight properties that changed from an treeChange (nodeChanged)
  highlight(nodeKey, changeData, fadeMs) {
    if (nodeKey !== this.lastKey) {
      return;  // This isn't the node that's currently displayed
    }
    const highlightImpl = (changeData, keyPrefix) => {
      for (let prop in changeData) {
        const viewNode = this.getViewNodeByKey((keyPrefix || '') + prop);
        if (viewNode) {
          const change = changeData[prop];
          if (typeof change === 'object') {
            // Expand and highlight changed sub-properties like
            // htmlAttributes.id
            viewNode.setExpanded(true);
            highlightImpl(changeData[prop], prop + '.');
          }
          else {
            viewNode.addClass('highlight');
            // Show what the old property value was
            viewNode.setTitle(viewNode.title +
              '<span class="was"> (was ' + change + ')</span>');
            if (fadeMs) {
              setTimeout(() => {
                viewNode.removeClass('highlight');
              }, fadeMs );
            }
          }
        }
      }
    };
    highlightImpl(changeData);
  }
}

window.propsTree = new PropsTree();
