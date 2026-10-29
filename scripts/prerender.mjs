import { readFile, writeFile } from 'node:fs/promises';
import { render } from '../.prerender/entry-server.js';
const template = await readFile('dist/index.html', 'utf8');
await writeFile('dist/index.html', template.replace('<!--app-html-->', render()));
console.log('Prerendered the full portfolio: content remains readable without JavaScript.');
