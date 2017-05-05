function onPortDisconnect() {
  console.log('port disconnect');
}

function sendEventMessage(evt) {
  window.port.postMessage({
    message: evt.type,
    x: evt.screenX,
    y: evt.screenY
  });
}

function onMouseDown(evt) {
  sendEventMessage(evt);
  setHitTestingEnabled(false);
}

function setHitTestingEnabled(doEnable) {
  if (Boolean(this.isHitTestingEnabled) === doEnable) {
    return;
  }
  this.isHitTestingEnabled = doEnable;
  if (doEnable) {
    window.addEventListener('mousemove', sendEventMessage, { passive: true });
    window.addEventListener('mousedown', onMouseDown, true);
    document.documentElement.setAttribute('automation-hit-test', 'true');
  }
  else {
    window.removeEventListener('mousemove', sendEventMessage, { passive: true });
    window.removeEventListener('mousedown', onMouseDown, true);
    document.documentElement.removeAttribute('automation-hit-test');
  }
}

function onPortMessage(event) {

  if (event.message === 'setHitTestingEnabled') {
    setHitTestingEnabled(event.doEnable);
  }
}

chrome.runtime.onConnect.addListener((port) => {
  if (chrome.runtime.lastError) {
    console.error(chrome.runtime.lastError);
    return;
  }

  window.port = port;

  port.onDisconnect.addListener(onPortDisconnect);
  port.onMessage.addListener(onPortMessage);
});
