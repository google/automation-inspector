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

// The tree view for events. A tree view is used so that the noisy event
// stream can be grouped into related events

/*global Tree*/

class EventTree extends Tree {
  initAutomationEventListener() {
    window.client.addPortListener('automation-event', (event) =>
      this.addEventToCurrentBatch(event)
    );
  }

  constructor() {
    super();
    this.initAutomationEventListener();
  }

  init() {
    this.ID_PREFIX = 'ev_';
    this.MAX_LOG_GROUPS = 100;
    this.logCounter = 0;

    const EXTENSIONS = ['filter', 'table', 'ariagrid'];
    const CONTAINER_ID = '#event-treegrid';
    const $container = $(CONTAINER_ID);
    const treeOptions = $.extend(this.DEFAULT_TREE_OPTIONS, {
      idPrefix: this.ID_PREFIX,
      extensions: EXTENSIONS, // Column view makes things easier to read
      source: [ ],  // No events yet
      // Use only in treegrid mode
      renderColumns: (event, data) => this.renderColumns(data.node),
      activate: (event, data) => this.onActivate(data.node.data.automationData)
      // Other options we aren't currenly using:
      // --------------------------------------------------------------------
      // Re-apply last filter if lazy data is loaded
      // Too expensive when there are many events. We do this manually
      // on new events as they come in via renderColumns#applyFilter()
      // treeOptions.filter.autoApply = true;
      // --------------------------------------------------------------------
      // Auto expand found events
      // Too expensive and noisy as filter runs on newly logged items.
      // On pages like nytimes.com this causes too much processing
      // as we are flooded with tens of thousands of mutation events.
      // treeOptions.filter.autoExpand = false;
      // --------------------------------------------------------------------
    });

    this.finalize($container, treeOptions);

    this.initToolbar();

    /* global EventFilter */
    this.eventFilter = new EventFilter();

    // Collect events and log them in groups. Useful for:
    // - Pause mode -- save all events until play mode is on again
    // - Grouping events that occurred at the same time together
    this.batchedEvents = [];
  }

  renderColumns(viewNode) {
    const $tdList = $(viewNode.tr).find('>td'),
      automationData = viewNode.data.automationData;

    const applyFilter = (node, isParent) => {
      const isMatch = !this.filterFn || this.filterFn(node);
      node.match = isMatch;
      const matchClasses = isParent ? 'fancytree-match fancytree-submatch' :
        'fancytree-match';
      $(node.tr)
        .toggleClass(matchClasses, isMatch)
        .toggleClass('fancytree-hide', !isMatch);
    };

    // After first item logged, automatically apply current
    // filter to new items
    // This is much better than using the filter extension's autoApply
    // which applies to the entire tree on each append!
    applyFilter(viewNode, true);
    if (viewNode.children) {
      viewNode.children.forEach(applyFilter);
    }

    if (!automationData || automationData.isSummary) {
      // Summary event
      $tdList.eq(0)
        .attr('colspan', $tdList.length)
        .nextAll().remove();
      return;
    }

    // (Column #0 is rendered by fancytree adding the title)

    // Column 1: role
    $tdList.eq(1)
      .text(automationData.node.role);
    // Column 2: state
    $tdList.eq(2)
      .text(Tree.formatStateForTreeGrid(automationData.node.state));

    // Column 3: name
    const name = automationData.node.name;
    if (typeof name === 'undefined') {
      // Show difference between undefined and ''
      $tdList.eq(3)
        .text('')
        .addClass('name-undefined');
    }
    else {
      $tdList.eq(3)
        .text(name);
    }
  }

  onActivate(automationData) {
    // When an event is activated, activate the corresponding node
    // for the event in the node tree
    // TODO this is a bit spaghetti-ish, we should probably
    // have an event that fires and is listened to. This code shouldn't
    // know about the node tree.
    window.nodeTree.clearHighlights();

    if (!automationData || automationData.isSummary) {
      // No related node information available
      this.selectAllEventsForAutomationNode(-1);  // Deselect all
      return;
    }

    // Highlight useful information in other panels, related to event
    const automationNode = automationData.node;
    const automationNodeKey = automationNode.key;
    // Show the current automation node in the automation node tree,
    // expanding parents if necessary
    window.nodeTree.activate(automationNodeKey,
      { noEvents: true });
    // Show the properties for the current node in the property view
    window.propsTree.showProps(automationNode, ' (event data)');
    // Highlight related events
    this.selectAllEventsForAutomationNode(automationNodeKey);
    // Highlight related property changes for nodeChanged tree changes
    window.nodeTree.highlightNodeDiff(automationNode,
      automationData.diff, true);
  }

  initToolbar() {
    $('#toolbar-play-pause').on('click', () => {
      this.togglePlayPauseState();
    });
    $('#event-clear').on('click', () => {
      this.clearAll();
    });

    $(document).on('keydown', (evt) => {
      // Ctrl+P play/pause events and tree changes
      if (evt.keyCode === 'P'.charCodeAt(0) && event.ctrlKey &&
        !event.shiftKey & !event.metaKey && !event.altKey) {
        evt.preventDefault();
        this.togglePlayPauseState();
      }
      // Ctrl+Shift+C clear
      if (evt.keyCode === 'C'.charCodeAt(0) && event.ctrlKey &&
        event.shiftKey & !event.metaKey && !event.altKey) {
        evt.preventDefault();
        this.clearAll();
      }
    });
  }

  togglePlayPauseState() {
    this.isPaused = !this.isPaused;
    const verb = this.isPaused ? 'Play' : 'Pause';
    $('#toolbar-play-pause')
      .attr('aria-label', verb)
      .attr('title', verb + ' events and tree changes (Ctrl+P)')
      .text(this.isPaused ? '\u25B6': '||');

    if (!this.isPaused) {
      this.onBatchEnd();
    }
  }

  formatEventType(event) {
    const type = event.type;
    if (event.isUser) {
      return type + ' [user]';
    }
    else if (event.isTreeChange) {
      return type + ' [tree]';
    }
    return type;  // The rest are 'page', don't show anything special
  }

  formatTitleForTreeGrid(event) {
    return this.formatEventType(event);
  }

  getTextForSearch(event) {
    return this.formatEventType(event) + '  ' + event.node.role + '  ' +
       Tree.getStateText(event.node.state) +
          '  ' + event.node.name;
  }

  toTreeData(event) {
    return {
      title: this.formatTitleForTreeGrid(event),
      automationData: event,
      key: event.key
    };
  }

  // Using selection mechnism to colorize related events ot given
  // automation node
  selectAllEventsForAutomationNode(automationNodeKey) {
    this.getViewRootNode().visit((eventNode) => {
      const eventData = eventNode.data.automationData;
      eventNode.setSelected(eventData && !eventData.isSummary &&
        eventData.node.key === automationNodeKey);
    });
  }

  // For a group of event, get an event that is the most meaningful summary,
  // for example a click (as opposed to all the other events that occured as
  // a result of the click)
  // Because of problems with Automation's event order, the meaningful event
  // is often in the middle of the group.
  getSummarizingEvent(events) {
    const eventGroupSummaryUsefulness = {
      // How meaningful is the event for summarizing a group of events?
      // Smaller numbers are better.
      // 1 = primary user input event
      // 1.5 = secondary user input event
      // 2 = semantic event
      // 3 = mutation events
      // 4 = last resort event
      'activedescendantchanged': 1,
      'ariaAttributeChanged': 3,
      'alert': 2,
      'autocorrectionOccured': 2,
      'blur': 1.4, // Not quite as good as focus
      'checkedStateChanged': 2,
      'childrenChanged': 3.6, // Last resort, shows up almost every time
      'clicked': 1,
      'documentSelectionChanged': 2,
      'expandedChanged': 2,
      'focus': 1.3, // Not quite as good as mouse events
      'imageFrameUpdated': 3,
      'hide': 3,
      'hover': 1.1,
      'invalidStatusChanged': 2,
      'liveRegionCreated': 3,
      'liveRegionChanged': 3,
      'loadComplete': 3.5,
      'locationChanged': 3,
      'layoutComplete': 4, // Last resort, shows up almost every time
      'mediaStartedPlaying': 2,
      'mediaStoppedPlaying': 2,
      'menuEnd': 2,
      'menuListItemSelected': 2,
      'menuListValueChanged': 2,
      'menuPopupEnd': 2,
      'menuPopupStart': 2,
      'menuStart': 2,
      'mouseCanceled' : 1.2,
      'mouseDragged': 1.2,
      'mouseMoved': 1.2,
      'mousePressed': 1.2,
      'mouseReleased': 1.2,
      'rowCollapsed': 2,
      'rowCountChanged': 2,
      'rowExpanded': 2,
      'scrollPositionChanged': 3,
      'scrolledToAnchor': 2,
      'selectedChildrenChanged': 2,
      'selection': 2,
      'selectionAdd': 2,
      'selectionRemove': 2,
      'show': 2,
      'textChanged': 2,  // TODO why is this both an event and treeChange?
      'textSelectionChanged': 2,
      'treeChanged': 4, // TODO How is this different from other tree changes?
      'valueChanged': 1.5,
      // tree-changes only:
      'nodeCreated': 4,
      'subtreeCreated': 4,
      'nodeChanged': 4,
      'nodeRemoved': 4
    };

    const DEFAULT_SCORE = 1;
    let topScore = 9,
      topEvent;
    for (let event of events) {
      const type = event.type;
      let score = eventGroupSummaryUsefulness[type];
      if (!score) {
        score = DEFAULT_SCORE;
        console.info('Unknown event: ', type);
      }
      if (score < topScore) {
        topScore = score;
        topEvent = event;
      }
    }

    return topEvent;
  }

  // Keep scroll at bottom if already there and not focused on a log item
  keepBottomScroll() {
    if (!this.tree.hasFocus()) {
      // Scroll to end unless user is interacting with the list
      this.$container.scrollTop(this.$container[0].scrollHeight);
    }
  }

  // It's been a little while since the last event: consider this batch complete
  onBatchEnd() {
    this.logEventBatch(this.batchedEvents);
    const changeEvts = this.batchedEvents.filter((event) => event.isTreeChange);
    // TODO this is a bit spaghetti-ish, we should probably
    // have an event that fires and is listened to. This code shouldn't
    // know about the node tree.
    window.nodeTree.processTreeChanges(changeEvts);
    this.batchedEvents = [];
  }

  logEventBatch(events) {
    const treeDataToAdd = events.map((event) => {
      return this.toTreeData(event);
    });
    const summarizingEvent = this.getSummarizingEvent(events);
    const summarizingId = summarizingEvent.node.htmlAttributes &&
      summarizingEvent.node.htmlAttributes.id;
    const summarizingName = summarizingEvent.node.name;
    const summaryKey = events[0].key - 0.5;

    this.getViewRootNode().addChildren( {
      title: 'Summary: ' + summarizingEvent.type + ' on ' +
        summarizingEvent.node.role +
        (summarizingId ? ' #' + summarizingId : '') +
        (summarizingName ? ' "' + summarizingName.substr(0,50) + '"' : ''),
      automationData: {
        isSummary: true,
        type: summarizingEvent.type,
        key: summaryKey,
        node: summarizingEvent.node
      },
      key: events[0].key - 0.5,
      children: treeDataToAdd
    });

    // Bug in filter extension causes newly added children to be unmatched by
    // default, so that they don't show up unless we refilter the whole tree
    if (!this.tree.hasFocus()) {
      setTimeout(() => this.keepBottomScroll(), 0);
    }

    // Try to keep event logging down -- remove first group in log
    // if we get over MAX_LOG_GROUPS, unless that group is active.
    if (++ this.logCounter >= this.MAX_LOG_GROUPS) {
      const firstChild = this.tree.rootNode.getFirstChild();
      const activeNode = this.tree.activeNode;
      if (activeNode && activeNode !== firstChild &&
        activeNode.parent !== firstChild) {
        this.getViewRootNode().getFirstChild().remove();
      }
    }
  }

  addEventToCurrentBatch(event) {
    clearTimeout(this.addEventToCurrentBatch.timer);
    this.batchedEvents.push(event);

    if (!this.isPaused) {
      this.addEventToCurrentBatch.timer = setTimeout(() => { this.onBatchEnd(); }, 50);
    }
  }
}

window.eventTree = new EventTree();
