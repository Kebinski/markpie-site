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

  return res.status(200).json({
    id: user.id,
    openid: user.wechat_openid,
    nickname: user.nickname,
    avatar_url: user.avatar_url,
    created_at: user.created_at,
    last_login_at: user.last_login_at,
  });
};
