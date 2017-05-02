# Automation Inspector
An inspection tool for Chrome Automation API

The [Chrome Automation API](https://developer.chrome.com/extensions/automation)
is an experimental accessibility API that allows developers to access the
automation tree and events for the browser. The tree resembles the DOM tree,
but only exposes the semantic structure of a page. It can be used to
programmatically interact with a page by examining names, roles, and states,
listening for events, and performing actions on nodes.

One of Chrome Automation's main purposes is to enable the development of
assistive technologies written in JavaScript, for Chrome OS. This is similar to
how MSAA, IA2 and  UIA are used on Windows, and AX Accessibility is used for
OS X. It can also be used by extensions, but because it is experimental, it
is currently available only on the dev channel and to internal assistive
technologies such as ChromeVox.

Automation Inspector is used to exercise the Automation API, to inspect the
entire Chrome OS desktop, or to inspect a specific browser tab.

This tool is mainly useful for the following types of people:
- Developers/QA working on Chrome accessibility support
- Developers/QA working on assistive technologies for Chrome OS
- Developers/QA working on accessibility of web applications looking (less so)

## Installation

* Chrome OS desktop: to inspect the Chrome OS desktop, you must [switch your
Chrome OS to the Dev Channel](https://support.google.com/chromebook/answer/1086915?hl=en),
and then install Automation Inspector as an app (insert link here).
* Chrome tabs: you can inspect individual browser tabs on any OS. To do this,
[install Google Chrome Canary](https://www.google.com/chrome/browser/canary.html) and
then install Automation Inspector as an extension (insert link here).

## Development

### Building
The first time you build, do an ```npm install```
This will automatically run ```bower install``` for you.
If you want to update the dependencies, use ```npm update && bower update```

Next, type the following from the command line in the automation-inspector folder:
```grunt```
to build once, or:
```grunt default watch```
to keep the build updated as source files change.

### Running from the local file system
Using developer mode from the Chrome extensions page at ```chrome://extensions```,
use the load unpacked extension feature, pointing it at the
```build/extension``` folder.

## Usage tips

### Finding a node

The find field is very powerful, and can be used in a number of ways:

* Plain text search: this will search rows for the visible text shown.
This can be slow on complex pages, it it will cause the entire page to be
loaded a bit at a time.
* ```/RegEx/``` search: include slashes to search for rows with matching visible text.
Slow on complex pages (similiar to plain text search).
* ```${selector}```: use jQuery-like format, which is a CSS selector wrapped inside $(),
to find a node matching a given selector. This will currently return only the
first item. This method uses the Automation API's domQuerySelector method. For
example, use ```$('#my-special-element')``` to find the nearest automation node to
that element.
* ```{JSON FindParams}```: this executes the Automation API's findAll method with syntax
similar to [FindParams](https://developer.chrome.com/extensions/automation#type-FindParams).
However, this method accepts valid JSON syntax only. You must provide strings
rather than constants. For example, use ```{ "state" : {"disabled": true }}```
rather than ```{ state: { StateType.disabled: true }}```.




