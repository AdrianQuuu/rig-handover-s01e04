import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { readNight } from '../src/digest/reader.js';

const tempDirs: string[] = [];

function makeRunsDir(): string {
  const dir = mkdtempSync(join(tmpdir(), 'rig-digest-'));
  tempDirs.push(dir);
  return dir;
}

afterEach(() => {
  for (const dir of tempDirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});

describe('readNight', () => {
  it('aggregates the checked-in 2026-10-28 run log into the planned rows', () => {
    const result = readNight('runs', '2026-10-28');

    expect(result.badLines).toBe(1);
    expect(result.rows).toEqual([
      {
        job: 'rig/rotate-logs',
        owner: 'lane-07',
        runs: 1,
        retries: 0,
        lastStatus: 'ok',
        lastError: null,
        firstTime: '2026-10-28T23:00:02+01:00',
        lastTime: '2026-10-28T23:00:02+01:00',
      },
      {
        job: 'lane/sync',
        owner: 'rook',
        runs: 8,
        retries: 1,
        lastStatus: 'ok',
        lastError: 'lock held',
        firstTime: '2026-10-28T23:00:06+01:00',
        lastTime: '2026-10-29T05:00:04+01:00',
      },
      {
        job: 'fixtures/refresh',
        owner: 'rook',
        runs: 4,
        retries: 3,
        lastStatus: 'ok',
        lastError: 'upstream 503',
        firstTime: '2026-10-29T01:30:00+01:00',
        lastTime: '2026-10-29T01:37:00+01:00',
      },
      {
        job: 'notes/backup',
        owner: 'lane-07',
        runs: 1,
        retries: 0,
        lastStatus: 'fail',
        lastError: 'quota exceeded',
        firstTime: '2026-10-29T04:00:01+01:00',
        lastTime: '2026-10-29T04:00:01+01:00',
      },
      {
        job: 'digest/render',
        owner: null,
        runs: 1,
        retries: 0,
        lastStatus: 'ok',
        lastError: null,
        firstTime: '2026-10-29T05:41:09+01:00',
        lastTime: '2026-10-29T05:41:09+01:00',
      },
    ]);
  });

  it('counts malformed lines, missing required fields, and invalid statuses without throwing', () => {
    const dir = makeRunsDir();
    const valid = {
      at: '2026-10-28T23:50:00+05:30',
      job: 'digest/render',
      status: 'ok',
      owner: null,
    };
    const missingRequired = ['at', 'job', 'status', 'owner'].map((field) => {
      const record = { ...valid } as Record<string, unknown>;
      delete record[field];
      return JSON.stringify(record);
    });
    const lines = [
      JSON.stringify(valid),
      'not json',
      ...missingRequired,
      JSON.stringify({ ...valid, status: 'skipped' }),
    ];
    writeFileSync(join(dir, '2026-10-28.jsonl'), lines.join('\n'), 'utf8');

    expect(() => readNight(dir, '2026-10-28')).not.toThrow();
    const result = readNight(dir, '2026-10-28');
    expect(result.badLines).toBe(6);
    expect(result.rows).toHaveLength(1);
    expect(result.rows[0]).toEqual({
      job: 'digest/render',
      owner: null,
      runs: 1,
      retries: 0,
      lastStatus: 'ok',
      lastError: null,
      firstTime: '2026-10-28T23:50:00+05:30',
      lastTime: '2026-10-28T23:50:00+05:30',
    });
  });

  it('preserves source offsets and the last error across later successful runs', () => {
    const dir = makeRunsDir();
    const entries = [
      {
        at: '2026-10-28T23:50:00+05:30',
        job: 'lane/sync',
        status: 'retry',
        owner: 'rook',
        error: 'lock held',
      },
      {
        at: '2026-10-28T15:00:00-04:00',
        job: 'lane/sync',
        status: 'ok',
        owner: 'rook',
      },
    ];
    writeFileSync(join(dir, '2026-10-28.jsonl'), `${entries.map((entry) => JSON.stringify(entry)).join('\n')}\n`, 'utf8');

    const result = readNight(dir, '2026-10-28');
    expect(result.badLines).toBe(0);
    expect(result.rows).toEqual([
      {
        job: 'lane/sync',
        owner: 'rook',
        runs: 2,
        retries: 1,
        lastStatus: 'ok',
        lastError: 'lock held',
        firstTime: '2026-10-28T23:50:00+05:30',
        lastTime: '2026-10-28T15:00:00-04:00',
      },
    ]);
  });

  it('returns no rows and no bad lines for an empty night', () => {
    const dir = makeRunsDir();
    writeFileSync(join(dir, '2026-10-28.jsonl'), '', 'utf8');

    expect(readNight(dir, '2026-10-28')).toEqual({ rows: [], badLines: 0 });
  });
});
