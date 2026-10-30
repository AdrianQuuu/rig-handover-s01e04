import { Hono } from 'hono';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { loadConfig, type RigConfig } from './config.js';
import { readNight } from './digest/reader.js';
import { sortDigestRows } from './digest/sort.js';
import { lane } from './lane.js';
import { readStatus } from './status.js';
import { DigestPage } from './views/digest.js';
import { Layout } from './views/layout.js';
import { StatusBoard } from './views/status.js';

export function createApp(config: RigConfig = loadConfig()) {
  const app = new Hono();

  app.get('/health', (c) => c.json({ ok: true, lane: lane().id }));

  app.get('/', (c) =>
    c.html(
      <Layout title="status" lane={lane()}>
        <StatusBoard status={readStatus(config)} />
      </Layout>,
    ),
  );

  app.get('/digest/:night', (c) => {
    const night = c.req.param('night');
    if (!/^\d{4}-\d{2}-\d{2}$/.test(night)) return c.notFound();

    const file = join(config.runsDir, `${night}.jsonl`);
    if (!existsSync(file)) return c.notFound();

    const result = readNight(config.runsDir, night);
    return c.html(
      <Layout title={`digest ${night}`} lane={lane()}>
        <DigestPage
          night={night}
          rows={sortDigestRows(result.rows)}
          empty={result.rows.length === 0 && result.badLines === 0}
        />
      </Layout>,
    );
  });

  return app;
}
