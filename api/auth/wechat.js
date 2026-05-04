const { createUser, createToken, recordLogin } = require('../lib/auth');

module.exports = async (req, res) => {
  res.setHeader('Content-Type', 'application/json');

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { code } = req.body;
  if (!code) {
    return res.status(400).json({ error: 'Missing code' });
  }

  const appID = 'wxf12b781be3ccfc5c';
  const appSecret = process.env.WECHAT_APP_SECRET;
  if (!appSecret) {
    return res.status(500).json({ error: 'Server configuration error' });
  }

  try {
    // 1. 交换 code 获取 access_token
    const tokenResp = await fetch(
      `https://api.weixin.qq.com/sns/oauth2/access_token?appid=${appID}&secret=${appSecret}&code=${code}&grant_type=authorization_code`
    );
    const tokenData = await tokenResp.json();
    if (tokenData.errcode) {
      return res.status(400).json({ error: tokenData.errmsg });
    }

    // 2. 获取用户信息（昵称、头像）
    const userResp = await fetch(
      `https://api.weixin.qq.com/sns/userinfo?access_token=${tokenData.access_token}&openid=${tokenData.openid}`
    );
    const userData = await userResp.json();

    // 3. 写入数据库
    const user = await createUser(
      tokenData.openid,
      tokenData.unionid || userData.unionid,
      userData.nickname,
      userData.headimgurl
    );

    // 4. 生成登录 token
    const authToken = await createToken(user.id);

    // 5. 记录登录
    const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
    await recordLogin(user.id, 'wechat', ip);

    return res.status(200).json({
      token: authToken,
      user: {
        id: user.id,
        openid: user.wechat_openid,
        nickname: user.nickname,
        avatar_url: user.avatar_url,
        created_at: user.created_at,
        last_login_at: user.last_login_at,
      },
    });
  } catch (err) {
    return res.status(502).json({ error: 'Failed to exchange token' });
  }
};
