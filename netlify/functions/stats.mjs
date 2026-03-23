import getDb from './lib/db.mjs';

export default async (req, context) => {
  if (req.method !== 'GET') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  try {
    const url = new URL(req.url);
    const siteId = url.searchParams.get('site_id');
    const period = url.searchParams.get('period') || '7d';

    if (!siteId) {
      return new Response(JSON.stringify({ error: 'site_id required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const db = getDb();

    // Calculate date filter
    let dateFilter = '';
    const now = new Date();
    if (period === '24h') {
      const since = new Date(now - 24 * 60 * 60 * 1000).toISOString();
      dateFilter = `AND timestamp >= '${since}'`;
    } else if (period === '7d') {
      const since = new Date(now - 7 * 24 * 60 * 60 * 1000).toISOString();
      dateFilter = `AND timestamp >= '${since}'`;
    } else if (period === '30d') {
      const since = new Date(now - 30 * 24 * 60 * 60 * 1000).toISOString();
      dateFilter = `AND timestamp >= '${since}'`;
    }
    // 'all' = no date filter

    // Total pageviews
    const totalViews = await db.execute({
      sql: `SELECT COUNT(*) as count FROM pageviews WHERE site_id = ? ${dateFilter}`,
      args: [siteId],
    });

    // Unique visitors (sessions)
    const uniqueVisitors = await db.execute({
      sql: `SELECT COUNT(DISTINCT session_id) as count FROM pageviews WHERE site_id = ? ${dateFilter}`,
      args: [siteId],
    });

    // Top pages
    const topPages = await db.execute({
      sql: `SELECT path, COUNT(*) as views FROM pageviews WHERE site_id = ? ${dateFilter} GROUP BY path ORDER BY views DESC LIMIT 10`,
      args: [siteId],
    });

    // Top referrers
    const topReferrers = await db.execute({
      sql: `SELECT referrer, COUNT(*) as views FROM pageviews WHERE site_id = ? AND referrer != '' ${dateFilter} GROUP BY referrer ORDER BY views DESC LIMIT 10`,
      args: [siteId],
    });

    // Views over time (grouped by date)
    const viewsOverTime = await db.execute({
      sql: `SELECT DATE(timestamp) as date, COUNT(*) as views FROM pageviews WHERE site_id = ? ${dateFilter} GROUP BY DATE(timestamp) ORDER BY date ASC`,
      args: [siteId],
    });

    // Top countries
    const topCountries = await db.execute({
      sql: `SELECT country, COUNT(*) as views FROM pageviews WHERE site_id = ? ${dateFilter} GROUP BY country ORDER BY views DESC LIMIT 10`,
      args: [siteId],
    });

    // Browser breakdown (simplified from user-agent)
    const browsers = await db.execute({
      sql: `SELECT user_agent, COUNT(*) as views FROM pageviews WHERE site_id = ? ${dateFilter} GROUP BY user_agent ORDER BY views DESC LIMIT 20`,
      args: [siteId],
    });

    // Calculate previous period for comparison
    let prevDateFilter = '';
    if (period === '24h') {
      const prevEnd = new Date(now - 24 * 60 * 60 * 1000).toISOString();
      const prevStart = new Date(now - 48 * 60 * 60 * 1000).toISOString();
      prevDateFilter = `AND timestamp >= '${prevStart}' AND timestamp < '${prevEnd}'`;
    } else if (period === '7d') {
      const prevEnd = new Date(now - 7 * 24 * 60 * 60 * 1000).toISOString();
      const prevStart = new Date(now - 14 * 24 * 60 * 60 * 1000).toISOString();
      prevDateFilter = `AND timestamp >= '${prevStart}' AND timestamp < '${prevEnd}'`;
    } else if (period === '30d') {
      const prevEnd = new Date(now - 30 * 24 * 60 * 60 * 1000).toISOString();
      const prevStart = new Date(now - 60 * 24 * 60 * 60 * 1000).toISOString();
      prevDateFilter = `AND timestamp >= '${prevStart}' AND timestamp < '${prevEnd}'`;
    }

    let prevViews = { rows: [{ count: 0 }] };
    let prevVisitors = { rows: [{ count: 0 }] };
    if (prevDateFilter) {
      prevViews = await db.execute({
        sql: `SELECT COUNT(*) as count FROM pageviews WHERE site_id = ? ${prevDateFilter}`,
        args: [siteId],
      });
      prevVisitors = await db.execute({
        sql: `SELECT COUNT(DISTINCT session_id) as count FROM pageviews WHERE site_id = ? ${prevDateFilter}`,
        args: [siteId],
      });
    }

    const result = {
      total_views: Number(totalViews.rows[0]?.count || 0),
      unique_visitors: Number(uniqueVisitors.rows[0]?.count || 0),
      prev_total_views: Number(prevViews.rows[0]?.count || 0),
      prev_unique_visitors: Number(prevVisitors.rows[0]?.count || 0),
      top_pages: topPages.rows.map((r) => ({ path: r.path, views: Number(r.views) })),
      top_referrers: topReferrers.rows.map((r) => ({ referrer: r.referrer, views: Number(r.views) })),
      views_over_time: viewsOverTime.rows.map((r) => ({ date: r.date, views: Number(r.views) })),
      top_countries: topCountries.rows.map((r) => ({ country: r.country, views: Number(r.views) })),
      browsers: parseBrowsers(browsers.rows),
    };

    return new Response(JSON.stringify(result), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error('Stats error:', err);
    return new Response(JSON.stringify({ error: 'Internal error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};

function parseBrowsers(rows) {
  const browsers = {};
  for (const row of rows) {
    const ua = (row.user_agent || '').toLowerCase();
    let name = 'Other';
    if (ua.includes('chrome') && !ua.includes('edg')) name = 'Chrome';
    else if (ua.includes('firefox')) name = 'Firefox';
    else if (ua.includes('safari') && !ua.includes('chrome')) name = 'Safari';
    else if (ua.includes('edg')) name = 'Edge';
    browsers[name] = (browsers[name] || 0) + Number(row.views);
  }
  return Object.entries(browsers)
    .map(([name, views]) => ({ name, views }))
    .sort((a, b) => b.views - a.views);
}

export const config = {
  path: '/api/stats',
};
