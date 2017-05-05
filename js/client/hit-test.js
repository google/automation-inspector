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

// Manage hit testing and highlighting

class HitTest {
  constructor() {
    this.tabPort = chrome.tabs.connect(window.client.getTab(), {
      name: 'automation-inspector'
    });
    $(document).ready(() => this.initButton());
  }

  initButton() {
    this.$button = $('#node-hit-test-button');
    this.$button.on('click', () => {
      const willNowBePressed = this.$button.attr('aria-pressed') !== 'true';
      this.setHitTestingState(willNowBePressed);
    });
  }

  setHitTestingState(doEnable) {
    if (Boolean(this.isEnabled) === doEnable) {
      return;
    }
    this.isEnabled = doEnable;
    this.$button.attr('aria-pressed', doEnable);

    const onMouseEvent = (event) => {
      let fnName = 'mouseMoved';
      if (event.message === 'mousedown') {
        this.setHitTestingState(false);
        fnName = 'mousePressed';
      }
      const functionCallParams = {
        type: 'call',
        key: window.nodeTree.getDocumentNodeKey(),
        functionName: 'hitTest',
        props: [ event.x, event.y, fnName ]
      };
      window.client.sendMessage(functionCallParams);
    };

    if (doEnable) {
      this.tabPort.onMessage.addListener(onMouseEvent);
    }
    else {
      this.tabPort.onMessage.removeListener(onMouseEvent);
    }
    this.tabPort.postMessage({
      message: 'setHitTestingEnabled',
      doEnable
    });
  }
}

window.hitTest = new HitTest();





