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

// Manage configuration
// Manage communication with automation-server (background-script that
// provides information about automation nodes and events)

class Client {
  constructor() {
    // Promise failure handling
    window.addEventListener('unhandledrejection', this.onError);

    // Connect to automation server so that we can listen to events
    this.serverPort = chrome.runtime.connect( {
      // We can only provide arguments to connect in the name string
      name: 'automation-inspector' + ':' + this.getTab()
    });
    if (chrome.runtime.lastError) {
      console.error(chrome.runtime.lastError);
    }
    this.addPortListener('error', (response) => this.onError(response.error));
  }

  onError(err) {
    console.error(JSON.stringify(err));
    window.alert('Error: ' + JSON.stringify(err));
  }

  // A number for a known tab id (extension) or null
  getTab() {
    const tabId = this.getQuery().tab;
    return tabId ? parseInt(tabId) : null;
  }

  // Get an object where each field represents a URL parameter
  // e.g. { tab: 33 }
  getQuery() {
    if (!this.query) {
      this.query = {};
      const queryStr = window.location.search.substring(1);
      const vars = queryStr.split('&');
      for (let i=0; i<vars.length; i++) {
        const pair = vars[i].split('=');
            // If first entry with this name
        this.query[pair[0]] = pair[1] && decodeURIComponent(pair[1]);
      }
    }
    return this.query;
  }

  addPortListener(message, callback) {
    if (!this.portListenerCallbacks) {
      this.serverPort.onMessage.addListener((event) => {
        console.assert(event.tab === this.getTab());
        const callback = this.portListenerCallbacks[event.message];
        console.assert(callback);
        callback(event);
      });
      this.portListenerCallbacks = {};
    }
    this.portListenerCallbacks[message] = callback;
  }

  // Send a message to server a return response in Promise
  sendMessage(request) {
    const finalRequest = $.extend(request, { tab: this.getTab() });
    return new Promise((resolve) => {
      chrome.runtime.sendMessage(finalRequest, (result) => {
        if (chrome.runtime.lastError) {
          throw new Error(JSON.stringify(chrome.runtime.lastError));
        }
        if (result.error) {
          throw new Error(result.error);
        }
        resolve(result);
      });
    });
  }

  getRootAutomationNode() {
    if (!this.getRootAutomationNode.prom) {
      this.getRootAutomationNode.prom = new Promise((resolve) => {
        this.addPortListener('ready', (event) => {
          this.allStates = event.allStates;
          this.allRoles = event.allRoles;
          resolve(event.rootNode);
        });
      });
    }
    return this.getRootAutomationNode.prom;
  }

  getAllStates() {
    return this.allStates;
  }

  getAllRoles() {
    return this.allRoles;
  }
}

window.client = new Client();


