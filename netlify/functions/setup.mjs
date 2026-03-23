import getDb from './lib/db.mjs';

export default async (req, context) => {
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  try {
    const db = getDb();

    await db.execute(`
      CREATE TABLE IF NOT EXISTS sites (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        domain TEXT NOT NULL UNIQUE,
        created_at TEXT DEFAULT (datetime('now'))
      )
    `);

    await db.execute(`
      CREATE TABLE IF NOT EXISTS pageviews (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        site_id TEXT NOT NULL,
        path TEXT NOT NULL,
        referrer TEXT,
        user_agent TEXT,
        country TEXT,
        screen_width INTEGER,
        session_id TEXT,
        timestamp TEXT DEFAULT (datetime('now')),
        FOREIGN KEY (site_id) REFERENCES sites(id)
      )
    `);

    // Create indexes for performance
    await db.execute('CREATE INDEX IF NOT EXISTS idx_pageviews_site_id ON pageviews(site_id)');
    await db.execute('CREATE INDEX IF NOT EXISTS idx_pageviews_timestamp ON pageviews(timestamp)');
    await db.execute('CREATE INDEX IF NOT EXISTS idx_pageviews_site_timestamp ON pageviews(site_id, timestamp)');

    return new Response(JSON.stringify({ ok: true, message: 'Database tables created' }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error('Setup error:', err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};

export const config = {
  path: '/api/setup',
};
