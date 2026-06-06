#!/usr/bin/env node
'use strict';

const { spawn } = require('node:child_process');
const path = require('node:path');

const cliPath = path.join(__dirname, '..', 'dist', 'cli', 'index.js');
const child = spawn(process.execPath, [cliPath, ...process.argv.slice(2)], {
  stdio: 'inherit',
  cwd: process.cwd(),
});

child.on('exit', (code) => {
  process.exit(code || 0);
});
