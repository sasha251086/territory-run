import AdmZip from 'adm-zip';
import { gunzipSync } from 'zlib';
import { readFileSync, writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const zipPath =
  process.argv[2] ??
  'c:\\Users\\sasha\\OneDrive\\Desktop\\samsunghealth_a.a.nitsenko_20260621233615.zip';
const outPath = join(__dirname, '..', 'samsung-zip-report.txt');

const lines = [];
const log = (s = '') => lines.push(s);

try {
  const buf = readFileSync(zipPath);
  log(`ZIP: ${zipPath}`);
  log(`Size MB: ${(buf.length / 1024 / 1024).toFixed(2)}`);

  const zip = new AdmZip(buf);
  const entries = zip.getEntries().filter((e) => !e.isDirectory);
  log(`Total files: ${entries.length}`);

  const topLevel = new Set(
    entries.map((e) => e.entryName.replace(/\\/g, '/').split('/')[0]),
  );
  log(`Top-level entries: ${[...topLevel].slice(0, 30).join(', ')}`);

  const exercise = entries.filter((e) => /exercise|location_data|live_data/i.test(e.entryName));
  log(`\nExercise-related files: ${exercise.length}`);
  for (const e of exercise.slice(0, 80)) {
    log(`  ${e.entryName} (${e.header.size}b)`);
  }

  const csvExercise = entries.filter((e) =>
    /com\.samsung\.(?:shealth\.|health\.)?exercise.*\.csv$/i.test(
      e.entryName.replace(/\\/g, '/'),
    ),
  );
  log(`\nExercise CSV: ${csvExercise.length}`);
  for (const e of csvExercise) {
    log(`\nCSV: ${e.entryName}`);
    const text = e.getData().toString('utf-8');
    const header = text.split(/\r?\n/)[0] ?? '';
    log(`  Columns: ${header.slice(0, 600)}`);
    log(`  Rows: ${text.split(/\r?\n/).filter(Boolean).length - 1}`);
  }

  function decode(data) {
    const attempts = [data];
    try {
      attempts.push(gunzipSync(data));
    } catch {}
    for (const b of attempts) {
      try {
        return JSON.parse(b.toString('utf-8'));
      } catch {}
    }
    return null;
  }

  const locationNamed = entries.filter((e) => /\.(location_data|live_data)/i.test(e.entryName));
  log(`\nlocation_data/live_data files: ${locationNamed.length}`);
  for (const e of locationNamed.slice(0, 15)) {
    const parsed = decode(e.getData());
    log(`\n  ${e.entryName}`);
    if (!parsed) {
      log('    DECODE_FAIL');
      continue;
    }
    log(`    preview: ${JSON.stringify(parsed).slice(0, 350)}`);
  }

  const exerciseJsonPaths = entries.filter((e) =>
    /jsons?\/.*exercise/i.test(e.entryName.replace(/\\/g, '/')),
  );
  log(`\nFiles under jsons/.../exercise: ${exerciseJsonPaths.length}`);

  let withGps = 0;
  let decoded = 0;
  let sampleGps = 0;
  for (const e of exerciseJsonPaths) {
    const parsed = decode(e.getData());
    if (!parsed) continue;
    decoded += 1;
    const str = JSON.stringify(parsed);
    if (!/latitude|longitude|"lat"/i.test(str)) continue;
    withGps += 1;
    if (sampleGps < 5) {
      log(`\nGPS sample: ${e.entryName}`);
      log(`  ${str.slice(0, 400)}`);
      sampleGps += 1;
    }
  }
  log(`\nDecoded exercise jsons: ${decoded}, with coordinates: ${withGps}`);

  // Check CSV blob path columns
  for (const e of csvExercise.slice(0, 1)) {
    const text = e.getData().toString('utf-8');
    const header = (text.split(/\r?\n/)[0] ?? '').toLowerCase();
    const cols = header.split(',');
    const blobCols = cols.filter(
      (c) =>
        c.includes('location') ||
        c.includes('live_data') ||
        c.includes('blob') ||
        c.includes('json'),
    );
    log(`\nCSV blob/json columns: ${blobCols.join(' | ')}`);
  }
} catch (err) {
  log(`ERROR: ${err instanceof Error ? err.message : String(err)}`);
}

writeFileSync(outPath, lines.join('\n'), 'utf-8');
console.log('Wrote', outPath);
