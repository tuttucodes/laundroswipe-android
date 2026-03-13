// Generate config/env.js from environment variables (for Vercel or local use)
// Usage:
//   SUPABASE_URL=... SUPABASE_ANON_KEY=... node scripts/generate-env.js

const fs = require('fs');
const path = require('path');

const SUPA_URL = process.env.SUPABASE_URL || '';
const SUPA_KEY = process.env.SUPABASE_ANON_KEY || '';

if (!SUPA_URL || !SUPA_KEY) {
  console.warn('Missing SUPABASE_URL or SUPABASE_ANON_KEY. Writing placeholder so the app still loads.');
}

const out = `
// AUTO-GENERATED FILE. Do not edit directly.
window.__LS_CONFIG__ = {
  SUPA_URL: '${(SUPA_URL || '').replace(/'/g, "\\'")}',
  SUPA_KEY: '${(SUPA_KEY || '').replace(/'/g, "\\'")}',
};
`.trimStart();

const targetPath = path.join(__dirname, '..', 'config', 'env.js');
fs.writeFileSync(targetPath, out, 'utf8');
console.log(`Wrote ${targetPath}`);

