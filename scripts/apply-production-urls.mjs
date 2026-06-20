/**
 * Sets Supabase Auth Site URL + redirect allow list for production.
 *
 *   npm run db:apply-production-urls
 *
 * Env (.env.local):
 *   SUPABASE_ACCESS_TOKEN=sbp_...
 *   PRODUCTION_APP_URL=https://app.elixclinix.com   (optional override)
 *   SITE_URL=...          (optional, defaults to PRODUCTION_APP_URL)
 *   URI_ALLOW_LIST=...    (optional, auto-built if omitted)
 */
import { readFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');
const projectRef = 'juwlzcxlekqttpdqqijv';
const defaultProductionUrl = 'https://app.elixclinix.com';

function loadEnvFile(relativePath) {
  const path = join(root, relativePath);
  if (!existsSync(path)) return;
  for (const line of readFileSync(path, 'utf8').split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    if (!(key in process.env)) process.env[key] = value;
  }
}

loadEnvFile('.env.server.local');
loadEnvFile('.env.local');

const accessToken = process.env.SUPABASE_ACCESS_TOKEN?.trim();
const productionUrl = (
  process.env.PRODUCTION_APP_URL ??
  process.env.SITE_URL ??
  defaultProductionUrl
)
  .trim()
  .replace(/\/$/, '');

const uriAllowList =
  process.env.URI_ALLOW_LIST?.trim() ||
  [
    `${productionUrl}/**`,
    'http://localhost:3000/**'
  ].join(',');

async function managementFetch(path, init = {}) {
  const response = await fetch(`https://api.supabase.com/v1/projects/${projectRef}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
      ...(init.headers ?? {})
    }
  });
  const text = await response.text();
  let body;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = text;
  }
  if (!response.ok) {
    throw new Error(typeof body === 'object' && body?.message ? body.message : text || `HTTP ${response.status}`);
  }
  return body;
}

if (!accessToken) {
  console.error('Missing SUPABASE_ACCESS_TOKEN in .env.local');
  process.exit(1);
}

console.log('Updating Supabase Auth URL configuration…');
console.log(`  Site URL: ${productionUrl}`);
console.log(`  Redirect allow list: ${uriAllowList}`);

try {
  const before = await managementFetch('/config/auth', { method: 'GET' });
  console.log(`  Previous site URL: ${before.site_url}`);

  const after = await managementFetch('/config/auth', {
    method: 'PATCH',
    body: JSON.stringify({
      site_url: productionUrl,
      uri_allow_list: uriAllowList
    })
  });

  console.log('Applied production Auth URLs.');
  console.log(`  site_url: ${after.site_url}`);
  console.log(`  uri_allow_list: ${after.uri_allow_list}`);
} catch (error) {
  console.error('Failed:', error.message);
  process.exit(1);
}
