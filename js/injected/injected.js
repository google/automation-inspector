function onPortDisconnect() {
  console.log('port disconnect');
}

const onMouseMove = (evt) => {
  window.port.postMessage({
    message: 'mousemove',
    x: evt.screenX,
    y: evt.screenY
  });
};

function onPortMessage(event) {

  if (event.message === 'setHitTestingEnabled') {
    if (Boolean(this.isHitTestingEnabled) === event.doEnable) {
      return;
    }
    this.isHitTestingEnabled = event.doEnable;
    if (event.doEnable) {
      window.addEventListener('mousemove', onMouseMove, { passive: true });
    }
    else {
      window.removeEventListener('mousemove', onMouseMove, { passive: true });
    }
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
