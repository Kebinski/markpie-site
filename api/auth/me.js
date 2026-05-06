const { sql } = require('@vercel/postgres');
const { getUserByToken } = require('../lib/auth');

module.exports = async (req, res) => {
  res.setHeader('Content-Type', 'application/json');

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Missing or invalid token' });
  }

  const token = authHeader.slice(7);
  const user = await getUserByToken(token);
  if (!user) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }

  const { rows: memberships } = await sql`
    SELECT * FROM memberships WHERE user_id = ${user.id}
  `;

  return res.status(200).json({
    id: user.id,
    provider: user.provider,
    openid: user.wechat_openid,
    nickname: user.nickname,
    avatar_url: user.avatar_url,
    created_at: user.created_at,
    last_login_at: user.last_login_at,
    membership: memberships.length > 0 ? formatMembership(memberships[0]) : null,
  });
};

function formatMembership(row) {
  return {
    membershipStatus: row.membership_status,
    dailyMemoryCount: row.daily_memory_count,
    dailyMemoryLimit: row.daily_memory_limit,
    handbookCount: row.handbook_count,
    handbookLimit: row.handbook_limit,
    aiRemainingCount: row.ai_remaining_count,
    aiLimitCount: row.ai_limit_count,
    resetAt: row.reset_at ? new Date(row.reset_at).toISOString() : null,
    expiresAt: row.expires_at ? new Date(row.expires_at).toISOString() : null,
  };
}
