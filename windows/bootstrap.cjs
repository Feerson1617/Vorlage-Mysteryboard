'use strict';
const { app } = require('electron');
if (process.platform !== 'win32') throw Error('Windows-only bootstrap');
const { squirrelEvent } = require('./squirrel.cjs');
if (!squirrelEvent(process.argv, process.execPath, require('node:child_process').spawn, () => app.quit())) {
  require('../studio/electron/main.cjs');
}
