// Injects Supabase config into HTML files at build time. No separate env.js file
// is created, so keys are never exposed at a public URL like /config/env.js.
// Usage: SUPABASE_URL=... SUPABASE_ANON_KEY=... node scripts/generate-env.js

const fs = require('fs');
const path = require('path');

const SUPA_URL = process.env.SUPABASE_URL || '';
const SUPA_KEY = process.env.SUPABASE_ANON_KEY || '';

const configObj = { SUPA_URL, SUPA_KEY };
const configStr = JSON.stringify(configObj);

const root = path.join(__dirname, '..');
const htmlFiles = [
  path.join(root, 'index.html'),
  path.join(root, 'admin', 'index.html'),
  path.join(root, 'admin', 'vendor.html'),
];

const PLACEHOLDER = '__LS_CONFIG_INJECT__';

if (!SUPA_URL || !SUPA_KEY) {
  console.warn('Missing SUPABASE_URL or SUPABASE_ANON_KEY. HTML will keep placeholder so app still loads with limited features.');
}

for (const filePath of htmlFiles) {
  if (!fs.existsSync(filePath)) continue;
  let html = fs.readFileSync(filePath, 'utf8');
  if (!html.includes(PLACEHOLDER)) {
    console.warn(`No ${PLACEHOLDER} in ${path.relative(root, filePath)}, skipping.`);
    continue;
  }
  html = html.split(PLACEHOLDER).join(configStr);
  fs.writeFileSync(filePath, html, 'utf8');
  console.log(`Injected config into ${path.relative(root, filePath)}`);
}

// Do not write config/env.js — config is inlined only to avoid exposing keys at /config/env.js
