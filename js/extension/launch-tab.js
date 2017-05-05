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

'use strict';

// React when a browser action's icon is clicked.
// Try to find and activate existing inspector for the current tab,
// or create one if it doesn't already exist
chrome.browserAction.onClicked.addListener((tab) => {
  chrome.tabs.insertCSS(null, {
    allFrames: true,
    file: 'css/injected/injected.css'
  });
  chrome.tabs.executeScript(null, {
    allFrames: true,
    file: 'js/injected/injected.js'
  });

  const url = getInspectorUrl(tab);
  chrome.tabs.query({url}, (result) => {
    if (result && result.length) {
      // Found previous inspector: will use that
      chrome.tabs.update(result[0].id, {active: true});
    }
    else {
      // Create new inspector tab
      chrome.tabs.create({
        url,
        index: tab.index + 1 // Open new tab adjacent to tab we're inspecting
      });
    }
  });
});

// Reload inspector for a tab that loads a new page
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === 'complete') {
    const url = getInspectorUrl(tab);
    chrome.tabs.query({url}, (result) => {
      if (result && result.length) {
        chrome.tabs.reload(result[0].id);
      }
    });
  }
});

// If this tab were to have an inspector paired with it, this would be the url
function getInspectorUrl(tab) {
  return chrome.extension.getURL('html/main-view.html') + '?tab=' + tab.id;
}

