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

// Common code for the node and event filters

// Base class for filters
/* exported Filter */

class Filter {

  // Return parsed regex
  // Input match: string in format of
  // regex/, /regex/g, /regex/i, /regex/gi, etc.
  // The presence or lack /g doesn't do anything, but we accept it
  // Output { text, flags } or undefined
  static getRegEx(match) {
    const trimmed = match.trim();
    if (trimmed.charAt(0) === '/') {
      const lastSlash = trimmed.lastIndexOf('/'),
        flags = trimmed.substr(lastSlash + 1),
        text = trimmed.substr(1,lastSlash - 1);

      if (text && (!flags || flags === 'g' || flags === 'i' ||
        flags === 'gi' || flags === 'ig')) {
        return { text, flags };
      }
    }
  }
}

