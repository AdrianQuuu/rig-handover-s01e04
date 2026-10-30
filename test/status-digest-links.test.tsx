import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';

const tempDirs: string[] = [];

function makeRunsDir(): string {
  const dir = mkdtempSync(join(tmpdir(), 'rig-status-digest-'));
  tempDirs.push(dir);
  return dir;
}

afterEach(() => {
  for (const dir of tempDirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});

describe('status board digest links', () => {
  it('links each night on disk and shows counts of jobs by last status', async () => {
    const runsDir = makeRunsDir();
    writeFileSync(
      join(runsDir, '2026-10-27.jsonl'),
      [
        JSON.stringify({ at: '2026-10-27T01:00:00+01:00', job: 'ok/job', status: 'ok', owner: 'rook' }),
        JSON.stringify({ at: '2026-10-27T01:01:00+01:00', job: 'retry/job', status: 'retry', owner: 'rook' }),
        JSON.stringify({ at: '2026-10-27T01:02:00+01:00', job: 'fail/job', status: 'fail', owner: null }),
      ].join('\n'),
      'utf8',
    );
    writeFileSync(
      join(runsDir, '2026-10-28.jsonl'),
      [
        JSON.stringify({ at: '2026-10-28T01:00:00+01:00', job: 'ok/one', status: 'ok', owner: 'rook' }),
        JSON.stringify({ at: '2026-10-28T01:01:00+01:00', job: 'ok/two', status: 'ok', owner: 'rook' }),
      ].join('\n'),
      'utf8',
    );

    const config = { adapter: 'shim', installed: '2026-10-29T14:06:00+01:00', beatEverySeconds: 60, runsDir };
    const app = createApp(config);
    const response = await app.request('/');
    const html = await response.text();

    expect(response.status).toBe(200);
    expect(html).toContain('<a href="/digest/2026-10-28">2026-10-28</a>');
    expect(html).toContain('ok 2 · retry 0 · fail 0');
    expect(html).toContain('<a href="/digest/2026-10-27">2026-10-27</a>');
    expect(html).toContain('ok 1 · retry 1 · fail 1');

    for (const night of ['2026-10-27', '2026-10-28']) {
      expect((await app.request(`/digest/${night}`)).status).toBe(200);
    }
  });
});
