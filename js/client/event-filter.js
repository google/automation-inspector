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

// Implement the filter field for the event pane, supporting:
// - plain text to search visible text in the node tree
// - regex to search visible text in the node tree


/* exported EventFilter */
/* global Filter */

class EventFilter extends Filter {

  clearFilter() {
    $('#event-filter-num-matches').text('');
    window.eventTree.clearFilter();
    this.clearFilterTimer();
  }

  clearFilterTimer () {
    if (this.filterTimer) {
      clearTimeout(this.filterTimer);
      this.filterTimer = 0;
    }
  }

  onControllerUpdate(doWait) {
    this.clearFilterTimer();

    if (doWait) {
      // Try to be very fast when in the middle of typing, wait
      // 3 seconds after typing finishes before attempting to filter
      this.filterTimer = setTimeout(() => { this.doUpdateFilter(true); }, 300);
    }
    else {
      // First typing character in a while -- show results immediately
      // to make UI feel more responsive (not sure if we want to keep this)
      this.doUpdateFilter(true);
    }
  }

  // Return Regex as actual JS RegExp object
  getRegEx(match) {
    const regex = Filter.getRegEx(match);
    if (regex) {
      return new RegExp(regex.text, regex.flags);
    }
  }

  doUpdateFilter() {
    const
      match = $('#event-filter-input').val().trim(),
      doShowUnmatched = $('#event-filter-show-unmatched').is(':checked'),
      doHideTreeChanges = $('#event-filter-tree-changes').is(':checked');

    if (match === '' && !doHideTreeChanges) {
      this.clearFilter();
      return;  // Nothing to filter
    }

    const opts = {
      mode: doShowUnmatched ? 'dimm' : 'hide',
      autoExpand: match !== ''
    };
    const regex = this.getRegEx(match);
    const getText = (eventNode) => {
      return window.eventTree.getTextForSearch(eventNode.data.automationData);
    };

    // Four possibilities
    const filterFn =
      doHideTreeChanges ? (
        // Show tree changes
        // Hide tree changes
        regex ?
          (eventNode) => {
            return !eventNode.data.automationData.isTreeChange &&
              regex.test(getText(eventNode));
          } :
          (eventNode) => {
            return !eventNode.data.automationData.isTreeChange &&
              getText(eventNode).includes(match);
          }
        ) : (
        regex ?
          (eventNode) => {
            return eventNode.data.automationData.isSummary ||
              regex.test(getText(eventNode));
          } :
          (eventNode) => {
            return eventNode.data.automationData.isSummary ||
              getText(eventNode).includes(match);
          }
        );

    window.eventTree.filter(filterFn, opts);
    this.onShowUnmatchedToggle();
  }

  // Hacky but fast way to toggle showing/hiding of unmatched events
  onShowUnmatchedToggle() {
    // this.onControllerUpdate();  // Slow way
    const doShowUnmatched = $('#event-filter-show-unmatched').is(':checked');
    window.eventTree.$container
      .removeClass('fancytree-ext-filter-dimm fancytree-ext-filter-hide')
      .addClass(doShowUnmatched ? 'fancytree-ext-filter-dimm' : 'fancytree-ext-filter-hide');
  }

  constructor() {
    super();
    $(document).ready(() => {
      $('#event-filter-input')
        .on('keyup', () => {
          this.onControllerUpdate(Boolean(this.filterTimer));
        })
        .on('keydown', (evt) => {
          if (evt.keyCode === 27 /* Escape */) {
            $(evt.target).val('');
          }
        });

      $('#event-filter-tree-changes')
        .on('click', () => { this.onControllerUpdate(); });

      $('#event-filter-show-unmatched')
        .on('click', () => { this.doUpdateFilter(); });

      $('#event-filter-reset')
        .on('click', () => {
          $('#event-filter-input').val('');
          this.onControllerUpdate();
        });

      $(document).on('keydown', (evt) => {
        // Ctrl+Shift+F focus textbox
        if (evt.keyCode === 'F'.charCodeAt(0) && event.ctrlKey &&
          event.shiftKey & !event.metaKey && !event.altKey) {
          evt.preventDefault();
          $('#event-filter-input').focus();
        }
        // Ctrl+Shift+R toggle checkbox
        if (evt.keyCode === 'T'.charCodeAt(0) && event.ctrlKey &&
          event.shiftKey & !event.metaKey && !event.altKey) {
          evt.preventDefault();
          $('#event-filter-tree-changes').click();
        }
        // Ctrl+Shift+S toggle checkbox
        if (evt.keyCode === 'S'.charCodeAt(0) && event.ctrlKey &&
          event.shiftKey & !event.metaKey && !event.altKey) {
          evt.preventDefault();
          $('#event-filter-show-unmatched').click();
        }
      });
    });
  }
}

