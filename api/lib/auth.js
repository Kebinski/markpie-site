const { sql } = require('@vercel/postgres');
const crypto = require('crypto');

function generateToken() {
  return crypto.randomUUID();
}

async function createUser(openid, unionid, nickname, avatarUrl) {
  const { rows } = await sql`
    INSERT INTO users (wechat_openid, wechat_unionid, nickname, avatar_url, last_login_at)
    VALUES (${openid}, ${unionid || null}, ${nickname || null}, ${avatarUrl || null}, NOW())
    ON CONFLICT (wechat_openid)
    DO UPDATE SET
      nickname = COALESCE(NULLIF(EXCLUDED.nickname, ''), users.nickname),
      avatar_url = COALESCE(NULLIF(EXCLUDED.avatar_url, ''), users.avatar_url),
      last_login_at = NOW()
    RETURNING id, wechat_openid, wechat_unionid, nickname, avatar_url, created_at, last_login_at
  `;
  return rows[0];
}

async function createToken(userId) {
  const token = generateToken();
  const { rows } = await sql`
    INSERT INTO auth_tokens (user_id, token)
    VALUES (${userId}, ${token})
    RETURNING token
  `;
  return rows[0].token;
}

async function getUserByToken(token) {
  const { rows } = await sql`
    SELECT u.id, u.wechat_openid, u.wechat_unionid, u.nickname, u.avatar_url, u.created_at, u.last_login_at
    FROM auth_tokens t
    JOIN users u ON u.id = t.user_id
    WHERE t.token = ${token}
  `;
  if (rows.length === 0) return null;
  await sql`UPDATE auth_tokens SET last_used_at = NOW() WHERE token = ${token}`;
  return rows[0];
}

async function recordLogin(userId, method, ipAddress) {
  await sql`
    INSERT INTO login_records (user_id, method, ip_address)
    VALUES (${userId}, ${method}, ${ipAddress || null})
  `;
}

module.exports = { generateToken, createUser, createToken, getUserByToken, recordLogin };
