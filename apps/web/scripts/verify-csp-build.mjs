import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const indexUrl = new URL('../../../dist/apps/web/browser/index.html', import.meta.url);
const html = await readFile(fileURLToPath(indexUrl), 'utf8');

const inlineEventHandler = /\son[a-z]+\s*=/i.exec(html);

if (inlineEventHandler) {
  throw new Error(
    `CSP verification failed: generated index.html contains ${inlineEventHandler[0].trim()}`,
  );
}

console.log('CSP verification passed: no inline event handlers in generated index.html.');
