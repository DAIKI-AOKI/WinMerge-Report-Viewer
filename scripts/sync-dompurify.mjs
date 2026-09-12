import { copyFileSync, existsSync, mkdirSync } from 'node:fs';

const source = 'node_modules/dompurify/dist/purify.es.mjs';
const destination = 'js/vendor/purify.es.js';

if (!existsSync(source)) {
    throw new Error(`DOMPurify bundle not found: ${source}. Run npm ci first.`);
}

mkdirSync('js/vendor', { recursive: true });
copyFileSync(source, destination);
console.log(`Synchronized ${source} -> ${destination}`);
