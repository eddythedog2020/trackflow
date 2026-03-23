import getDb from './lib/db.mjs';

export default async (req, context) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: corsHeaders(),
    });
  }

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { ...corsHeaders(), 'Content-Type': 'application/json' },
    });
  }

  try {
    const body = await req.json();
    const { site_id, path, referrer, screen_width, session_id, timestamp } = body;

    if (!site_id || !path) {
      return new Response(JSON.stringify({ error: 'site_id and path required' }), {
        status: 400,
        headers: { ...corsHeaders(), 'Content-Type': 'application/json' },
      });
    }

    const db = getDb();

    // Verify site exists
    const site = await db.execute({
      sql: 'SELECT id FROM sites WHERE id = ?',
      args: [site_id],
    });

    if (site.rows.length === 0) {
      return new Response(JSON.stringify({ error: 'Unknown site' }), {
        status: 404,
        headers: { ...corsHeaders(), 'Content-Type': 'application/json' },
      });
    }

    // Get country from Netlify geo context
    const country = context.geo?.country?.code || 'Unknown';

    // Extract user agent
    const userAgent = req.headers.get('user-agent') || '';

    await db.execute({
      sql: `INSERT INTO pageviews (site_id, path, referrer, user_agent, country, screen_width, session_id, timestamp)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      args: [
        site_id,
        path,
        referrer || '',
        userAgent,
        country,
        screen_width || 0,
        session_id || '',
        timestamp || new Date().toISOString(),
      ],
    });

    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { ...corsHeaders(), 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error('Track error:', err);
    return new Response(JSON.stringify({ error: 'Internal error' }), {
      status: 500,
      headers: { ...corsHeaders(), 'Content-Type': 'application/json' },
    });
  }
};

function corsHeaders() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };
}

export const config = {
  path: '/api/track',
};
