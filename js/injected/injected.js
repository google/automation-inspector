function onPortDisconnect() {
  console.log('port disconnect');
}

function onMouseMove(evt) {
  window.port.postMessage({
    message: 'mousemove',
    x: evt.screenX,
    y: evt.screenY
  });
}

function onClick(evt) {
  window.port.postMessage({
    message: 'click'
  });
  setHitTestingEnabled(false);
  evt.stopPropagation();
  evt.stopImmediatePropagation();
}

function setHitTestingEnabled(doEnable) {
  if (Boolean(this.isHitTestingEnabled) === doEnable) {
    return;
  }
  this.isHitTestingEnabled = doEnable;
  if (doEnable) {
    window.addEventListener('mousemove', onMouseMove, { passive: true });
    window.addEventListener('click', onClick, true);
    document.documentElement.setAttribute('automation-hit-test', 'true');
  }
  else {
    window.removeEventListener('mousemove', onMouseMove, { passive: true });
    window.removeEventListener('click', onClick, true);
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
