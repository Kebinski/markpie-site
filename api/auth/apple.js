const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const { findOrCreateAppleUser, createToken, recordLogin } = require('../lib/auth');

const APPLE_BUNDLE_ID = 'com.markpie.app';

async function verifyAppleToken(identityToken) {
  const decoded = jwt.decode(identityToken, { complete: true });
  if (!decoded) throw new Error('Invalid identity token');

  const { kid, alg } = decoded.header;
  if (!['ES256', 'RS256'].includes(alg)) {
    throw new Error('Unsupported token algorithm');
  }

  const resp = await fetch('https://appleid.apple.com/auth/keys');
  const { keys } = await resp.json();
  const jwk = keys.find((k) => k.kid === kid);
  if (!jwk) throw new Error('Matching Apple public key not found');

  const publicKey = crypto.createPublicKey({ key: jwk, format: 'jwk' });

  return jwt.verify(identityToken, publicKey, {
    algorithms: [alg],
    issuer: 'https://appleid.apple.com',
    audience: APPLE_BUNDLE_ID,
  });
}

module.exports = async (req, res) => {
  res.setHeader('Content-Type', 'application/json');

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { userID, identityToken, givenName, familyName } = req.body;

  if (!userID) {
    return res.status(400).json({ error: 'Missing userID' });
  }
  if (!identityToken) {
    return res.status(400).json({ error: 'Missing identityToken' });
  }

  try {
    const claims = await verifyAppleToken(identityToken);

    if (claims.sub !== userID) {
      return res.status(400).json({ error: 'userID mismatch with identity token' });
    }

    const displayName = [familyName, givenName]
      .filter(Boolean)
      .join(' ')
      .trim() || 'Apple 用户';

    const user = await findOrCreateAppleUser(claims.sub, displayName);
    const authToken = await createToken(user.id);

    const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
    await recordLogin(user.id, 'apple', ip);

    return res.status(200).json({
      token: authToken,
      user: {
        id: user.id,
        provider: user.provider,
        openid: null,
        nickname: user.nickname,
        avatar_url: null,
        created_at: user.created_at,
        last_login_at: user.last_login_at,
      },
    });
  } catch (err) {
    if (err.message?.includes('jwt')) {
      return res.status(401).json({ error: 'Apple identity token verification failed' });
    }
    return res.status(502).json({ error: err.message || 'Apple login failed' });
  }
};
