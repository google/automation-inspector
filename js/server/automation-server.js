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

// This background script acts as a server of automation data. It responds
// to requests for node information and notifies the client of events.

/* global AutomationTree */

'use strict';

const portToTreeMap = new Map();
const rootToTreeMap = new WeakMap();

function getTree(tabId) {
  return portToTreeMap.get(tabId);
}

function onTreeChange(treeChange) {
  const rootNode = treeChange.target.root;
  const automationTree = rootToTreeMap.get(rootNode);

  if (automationTree) {
    automationTree.onTreeChange(treeChange);
  }
}

// -- Port listener --
// When a port listener connects, this is a new automation inspector
// client requestiong information.
// We keep the port listener open and use it to:
// - Send tree updates and events
// When it disconnects we reset the tree and remove it from the cache
chrome.runtime.onConnect.addListener((port) => {
  if (chrome.runtime.lastError) {
    console.error(chrome.runtime.lastError);
    return;
  }

  console.assert(port.name.startsWith('automation-inspector:'));
  const tabId = parseInt(port.name.split('automation-inspector:')[1]) || null;

  port.onDisconnect.addListener(() => onPortDisconnect(tabId));
  port.onMessage.addListener(onPortMessage);
  console.info('Connected to automation client with tab id = ' + tabId);

  const automationTree = new AutomationTree(port, tabId);
  automationTree.init((rootNode) => {
    if (portToTreeMap.size === 0) {
      onFirstConnectionAdded();
    }
    portToTreeMap.set(tabId, automationTree);
    rootToTreeMap.set(rootNode, automationTree);
    const rootNodeData = automationTree.getNodeData(rootNode);
    const allStates = Object.values(chrome.automation.StateType);
    const allRoles = Object.values(chrome.automation.RoleType);

    port.postMessage({
      message: 'ready',
      tab: tabId,
      rootNode: rootNodeData,
      allStates,
      allRoles
    });
  });
});

function onFirstConnectionAdded() {
  console.info('Begin listening to treeChanges');
  chrome.automation.addTreeChangeObserver('allTreeChanges', onTreeChange);
}

function onLastConnectionRemoved() {
  console.info('End listening to treeChanges');
  chrome.automation.removeTreeChangeObserver(onTreeChange);
}

// We do not currently receive port messages, only send them
function onPortMessage() {
  throw new Error('Port message unexpected');
}

function onPortDisconnect(tabId) {
  const tree = getTree(tabId);
  if (tree) {
    tree.removeEventListeners();
    rootToTreeMap.delete(tree.rootNode);
    portToTreeMap.delete(tabId);
    if (portToTreeMap.size === 0) {
      onLastConnectionRemoved();
    }
  }
}

// Regular expressions can't be passed in messages, so the client
// passes them as { regex: text, flags } where flags can be '', 'g', 'gi', etc.
function convertRegExps(data) {
  function convert(obj) {
    for (let key in obj) {
      const val = obj[key];
      if (typeof val !== 'object') {
        // Do nothing for basic types, move to next key
        continue;
      }
      if (val.regex) {
        // We passed a regex, convert to real regex
        obj[key] = new RegExp(val.regex, val.flags);
      }
      else {
        convert(val);
      }
    }
  }

  convert(data);
  return data;
}

function supportsRegExpParams(fnName) {
  // These functions support regular expression input
  return fnName === 'find' || fnName === 'findAll';
}

function isCallbackUsed(fnName) {
  return fnName === 'domQuerySelector';
}

// -- Runtime listener --
// Use runtime listener to respond to specific information requests
chrome.runtime.onMessage.addListener(onRequestMessage);
if (chrome.runtime.lastError) {
  console.error(chrome.runtime.lastError);
}

function onRequestMessage(request, sender, sendResponse) {
  function sendNodeResult(result) {
    if (Array.isArray(result) && AutomationTree.isAutomationNode(result[0])) {
      sendResponse(result.map((item) => tree.getRelationObject(item)));
    }

    if (AutomationTree.isAutomationNode(result)) {
      sendResponse(tree.getRelationObject(result));
    }

    sendResponse(null);
  }

  const tabId = request.tab;
  const tree = getTree(tabId);
  if (!tree) {
    throw new Error('No tree data for request: ' + JSON.stringify(request));
  }
  switch (request.type) {
  case 'getFunctions':
    {
      sendResponse({ functions: tree.getAllFunctionProps() });
      return true;
    }
  case 'call':
    {
      const node = tree.getNode(request.key);
      if (!node) {
        sendResponse({ error: 'No node found' });
        return;
      }
      if (!node[request.functionName]) {
        sendResponse({ error: 'No function found' });
        return;
      }

      // Useful for find/findAll
      // TODO these calls do not match the root of the search itself
      // Either we should address that (perhaps with an option param)
      // or make an extra call to .matches() on the root
      if (supportsRegExpParams(request.functionName)) {
        convertRegExps(request.props);
      }

      try {
        const props = Array.isArray(request.props) ? request.props :
          [ request.props ];
        if (isCallbackUsed(request.functionName)) {
          // -- Async callback --
          // Result in callback args
          // Add function handling callback to arguments
          props.push((result) => sendNodeResult(result));
          node[request.functionName](...props);
        }
        else {
          // -- Synchronous call --
          // Result in return value
          const result = node[request.functionName](...props);
          sendNodeResult(result);
        }
      }
      catch(ex) {
        sendResponse({ error: ex });
      }

      return true;
    }
  case 'getRelated':
    sendResponse({ nodes: tree.getRelated(request.key, request.relation) });
    return true;
  case 'getParentKeys':
    sendResponse({ parentKeys: tree.getParentKeys(request.key) });
    return true;
  }
}
