import getDb from './lib/db.mjs';

export default async (req, context) => {
  const db = getDb();

  if (req.method === 'GET') {
    try {
      const sites = await db.execute('SELECT * FROM sites ORDER BY created_at DESC');
      return new Response(JSON.stringify(sites.rows), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    } catch (err) {
      console.error('List sites error:', err);
      return new Response(JSON.stringify({ error: 'Internal error' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }
  }

  if (req.method === 'POST') {
    try {
      const body = await req.json();
      const { name, domain } = body;

      if (!name || !domain) {
        return new Response(JSON.stringify({ error: 'name and domain required' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        });
      }

      const id = crypto.randomUUID();

      await db.execute({
        sql: 'INSERT INTO sites (id, name, domain) VALUES (?, ?, ?)',
        args: [id, name, domain],
      });

      return new Response(JSON.stringify({ id, name, domain }), {
        status: 201,
        headers: { 'Content-Type': 'application/json' },
      });
    } catch (err) {
      if (err.message?.includes('UNIQUE')) {
        return new Response(JSON.stringify({ error: 'Domain already registered' }), {
          status: 409,
          headers: { 'Content-Type': 'application/json' },
        });
      }
      console.error('Create site error:', err);
      return new Response(JSON.stringify({ error: 'Internal error' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }
  }

  if (req.method === 'DELETE') {
    try {
      const url = new URL(req.url);
      const siteId = url.searchParams.get('id');
      if (!siteId) {
        return new Response(JSON.stringify({ error: 'id required' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        });
      }

      await db.execute({ sql: 'DELETE FROM pageviews WHERE site_id = ?', args: [siteId] });
      await db.execute({ sql: 'DELETE FROM sites WHERE id = ?', args: [siteId] });

      return new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    } catch (err) {
      console.error('Delete site error:', err);
      return new Response(JSON.stringify({ error: 'Internal error' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }
  }

  return new Response(JSON.stringify({ error: 'Method not allowed' }), {
    status: 405,
    headers: { 'Content-Type': 'application/json' },
  });
};

export const config = {
  path: '/api/sites',
};
