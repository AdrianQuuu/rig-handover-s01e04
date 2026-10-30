export const DIGEST_STATUSES = ['ok', 'retry', 'fail'] as const;

export type DigestStatus = (typeof DIGEST_STATUSES)[number];

export type DigestRow = {
  job: string;
  owner: string | null;
  runs: number;
  retries: number;
  lastStatus: DigestStatus;
  lastError: string | null;
  firstTime: string;
  lastTime: string;
};

export type ReadNightResult = {
  rows: DigestRow[];
  badLines: number;
};

export type ReadNight = (runsDir: string, night: string) => ReadNightResult;
