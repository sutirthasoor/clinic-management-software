// Extracts only the Solar icons the app uses from @iconify-json/solar into src/lib/solar-subset.json (keeps the bundle small, works offline).
import { readFileSync, writeFileSync } from 'node:fs';
import { ICON_NAMES } from '../src/lib/icon-names.js';
const src = JSON.parse(readFileSync(process.argv[2], 'utf8'));
const out = { prefix: 'solar', width: src.width, height: src.height, icons: {} };
const missing = [];
for (const n of ICON_NAMES) { const k = n.replace('solar:', ''); if (src.icons[k]) out.icons[k] = src.icons[k]; else if (src.aliases?.[k]) { out.icons[k] = src.icons[src.aliases[k].parent]; } else missing.push(n); }
writeFileSync(new URL('../src/lib/solar-subset.json', import.meta.url), JSON.stringify(out));
console.log('icons:', Object.keys(out.icons).length, 'missing:', missing.join(', ') || 'none');
