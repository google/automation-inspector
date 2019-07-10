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

// This object tracks one automation tree.
// For the extension, there is one tree per tab
// For the app, there is one tree for the entire desktop

/* exported AutomationTree */

class AutomationTree {
  constructor(port, tabId) {
    this.eventKeyCounter = 0;
    this.nodeKeyCounter = 0;
    this.nodeToKeyMap = new WeakMap();
    this.keyToNodeMap = new Map();
    this.port = port;
    this.rootNode = null;
    this.allAutomationNodeProps = null;
    this.tabId = tabId;
  }

  init() {
    const initTreeForTab = (callback) => {
      chrome.automation.getTree(this.tabId, (rootNode) => {
        if (chrome.runtime.lastError) {
          // Show error
          console.error(chrome.runtime.lastError);
          callback({ error: chrome.runtime.lastError });
        }
        else {
          callback(rootNode);
        }
      });
    };

    const initTree = (callback) => {
      if (this.tabId) {
        // Known tab id (extension launch)
        return initTreeForTab(callback);
      }
      else {
        // Init tree for entire desktop
        chrome.automation.getDesktop((rootNode) => {
          if (chrome.runtime.lastError) {
            // Cannot get desktop tree -- must be app, but not on Chrome OS
            // Get the tree for the current window but reset it on popup close
            initTreeForTab(null, callback);
          }
          else {
            callback(rootNode);
          }
        });
      }
    };

    return new Promise((resolve) => {
      // Already initialized?
      if (this.rootNode) {
        return this.rootNode;
      }

      if (!chrome.automation) {
        throw new Error(
          'Automation Inspector could not find the automation API. ' +
            'Try running on Canary or a developer channel build.'
        );
      }

      // First time
      initTree((rootNode) => {
        this.rootNode = rootNode;
        this.allAutomationNodeProps = this.getAllPropertyNames(rootNode);
        this.addEventListeners();
        resolve(rootNode);
      });
    });
  }

  addEventListeners() {
    console.assert(!this.eventListener);
    this.eventListener = this.onEvent.bind(this);
    this.getEventTypes().forEach((eventType) => {
      this.rootNode.addEventListener(eventType, this.eventListener);
    });
    this.isObserving = true;
  }

  removeEventListeners() {
    console.assert(this.eventListener);
    this.getEventTypes().forEach((eventType) => {
      this.rootNode.removeEventListener(eventType, this.eventListener);
    });
    this.eventListener = null;
  }

  getAllFunctionProps() {
    console.assert(this.rootNode);
    const rootNode = this.rootNode;
    return this.allAutomationNodeProps.map((prop) =>
      typeof rootNode[prop] === 'function');
  }

  // Get node data for the requested relation of the node specifed by nodeKey
  getRelated(nodeKey, relation) {
    console.assert(this.rootNode);
    const node = this.getNode(nodeKey);
    if (!node) {
      console.error('Could not find node for key = ', nodeKey);
      return [];
    }
    const related = node[relation];
    return Array.isArray(related) ?
      related.map(this.getNodeData, this) :
      this.getNodeData(related);
  }

  // Return a list of parent keys ordered from the root down,
  // and not including the passed-in node
  getParentKeys(nodeKey) {
    console.assert(this.rootNode);
    const parentKeys = [];
    let current = this.getNode(nodeKey);
    if (current) {
      while ((current = current.parent) !== undefined) {
        parentKeys.unshift(this.getNodeKey(current));
      }
    }
    return parentKeys;
  }

  getNode(nodeKey) {
    return this.keyToNodeMap.get(nodeKey);
  }

  // -- Private --
  // We need to cache nodes and generate keys because we need to store
  // the node->key and key->node maps.
  // We need the generated keys in order to identify nodes and pay able to pass
  // info about them in JSON-ifiable data (over to popup and content scripts)
  // TODO Add unique id's and the ability to get a node by id to automation API
  // so that we don't need to cache
  // This key will be used to refer back to this node
  getNodeKey(node) {
    const cacheNode = (node) => {
      const key = ++ this.nodeKeyCounter;
      this.nodeToKeyMap.set(node, key);
      this.keyToNodeMap.set(key, node);
      return key;
    };

    return this.nodeToKeyMap.get(node) || cacheNode(node);
  }

  // A treeChange is like an event, but it a special category
  // relating to alterations in the accessibility tree data
  onTreeChange(event) {
    const onNodeRemoved = (node) => {
      const key = this.nodeToKeyMap.get(node);
      this.keyToNodeMap.delete(key);
      this.nodeToKeyMap.delete(node); // Weak ref, but may as well remove
    };

    const updateCacheFromTreeChange = (type, node) => {
      switch (type) {
      case 'nodeCreated':
        // This node was added to the tree and its parent is new as well,
        // so it's just one node in a new subtree that was added.
        break;
      case 'subtreeCreated':
        // Node was added to but its parent was already in the tree,
        // so it's possibly the root of a new subtree - it does not mean that it
        // necessarily has children.
        break;
      case 'nodeChanged':
        // This node changed.
        break;
      case 'textChanged':
        // This node's text (name) changed.
        break;
      case 'nodeRemoved':
        // This node was removed.
        onNodeRemoved(node);
        break;
      }
    };

    const type = event.type;
    const node = event.target;
    const eventData = {
      type, // So that tree changed events stand out
      isTreeChange: true
    };

    const parent = node.parent;
    if (parent) {
      eventData.parentKey = this.getNodeKey(parent);
      const nextSibling = node.nextSibling;
      if (nextSibling) {
        eventData.nextSiblingKey = this.getNodeKey(nextSibling);
      }
    }
    this.reportEvent(eventData, node);

    updateCacheFromTreeChange(type, node);
  }

  reportEvent(eventData, node) {
    // Ignore Automation Inspector events in desktop inspection mode
    // They will be reported if an automation inspector is used
    // to inspect another inspector (when we're an extension)
    if (!this.tabId && node && node.root) {
      // Check to see if url on root is chrome-extension://[EXTENSION_ID]/*
      const url = new URL(node.root.docUrl);
      if (url.protocol === 'chrome-extension:' &&
        url.hostname === chrome.runtime.id) {
        return;
      }
    }

    // Generate event data
    eventData.message = 'automation-event';
    eventData.node = this.getNodeData(node);
    eventData.key = ++ this.eventKeyCounter;
    eventData.tab = this.tabId;
    this.port.postMessage(eventData);
  }

  onEvent(event) {
    const eventData = {
      type: event.type,
      isUser: event.eventFrom === 'user' || undefined,
      mouseX: event.mouseX,
      mouseY: event.mouseY
    };

    this.reportEvent(eventData, event.target);
  }

  getEventTypes() {
    return Object.values(chrome.automation.EventType);
  }

  getAllPropertyNames( obj ) {
    const proto1 = Object.getPrototypeOf(obj),
      proto2 = Object.getPrototypeOf(proto1);
    return Object.getOwnPropertyNames(obj)
      .concat(Object.getOwnPropertyNames(proto1))
      .concat(Object.getOwnPropertyNames(proto2));
  }

  // TODO improve
  // Right now it returns true if it has a role property,
  // which is probably good enough. Using typeof/instanceof did not work.
  static isAutomationNode(something) {
    return something && typeof something === 'object' && 'role' in something;
  }

  getRelationObject(node) {
    console.assert(this.rootNode);
    const obj = {
      key: this.getNodeKey(node),
      role: node.role
    };
    const id = node.htmlAttributes && node.htmlAttributes.id;
    if (id) {
      obj.id = id;
    }
    return obj;
  }

  // -- Private --
  // Serialize all properties found on the node object.
  getNodeData(node) {
    const getState = (state) => {
      // Change from { focused: true, checked: true } to [ 'focused', 'checked' ]
      return Object.keys(state).filter((stateName) => state[stateName]);
    };

    const serialize = (from, to, props) => {
      for (let prop of props) { // Get all keys
        // For unknown reasons, accessing tableCellRowHeaders is breaking the code.
        // https://github.com/google/automation-inspector/issues/18
        // TODO: investigate on why it happens.
        if (prop === 'tableCellRowHeaders') continue;
        const val = from[prop],
          type = typeof val;

        if (type === 'object') {
          if (AutomationTree.isAutomationNode(val)) {
            // Convert AutomationNode's to serializable keys
            to[prop] = this.getRelationObject(val);
            nodeData.relationProps.push(prop);  // Track relation properties
          }
          else if (prop === 'state') {
            // Convenience exception, change state object to an array of strings
            // for true states
            to[prop] = getState(val);
          }
          else if (Array.isArray(val)) {
            if (val.length) {
              if (AutomationTree.isAutomationNode(val[0])) {
                // Array of automation nodes
                to[prop] = val.map(this.getRelationObject, this);
                nodeData.relationProps.push(prop); // Track relation properties
              }
              else {
                // Array of something else
                to[prop] = [];
                serialize(val, to[prop], Object.keys(val));
              }
            }
          }
          else {
            // Object
            to[prop] = {};
            serialize(val, to[prop], Object.keys(val));
          }
        }
        // TODO what about functions? Should we provide their names
        // to the client and let ppl poke at them with different params?
        else if (type === 'function') {
          const BLACKLIST = [ 'constructor', 'addEventListener',
            'removeEventListener', 'toString'];
          if (!BLACKLIST.includes(prop)) {
            to[prop] = { isFunction: true }; // Show play character
          }
        }
        else {
          to[prop] = val;
        }
      }
      return to;
    };

    const nodeData = {
      key: this.getNodeKey(node),
      relationProps: []   // Track relation properties
    };

    return serialize(node, nodeData, this.allAutomationNodeProps);
  }
}

AutomationTree.rootToTreeMap = new WeakMap();

