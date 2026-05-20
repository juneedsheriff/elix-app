/**
 * Generates PNG PWA icons from public/icons/icon.svg (requires sharp).
 * Run: node scripts/generate-pwa-icons.mjs
 */
import { readFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');
const svgPath = join(root, 'public', 'icons', 'icon.svg');
const outDir = join(root, 'public', 'icons');

let sharp;
try {
  sharp = (await import('sharp')).default;
} catch {
  console.error('Install sharp first: npm install -D sharp');
  process.exit(1);
}

if (!existsSync(svgPath)) {
  console.error('Missing', svgPath);
  process.exit(1);
}

const svg = readFileSync(svgPath);

for (const size of [192, 512]) {
  const out = join(outDir, `icon-${size}.png`);
  await sharp(svg).resize(size, size).png().toFile(out);
  console.log('Wrote', out);
}
