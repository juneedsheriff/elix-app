/**
 * Generates PNG PWA icons from public/icons/icon.svg (requires sharp).
 * Run: node scripts/generate-pwa-icons.mjs
 */
import { readFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');
const outDir = join(root, 'public', 'icons');
const sources = [
  { file: 'icon.svg', outputs: [192, 512] },
  { file: 'icon-maskable.svg', outputs: [{ name: 'icon-maskable-512.png', size: 512 }] }
];

let sharp;
try {
  sharp = (await import('sharp')).default;
} catch {
  console.error('Install sharp first: npm install -D sharp');
  process.exit(1);
}

for (const { file, outputs } of sources) {
  const svgPath = join(outDir, file);
  if (!existsSync(svgPath)) {
    console.error('Missing', svgPath);
    process.exit(1);
  }
  const svg = readFileSync(svgPath);
  for (const outSpec of outputs) {
    const size = typeof outSpec === 'number' ? outSpec : outSpec.size;
    const name = typeof outSpec === 'number' ? `icon-${outSpec}.png` : outSpec.name;
    const out = join(outDir, name);
    await sharp(svg).resize(size, size).png().toFile(out);
    console.log('Wrote', out);
  }
}
