const { sql } = require('@vercel/postgres');
const { getUserByToken } = require('../lib/auth');

module.exports = async (req, res) => {
  res.setHeader('Content-Type', 'application/json');

  if (req.method !== 'POST') {
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

  const { code } = req.body || {};
  if (!code || typeof code !== 'string') {
    return res.status(400).json({ error: '请提供兑换码', message: '兑换码不能为空' });
  }

  const trimmedCode = code.trim().toUpperCase();

  const { rows: codes } = await sql`
    SELECT * FROM redemption_codes WHERE code = ${trimmedCode}
  `;

  if (codes.length === 0) {
    return res.status(404).json({ error: '兑换码不存在', message: '兑换码无效，请检查后重试。' });
  }

  const redemption = codes[0];

  if (redemption.expires_at && new Date(redemption.expires_at) < new Date()) {
    return res.status(400).json({ error: '兑换码已过期', message: '该兑换码已过期，请联系客服获取新的兑换码。' });
  }

  if (redemption.use_count >= redemption.max_uses) {
    return res.status(400).json({ error: '兑换码已使用', message: '该兑换码已被使用，无法再次兑换。' });
  }

  const now = new Date();
  const expiresAt = new Date(now.getTime() + redemption.duration_days * 24 * 60 * 60 * 1000);

  const { rows: memberships } = await sql`
    SELECT * FROM memberships WHERE user_id = ${user.id}
  `;

  if (memberships.length > 0) {
    const currentExpiry = memberships[0].expires_at ? new Date(memberships[0].expires_at) : null;
    const finalExpiry = currentExpiry && currentExpiry > now
      ? new Date(currentExpiry.getTime() + redemption.duration_days * 24 * 60 * 60 * 1000)
      : expiresAt;

    await sql`
      UPDATE memberships SET
        membership_status = 'member',
        handbook_limit = NULL,
        ai_remaining_count = 30,
        ai_limit_count = 30,
        expires_at = ${finalExpiry.toISOString()},
        updated_at = NOW()
      WHERE user_id = ${user.id}
    `;
  } else {
    await sql`
      INSERT INTO memberships (user_id, membership_status, handbook_limit, ai_remaining_count, ai_limit_count, expires_at)
      VALUES (${user.id}, 'member', NULL, 30, 30, ${expiresAt.toISOString()})
    `;
  }

  await sql`
    UPDATE redemption_codes SET use_count = use_count + 1 WHERE id = ${redemption.id}
  `;

  const { rows: updated } = await sql`
    SELECT * FROM memberships WHERE user_id = ${user.id}
  `;

  return res.status(200).json({
    success: true,
    message: `兑换成功！会员有效期至 ${expiresAt.toLocaleDateString('zh-CN')}。`,
    membership: formatMembership(updated[0]),
  });
};

function formatMembership(row) {
  if (!row) return null;
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
