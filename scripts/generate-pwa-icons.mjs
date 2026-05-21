/**
 * Generates PWA icons from public/icons/elix-logo-source.png (requires sharp).
 * Run: npm run icons:generate
 */
import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');
const outDir = join(root, 'public', 'icons');
const sourcePath = join(outDir, 'elix-logo-source.png');

const BRAND_BG = { r: 0, g: 0, b: 0, alpha: 1 };

let sharp;
try {
  sharp = (await import('sharp')).default;
} catch {
  console.error('Install sharp first: npm install -D sharp');
  process.exit(1);
}

if (!existsSync(sourcePath)) {
  console.error('Missing logo source:', sourcePath);
  console.error('Add public/icons/elix-logo-source.png (Elix wordmark on black).');
  process.exit(1);
}

/** Wordmark for light UI — knocks out near-black pixels from the source asset. */
async function writeTransparentWordmark() {
  const BLACK_THRESHOLD = 40;
  const { data, info } = await sharp(sourcePath).ensureAlpha().raw().toBuffer({ resolveWithObject: true });

  for (let i = 0; i < data.length; i += 4) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    if (r <= BLACK_THRESHOLD && g <= BLACK_THRESHOLD && b <= BLACK_THRESHOLD) {
      data[i + 3] = 0;
    }
  }

  const out = join(outDir, 'elix-logo-transparent.png');
  await sharp(data, {
    raw: { width: info.width, height: info.height, channels: 4 }
  })
    .png()
    .toFile(out);
  console.log('Wrote', out);
}

async function renderSquareIcon(size, { maskable = false, filename }) {
  const inset = maskable ? 0.2 : 0.1;
  const maxSide = Math.round(size * (1 - inset * 2));

  const logo = await sharp(sourcePath)
    .resize(maxSide, maxSide, { fit: 'inside' })
    .png()
    .toBuffer();

  const meta = await sharp(logo).metadata();
  const left = Math.max(0, Math.round((size - (meta.width ?? size)) / 2));
  const top = Math.max(0, Math.round((size - (meta.height ?? size)) / 2));

  const out = join(outDir, filename);
  await sharp({
    create: {
      width: size,
      height: size,
      channels: 4,
      background: BRAND_BG
    }
  })
    .composite([{ input: logo, left, top }])
    .png()
    .toFile(out);

  console.log('Wrote', out);
}

await writeTransparentWordmark();

await renderSquareIcon(32, { filename: 'favicon-32.png' });
await renderSquareIcon(180, { filename: 'apple-touch-icon.png' });
await renderSquareIcon(192, { filename: 'icon-192.png' });
await renderSquareIcon(512, { filename: 'icon-512.png' });
await renderSquareIcon(512, { maskable: true, filename: 'icon-maskable-512.png' });
