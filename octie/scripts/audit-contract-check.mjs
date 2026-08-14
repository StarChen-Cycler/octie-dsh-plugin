// Audit helper: verify the octie-dsh bundle contract (Pass 2).
import { createRequire } from 'node:module';

const require = createRequire('file:///I:/ai-automation-projects/octie-dsh-plugin/octie/package.json');
const p = require('I:/ai-automation-projects/octie-dsh-plugin/octie/package.json');
console.log('dsh.bundle.patch:', p.dsh && p.dsh.bundle && p.dsh.bundle.patch);
console.log('main:', p.main);
console.log('exports:', Object.keys(p.exports || {}).join(','));

const mod = await import('file:///I:/ai-automation-projects/octie-dsh-plugin/octie/plugin/index.mjs');
console.log('plugin name:', mod.name);
console.log('plugin inject:', JSON.stringify(mod.inject));
console.log('plugin apply:', typeof mod.apply);
console.log('TOOL_NAMES count:', mod.TOOL_NAMES.length);
console.log('TOOL_NAMES:', mod.TOOL_NAMES.join(','));
