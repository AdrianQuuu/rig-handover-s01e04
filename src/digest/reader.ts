import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { DIGEST_STATUSES, type DigestRow, type DigestStatus, type ReadNight } from './types.js';

type RunLogEntry = {
  at: string;
  job: string;
  status: DigestStatus;
  owner: string | null;
  error?: string | null;
};

const statuses: ReadonlySet<string> = new Set(DIGEST_STATUSES);

function isRunLogEntry(value: unknown): value is RunLogEntry {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return false;

  const entry = value as Record<string, unknown>;
  return (
    typeof entry.at === 'string' &&
    entry.at.length > 0 &&
    Number.isFinite(Date.parse(entry.at)) &&
    typeof entry.job === 'string' &&
    entry.job.length > 0 &&
    typeof entry.status === 'string' &&
    statuses.has(entry.status) &&
    (entry.owner === null || typeof entry.owner === 'string') &&
    (entry.error === undefined || entry.error === null || typeof entry.error === 'string')
  );
}

export const readNight: ReadNight = (runsDir, night) => {
  const content = readFileSync(join(runsDir, `${night}.jsonl`), 'utf8');
  const rowsByJob = new Map<string, DigestRow>();
  let badLines = 0;

  if (content.length === 0) return { rows: [], badLines };

  const lines = content.split(/\r?\n/);
  // A final newline terminates the last JSONL record; it is not an extra empty record.
  if (lines.at(-1) === '') lines.pop();

  for (const line of lines) {
    let value: unknown;
    try {
      value = JSON.parse(line);
    } catch {
      badLines += 1;
      continue;
    }

    if (!isRunLogEntry(value)) {
      badLines += 1;
      continue;
    }

    const row = rowsByJob.get(value.job);
    if (!row) {
      rowsByJob.set(value.job, {
        job: value.job,
        owner: value.owner,
        runs: 1,
        retries: value.status === 'retry' ? 1 : 0,
        lastStatus: value.status,
        lastError: value.error ?? null,
        firstTime: value.at,
        lastTime: value.at,
      });
      continue;
    }

    row.owner = value.owner;
    row.runs += 1;
    if (value.status === 'retry') row.retries += 1;
    row.lastStatus = value.status;
    if (value.error != null) row.lastError = value.error;
    row.lastTime = value.at;
  }

  return { rows: [...rowsByJob.values()], badLines };
};
