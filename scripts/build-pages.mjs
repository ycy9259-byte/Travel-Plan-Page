import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const output = path.join(root, '_site');
const tripText = await fs.readFile(path.join(root, 'trip-data.json'), 'utf8');
const trip = JSON.parse(tripText);
if (trip.config?.persistence?.mode !== 'local') throw new Error('Pages build requires local persistence; review backend dependencies before publishing.');
// Block high-risk values; never silently redact or change the travel plan.
if (/(?<!\d)\d{17}[\dXx](?!\d)|-----BEGIN [A-Z ]*PRIVATE KEY-----|\b(?:gh[pousr]_[A-Za-z0-9_]{20,}|github_pat_[A-Za-z0-9_]{20,}|AKIA[A-Z0-9]{16})\b/.test(tripText)) {
  throw new Error('Potential identity number or access key in trip-data.json; review before publishing.');
}
function checkSensitiveFields(value) {
  if (!value || typeof value !== 'object') return;
  for (const [key, entry] of Object.entries(value)) {
    if (/^(?:password|secret|token|apiKey|privateKey|phone|mobile|email|passportNumber|idCardNumber|bookingPin|orderNumber)$/i.test(key) && entry !== null && entry !== '') {
      throw new Error(`Review potentially sensitive field before publishing: ${key}`);
    }
    checkSensitiveFields(entry);
  }
}
checkSensitiveFields(trip);
const manifest = JSON.parse(await fs.readFile(path.join(root, 'assets/maps/templates/manifest.json'), 'utf8'));
const allowedMaps = new Set(manifest.templates.map((item) => item.file));
const maps = new Set([...(trip.metadata?.assets?.routeMaps || []), ...(trip.routeMap?.regions || []).map((region) => region.baseImage)]);
for (const asset of maps) if (!allowedMaps.has(asset)) throw new Error(`Map asset needs publication review: ${asset}`);
if ((trip.ticketPlanning?.items || []).some((item) => item.document)) throw new Error('Ticket documents need publication review; no document has been removed.');
const files = ['index.html', 'styles.css', 'ledger.css', 'app.js', 'ledger.js', 'overview-map.js', 'route-ui.js', 'runtime-storage.js', 'site-navigation.js', 'ticket-pdf-preview.js', 'trip-data.json', 'LICENSE', 'THIRD_PARTY_NOTICES.md', ...maps];
// Validate before replacing the generated directory. No raw uploads, credentials,
// browser storage, Git history, or optional server functions enter this artifact.
for (const file of files) await fs.access(path.join(root, file));
await fs.rm(output, { recursive: true, force: true });
for (const file of files) {
  const destination = path.join(output, file);
  await fs.mkdir(path.dirname(destination), { recursive: true });
  await fs.copyFile(path.join(root, file), destination);
}
await fs.writeFile(path.join(output, '.nojekyll'), '');
console.log(`GitHub Pages static artifact: _site (${files.length + 1} files). Trip data unchanged.`);
