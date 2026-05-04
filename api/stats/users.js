const { sql } = require('@vercel/postgres');

module.exports = async (req, res) => {
  res.setHeader('Content-Type', 'application/json');

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const [totalResult, todayResult, weekResult, monthResult, dauResult] = await Promise.all([
      sql`SELECT COUNT(*)::int AS count FROM users`,
      sql`SELECT COUNT(*)::int AS count FROM users WHERE created_at >= CURRENT_DATE`,
      sql`SELECT COUNT(*)::int AS count FROM users WHERE created_at >= date_trunc('week', CURRENT_DATE)`,
      sql`SELECT COUNT(*)::int AS count FROM users WHERE created_at >= date_trunc('month', CURRENT_DATE)`,
      sql`
        SELECT COUNT(DISTINCT user_id)::int AS count
        FROM login_records
        WHERE created_at >= CURRENT_DATE
      `,
    ]);

    return res.status(200).json({
      total_users: totalResult.rows[0].count,
      new_today: todayResult.rows[0].count,
      new_this_week: weekResult.rows[0].count,
      new_this_month: monthResult.rows[0].count,
      active_today: dauResult.rows[0].count,
    });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to fetch stats' });
  }
};
