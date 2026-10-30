import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';
import { readNight } from '../src/digest/reader.js';
import type { DigestRow } from '../src/digest/types.js';

const tempDirs: string[] = [];
const config = (runsDir: string) => ({
  adapter: 'shim',
  installed: '2026-10-29T14:06:00+01:00',
  beatEverySeconds: 60,
  runsDir,
});

function makeRunsDir(): string {
  const dir = mkdtempSync(join(tmpdir(), 'rig-digest-routes-'));
  tempDirs.push(dir);
  return dir;
}

function writeNight(runsDir: string, night: string, lines: string[]): void {
  writeFileSync(join(runsDir, `${night}.jsonl`), lines.join('\n'), 'utf8');
}

function htmlJobOrder(html: string): string[] {
  const tbody = html.match(/<tbody>([\s\S]*?)<\/tbody>/)?.[1];
  if (!tbody) throw new Error('digest table body was not rendered');
  return [...tbody.matchAll(/<tr(?:\s[^>]*)?>\s*<td>([^<]*)<\/td>/g)].map((match) => match[1]);
}

afterEach(() => {
  for (const dir of tempDirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});

describe('digest routes', () => {
  it('returns the same sorted jobs in the page and JSON', async () => {
    const runsDir = makeRunsDir();
    const entries = [
      { at: '2026-10-28T23:10:00+01:00', job: 'zeta/job', status: 'fail', owner: null, error: 'quota exceeded' },
      { at: '2026-10-28T23:00:00+01:00', job: 'alpha/job', status: 'retry', owner: 'rook', error: 'lock held' },
      { at: '2026-10-28T23:01:00+01:00', job: 'alpha/job', status: 'retry', owner: 'rook', error: 'lock held' },
      { at: '2026-10-28T23:02:00+01:00', job: 'alpha/job', status: 'retry', owner: 'rook', error: 'lock held' },
      { at: '2026-10-28T23:03:00+01:00', job: 'alpha/job', status: 'ok', owner: 'rook' },
      { at: '2026-10-28T23:20:00+01:00', job: 'middle/job', status: 'ok', owner: 'rook' },
    ];
    writeNight(runsDir, '2026-10-28', entries.map((entry) => JSON.stringify(entry)));
    const app = createApp(config(runsDir));

    const page = await app.request('/digest/2026-10-28');
    const html = await page.text();
    const json = await app.request('/api/digest/2026-10-28');
    const rows = (await json.json()) as DigestRow[];

    expect(page.status).toBe(200);
    expect(json.status).toBe(200);
    expect(rows.map((row) => row.job)).toEqual(htmlJobOrder(html));
    expect(rows.map((row) => row.job)).toEqual(['alpha/job', 'middle/job', 'zeta/job']);
    expect(rows[0]).toMatchObject({ retries: 3, lastStatus: 'ok' });
    expect(rows[2]).toMatchObject({ owner: null, lastStatus: 'fail', lastError: 'quota exceeded' });
    expect(html).toContain('class="warn"');
    expect(html).toContain('—');
    expect(rows[0].firstTime).toBe('2026-10-28T23:00:00+01:00');
  });

  it('returns 404 for a night file that does not exist', async () => {
    const app = createApp(config(makeRunsDir()));

    expect((await app.request('/digest/2026-10-27')).status).toBe(404);
    expect((await app.request('/api/digest/2026-10-27')).status).toBe(404);
  });

  it('renders an empty night and returns an empty JSON row list', async () => {
    const runsDir = makeRunsDir();
    writeNight(runsDir, '2026-10-28', []);
    const app = createApp(config(runsDir));

    const page = await app.request('/digest/2026-10-28');
    const html = await page.text();
    const json = await app.request('/api/digest/2026-10-28');

    expect(page.status).toBe(200);
    expect(html).toContain('nothing ran');
    expect(json.status).toBe(200);
    expect(await json.json()).toEqual([]);
  });

  it('counts malformed lines without losing valid rows from either route', async () => {
    const runsDir = makeRunsDir();
    const valid = { at: '2026-10-28T23:40:00-04:00', job: 'digest/render', status: 'ok', owner: null };
    writeNight(runsDir, '2026-10-28', [JSON.stringify(valid), 'not json']);
    const app = createApp(config(runsDir));

    expect(readNight(runsDir, '2026-10-28').badLines).toBe(1);

    const page = await app.request('/digest/2026-10-28');
    const html = await page.text();
    const json = await app.request('/api/digest/2026-10-28');

    expect(page.status).toBe(200);
    expect(html).toContain('digest/render');
    expect(json.status).toBe(200);
    expect(await json.json()).toEqual([
      {
        job: 'digest/render',
        owner: null,
        runs: 1,
        retries: 0,
        lastStatus: 'ok',
        lastError: null,
        firstTime: '2026-10-28T23:40:00-04:00',
        lastTime: '2026-10-28T23:40:00-04:00',
      },
    ]);
  });
});
