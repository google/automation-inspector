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

/* exported NodeFilter */
/* global Filter */

class NodeFilter extends Filter {

  clearFilter() {
    this.lastGoodJobId = (this.lastGoodJobId || 0) + 1;
    const waitUntilReady = this.currentFilterJob || Promise.resolve();
    waitUntilReady
      .then(() => {
        window.nodeTree.clearFilter();
        this.currentFilterJob = null;
      });
  }

  // A new subtree has been inserted, run the filter on it
  runOnSubtree(subtreeKey) {
    if (this.isFilterEnabled()) {
      const viewNode = window.nodeTree.getViewNodeByKey(subtreeKey);
      // Update an existing filter result
      this.runFilter(subtreeKey, viewNode);
    }
  }

  isFilterEnabled() {
    return window.nodeTree.tree.enableFilter;
  }

  enableFilter() {
    window.nodeTree.tree.enableFilter = true;
  }

  // runOnNode(nodeKey) {
    // TODO -- just use matches() ?
  // }

  onFilterUpdated() {
    const matchText = $('#node-filter-input').val();

    if (matchText) {
      const key = window.nodeTree.getDocumentNodeKey();
      const viewNode = window.nodeTree.getViewRootNode();

      // --- Init new manual filter ---
      // For performance reasons, we implement the filter manually
      this.enableFilter();

      // --- Manually set new filter classes ---
      // Tree: set filter options
      // These classes are usually set by the filter extension,
      // but we must set them since we filter nodes manually
      const doShowUnmatched = $('#node-filter-show-unmatched').is(':checked');
      window.nodeTree.$container
        .addClass('fancytree-ext-filter fancytree-ext-filter-' +
          (doShowUnmatched ? 'dimm' : 'hide'));

      // -- Run the filter
      this.runFilter(key, viewNode, true);
    }
    else {
      this.clearFilter();
    }
  }

  runFilter(subtreeKey, subtreeViewNode, isNew) {
    const
      match = $('#node-filter-input').val(),
      trimmedMatch = match.trim();

    const clearMatches = () => {
      if (checkCancelled() || !isNew) {
        return;
      }
      // -- Manually clear match data and classes --
      subtreeViewNode.visit((node) => {
        delete node.match;
        delete node.subMatchCount;
      }, true);
    };

    const findMatches = () =>
      !checkCancelled() &&
      this.getFindMatchesPromise(subtreeKey, match, trimmedMatch);

    const showMatches = (matches) => {
      if (checkCancelled()) {
        return;
      }
      if (isNew) {
        this.showNumMatches(matches.length);
      }
      const expandParams = {
        noAnimation: true,
        noEvents: true,
        scrollIntoView: false
      };
      return window.nodeTree.expandAndShow(matches, expandParams,
        markMatched, checkCancelled);
    };

    const onFilterComplete = () => {
      if (!checkCancelled()) {
        // -- Manually render all  --
        subtreeViewNode.visit((node) => {
          if (!node.match && !node.subMatchCount) {
            node.addClass('fancytree-hide');
          }
        });
        // All find operations complete
        this.currentFilterJob = null;
      }
    };

    const renderFindStatus = (node) => {
      $(node.tr)
        .toggleClass('fancytree-match', !!node.match)
        .toggleClass('fancytree-submatch', !!node.subMatchCount)
        .toggleClass('fancytree-hide', !node.match && !node.subMatchCount);
    };

    const markMatched = (node) => {
      node.match = true;
      renderFindStatus(node);
      while ((node = node.parent)) {
        node.subMatchCount = 1; // We don't actually care how many
        renderFindStatus(node);
      }
    };

    const checkCancelled = () => {
      return currentJobId !== this.lastGoodJobId;
    };

    if (isNew) {
      // Increment job id if previous filters should be cancelled by this
      this.lastGoodJobId = (this.lastGoodJobId || 0) + 1;
    }
    const currentJobId = this.lastGoodJobId;
    const cancelledFilterJob = this.currentFilterJob || Promise.resolve();

    this.currentFilterJob = cancelledFilterJob
      .then(clearMatches)
      .then(findMatches)
      .then(showMatches)
      .then(onFilterComplete);

    return this.currentFilterJob;
  }

  showNumMatches(numMatches) {
    $('#node-filter-num-matches')
      .text(' (' + numMatches + (numMatches === 1 ? ' match)' : ' matches)'));
  }

  // Get a promise to find all matching keys
  getFindMatchesPromise(key, match, trimmedMatch) {
    return this.getJsonFindPromise(key, trimmedMatch) || // { FindParams }
      this.getDomQueryPromise(key, trimmedMatch) ||  // $(selector)
      this.getRegexFindPromise(key, this.getRegEx(match));  // Plain text or /regex/
  }

  // Return regex as object
  getRegEx(match) {
    const explicitRegex = Filter.getRegEx(match);
    // User specified search using /regex/ format
    if (explicitRegex) {
      return explicitRegex;
    }
    // Convert text to regex format
    const convertPlainTextToRegexSearch = (text) =>
      text.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, '\\$&');
    return { regex: convertPlainTextToRegexSearch(match), flags: 'g' };
  }

  // Return a promise to all the find results for a regex
  getRegexFindPromise(key, regex) {
    const regExpObj = new RegExp(regex.regex, regex.flags);
    const regExpFilter = (val) => val.match(regExpObj);
    // Get FindParams for all matching roles
    const roleFindParams =
      window.client.getAllRoles()
        .filter(regExpFilter)
        .map((role) => { return { role }; });
    // Get FindParams for all matching states
    const stateFindParams =
      window.client.getAllStates()
        .filter(regExpFilter)
        .map((state) => {
          const retVal = { state: { } };
          retVal.state[state] = true; // E.g. { state: { busy: true }}
          return retVal;
        });
    // The FindParams for names can handle the regex directly
    const nameFindParams =
      { attributes: { name : regex } };
    // All FindParams in a single array
    const allFindParams =
      roleFindParams
        .concat(stateFindParams)
        .concat(nameFindParams);
    // Array of promises to find results
    const allFindPromises =
      allFindParams.map((findParams) => this.find('findAll', findParams, key));

    return Promise.all(allFindPromises)
      .then((allResultSets) => {
        // Concat to set of unique keys
        const resultKeys = new Set();
        for (let resultSet of allResultSets) {
          for (let result of resultSet) {
            resultKeys.add(result);
          }
        }
        // Convert back to array
        return Array.from(resultKeys);
      });
  }

  getJsonFindPromise(key, trimmedMatch) {
    // Return a parsed object if the string was legal JSON
    // TODO allow JSON to be constructed via options dialog
    function getJsonFind(match) {
      if (match.charAt(0) === '{') {
        // Examples:
        // {"htmlAttributes":{"id":"foo"}}
        // {"htmlAttributes":{"htmlTag":"p"}}
        // {"role":"paragraph"}
        try {
          return JSON.parse(match);
        }
        catch(ex) {
          // Do nothing with exception
        }
      }
    }
    const json = getJsonFind(trimmedMatch);
    return json && this.find('findAll', json, key);
  }

  // If user input is in $() or $('') format, use it to
  // return the requested selector as a string
  getDomQueryPromise(key, trimmed) {
    function getDomQuery() {
      if (!trimmed.startsWith('$(') || !trimmed.endsWith(')')) {
        return;
      }
      const dollarRemoved = trimmed.substring(2, trimmed.length - 1);
      const firstChar = dollarRemoved.charAt(0);
      if (firstChar === '"' || firstChar === '\'') {
        if (dollarRemoved.endsWith(firstChar)) {
          return dollarRemoved.substring(1, dollarRemoved.length - 1);
        }
      }
      return dollarRemoved;
    }

    const domQuery = getDomQuery();
    return domQuery && this.find('domQuerySelector', domQuery, key);
  }

  // Try searching using query selector or JSON FindParams
  find(functionName, props, key) {
    const functionCallParams = {
      type: 'call',
      key,
      functionName,
      props
    };
    return window.client.sendMessage(functionCallParams)
      .then((response) => {
        if (!response) {
          // Null response
          return [];
        }
        if (response.key) {
          // Single object response
          return [ response.key ];
        }
        if (Array.isArray(response) && response[0] && response[0].key) {
          // Array of objects in response
          return response.map((item) => item.key);
        }
        console.error('Should not reach this line');
        return [];
      });
  }

  // TODO Remove once we're sure we no longer need this
  // // Begin incrementally loading tree. We do this when a brute force
  // // search as used (text or regex currently)
  // ensureLoadAll() {
  //   const queue = [ window.nodeTree.getViewRootNode() ];

  //   const loadSubtree = (startNode) => {
  //     startNode.visit((node) => {
  //       if (!node.isLoaded()) {
  //         queue.push(node);
  //       }
  //     });
  //   };

  //   const checkQueue = () => {
  //     if (queue.length) {
  //       const nextItem = queue.shift();
  //       const itemReady = nextItem.isLoaded() ?
  //         Promise.resolve() :
  //         nextItem.load()
  //           .then(() => { this.setDirty(); } );

  //       itemReady
  //         .then(() => {
  //           loadSubtree(nextItem);
  //           setTimeout(checkQueue, 0);
  //         });
  //     }
  //   };

  //   if (!this.isLoading) {
  //     this.isLoading = true;
  //     checkQueue();
  //   }
  // }

  // Hacky but fast way to toggle showing/hiding of unmatched nodes
  onShowUnmatchedToggle() {
    const isCurrentFilterActive = Boolean($('#node-filter-input').val());
    if (!isCurrentFilterActive) {
      return;
    }
    const doShowUnmatched = $('#node-filter-show-unmatched').is(':checked');
    window.nodeTree.$container
      .removeClass('fancytree-ext-filter-dimm fancytree-ext-filter-hide')
      .addClass(doShowUnmatched ? 'fancytree-ext-filter-dimm' : 'fancytree-ext-filter-hide');
  }

  constructor() {
    super();
    $(document).ready(() => {
      $('#node-filter-input')
        .on('keyup', () => {
          const currFilterText = $('#node-filter-input').val();
          if (currFilterText !== this.lastFilterText) {
            this.onFilterUpdated();
          }
          this.lastFilterText = currFilterText;
        })
        .on('keydown', (evt) => {
          if (evt.keyCode === 27 /* Escape */) {
            $(evt.target).val('');
          }
        });

      $(document).on('keydown', (evt) => {
        // Ctrl+H toggle checkbox
        if (evt.keyCode === 'S'.charCodeAt(0) && event.ctrlKey &&
          !event.shiftKey & !event.metaKey && !event.altKey) {
          evt.preventDefault();
          $('#node-filter-show-unmatched').click();
        }
        // Ctrl+F focus textbox
        if (evt.keyCode === 'F'.charCodeAt(0) && event.ctrlKey &&
          !event.shiftKey & !event.metaKey && !event.altKey) {
          evt.preventDefault();
          $('#node-filter-input').focus();
        }
      });

      $('#node-filter-regex')
        .on('click', () => { this.onFilterUpdated(); });
      $('#node-filter-reset')
        .on('click', () => {
          $('#node-filter-input').val('');
          this.onFilterUpdated();
        });
      $('#node-filter-show-unmatched')
        .on('click', () => { this.onShowUnmatchedToggle(); });
    });
  }
}

