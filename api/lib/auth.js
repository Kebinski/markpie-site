const { sql } = require('@vercel/postgres');
const crypto = require('crypto');

const TOKEN_MAX_AGE_DAYS = 30;

function generateToken() {
  return crypto.randomUUID();
}

async function findOrCreateWeChatUser(openid, unionid, nickname, avatarUrl) {
  const { rows } = await sql`
    INSERT INTO users (wechat_openid, wechat_unionid, nickname, avatar_url, provider, last_login_at)
    VALUES (${openid}, ${unionid || null}, ${nickname || null}, ${avatarUrl || null}, 'wechat', NOW())
    ON CONFLICT (wechat_openid)
    DO UPDATE SET
      nickname = COALESCE(NULLIF(EXCLUDED.nickname, ''), users.nickname),
      avatar_url = COALESCE(NULLIF(EXCLUDED.avatar_url, ''), users.avatar_url),
      last_login_at = NOW()
    RETURNING id, wechat_openid, wechat_unionid, apple_user_id, nickname, avatar_url, provider, created_at, last_login_at
  `;
  return rows[0];
}

async function findOrCreateAppleUser(appleUserId, nickname) {
  const { rows } = await sql`
    INSERT INTO users (apple_user_id, nickname, provider, last_login_at)
    VALUES (${appleUserId}, ${nickname || null}, 'apple', NOW())
    ON CONFLICT (apple_user_id)
    DO UPDATE SET
      nickname = COALESCE(NULLIF(EXCLUDED.nickname, ''), users.nickname),
      last_login_at = NOW()
    RETURNING id, wechat_openid, wechat_unionid, apple_user_id, nickname, avatar_url, provider, created_at, last_login_at
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
    SELECT u.id, u.wechat_openid, u.wechat_unionid, u.apple_user_id, u.nickname, u.avatar_url, u.provider, u.created_at, u.last_login_at, t.last_used_at AS token_last_used_at
    FROM auth_tokens t
    JOIN users u ON u.id = t.user_id
    WHERE t.token = ${token}
  `;
  if (rows.length === 0) return null;

  const user = rows[0];

  const lastUsed = new Date(user.token_last_used_at);
  const now = new Date();
  const daysSinceLastUse = (now - lastUsed) / (1000 * 60 * 60 * 24);
  if (daysSinceLastUse > TOKEN_MAX_AGE_DAYS) {
    await sql`DELETE FROM auth_tokens WHERE token = ${token}`;
    return null;
  }

  await sql`UPDATE auth_tokens SET last_used_at = NOW() WHERE token = ${token}`;
  return user;
}

async function recordLogin(userId, method, ipAddress) {
  await sql`
    INSERT INTO login_records (user_id, method, ip_address)
    VALUES (${userId}, ${method}, ${ipAddress || null})
  `;
}

module.exports = {
  generateToken, findOrCreateWeChatUser, findOrCreateAppleUser,
  createToken, getUserByToken, recordLogin,
};
