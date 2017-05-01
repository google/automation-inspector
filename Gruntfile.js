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

/* global module */
module.exports = function(grunt) {

  // Project configuration.
  const COMMON_SOURCE = [
    'html/**/*',
    'css/**/*',
    'js/server/**/*',
    'js/client/**/*',
    'images/**/*'
  ];

  const BOWER_OPTIONS = {
    keepExpandedHierarchy: false,
    packageSpecific: {
      'fancytree-fast-addChildren': {
        files: [
          'dist/src/jquery.fancytree.js',
          'dist/src/jquery.fancytree.filter.js',
          'dist/src/jquery.fancytree.table.js',
          'dist/skin-win8/ui.fancytree.css',
          'dist/skin-win8/*.gif',
        ]
      },
    }
  };

  grunt.initConfig({
    pkg: grunt.file.readJSON('package.json'),
    clean: [ 'build' ],
    copy: {
      app: {
        files: [
          { src: COMMON_SOURCE, dest: 'build/app/' },
          { src: 'js/app/*.js', dest: 'build/app/' },
          { src: ['app/manifest.json'], dest: 'build/' },
        ]
      },
      extension: {
        files: [
          { src: COMMON_SOURCE, dest: 'build/extension/' },
          { src: 'js/extension/*.js', dest: 'build/extension/' },
          { src: ['extension/manifest.json'], dest: 'build/' },
        ]
      }
    },
    watch: {
      // TODO split into separate watch tasks for app/extension,
      // but it doesn't really matter, may as well do everything on any change
      all: {
        files: COMMON_SOURCE.concat([
          'js/app/**/*',
          'app/manifest.json',
          'js/extension/**/*',
          'extension/manifest.json'
        ]),
        tasks: ['app', 'extension'],
        options: {
          spawn: false
        },
      }
    },
    bower: {
      app: {
        dest: 'build/app/third_party/',
        options: BOWER_OPTIONS
      },
      extension: {
        dest: 'build/extension/third_party/',
        options: BOWER_OPTIONS
      }
    }
  });

  grunt.loadNpmTasks('grunt-contrib-copy');
  grunt.loadNpmTasks('grunt-contrib-clean');
  grunt.loadNpmTasks('grunt-contrib-watch');
  grunt.loadNpmTasks('grunt-bower');

  grunt.registerTask('app', ['copy:app', 'bower:app']);
  grunt.registerTask('extension', ['copy:extension', 'bower:extension']);
  grunt.registerTask('default', ['clean', 'extension', 'app']);

};
