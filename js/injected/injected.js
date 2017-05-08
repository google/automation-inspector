let port;

function onPortDisconnect() {
  console.log('port disconnect');
}

function sendEventMessage(type, evt) {
  port.postMessage({
    message: type,
    x: evt && evt.screenX,
    y: evt && evt.screenY
  });
}

function onMouseMove(evt) {
  sendEventMessage('mouseMoved', evt);
}

function onMouseDown(evt) {
  sendEventMessage('mousePressed', evt);
  setHitTestingEnabled(false);
}

function onKeyDown(evt) {
  if (evt.key === 'Escape') {
    sendEventMessage('mouseCancelled');
  }
}

function setHitTestingEnabled(doEnable) {
  if (Boolean(this.isHitTestingEnabled) === doEnable) {
    return;
  }
  this.isHitTestingEnabled = doEnable;
  if (doEnable) {
    window.addEventListener('mousemove', onMouseMove, { passive: true });
    window.addEventListener('mousedown', onMouseDown, true);
    window.addEventListener('keydown', onKeyDown);
    document.documentElement.setAttribute('automation-hit-test', 'true');
  }
  else {
    window.removeEventListener('mousemove', onMouseMove, { passive: true });
    window.removeEventListener('mousedown', onMouseDown, true);
    window.removeEventListener('keydown', onKeyDown);
    document.documentElement.removeAttribute('automation-hit-test');
  }
}

function onPortMessage(event) {

  if (event.message === 'setHitTestingEnabled') {
    setHitTestingEnabled(event.doEnable);
  }
}

chrome.runtime.onConnect.addListener((newPort) => {
  if (chrome.runtime.lastError) {
    console.error(chrome.runtime.lastError);
    return;
  }

  port = newPort;

  port.onDisconnect.addListener(onPortDisconnect);
  port.onMessage.addListener(onPortMessage);
});
