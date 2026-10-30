import { mkdir, rm, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { createApp } from '../src/app.js';
import { loadConfig } from '../src/config.js';

const outputDir = process.env.PAGES_OUTPUT_DIR;
if (!outputDir) throw new Error('PAGES_OUTPUT_DIR is required.');

const includeLaneMarker = process.env.INCLUDE_LANE_MARKER === 'true';
const marker = process.env.LANE_MARKER?.trim() ?? '';
if (includeLaneMarker && !marker) {
  throw new Error('LANE_MARKER is unavailable; refusing to generate the preview.');
}
if (!includeLaneMarker) process.env.LANE_MARKER = '';

const response = await createApp(loadConfig()).request('/digest/2026-10-28');
if (response.status !== 200) {
  throw new Error(`Digest render returned HTTP ${response.status}.`);
}

const html = await response.text();
const markerMatch = html.match(/<span class="marker">([^<]*)<\/span>/);
if (!markerMatch) throw new Error('The lane banner is missing from the rendered page.');

const renderedMarker = markerMatch[1].trim();
const hasLaneMarker = renderedMarker !== '' && renderedMarker !== 'no marker set';
if (includeLaneMarker !== hasLaneMarker) {
  throw new Error('The rendered lane marker does not match the requested mode.');
}
if (/<script\b|javascript\s*:/i.test(html)) {
  throw new Error('The rendered preview must not contain client-side JavaScript.');
}

await rm(outputDir, { recursive: true, force: true });
const outputFile = join(outputDir, 'digest', '2026-10-28', 'index.html');
await mkdir(dirname(outputFile), { recursive: true });
await writeFile(outputFile, html, 'utf8');
