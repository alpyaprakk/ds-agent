import { build } from 'esbuild';
import { readFileSync, writeFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');

// 1. Bundle ui.ts -> inline JS string
const result = await build({
  entryPoints: [join(root, 'src/ui.ts')],
  bundle: true,
  write: false,
  target: 'es2017',
  platform: 'browser',
  minify: true,
});

const js = result.outputFiles[0].text;

// 2. Read the HTML template
const html = readFileSync(join(root, 'src/ui.html'), 'utf8');

// 3. Replace <script src="ui.js"></script> with inline <script>...</script>
const inlined = html.replace(
  '<script src="ui.js"></script>',
  `<script>${js}</script>`
);

// 4. Write final ui.html to dist
writeFileSync(join(root, 'dist/ui.html'), inlined);

console.log(`  dist/ui.html  ${(Buffer.byteLength(inlined) / 1024).toFixed(1)}kb (inlined)`);
