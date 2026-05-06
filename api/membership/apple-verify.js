const { sql } = require('@vercel/postgres');
const { getUserByToken } = require('../lib/auth');

const APPLE_VERIFY_URL_PRODUCTION = 'https://buy.itunes.apple.com/verifyReceipt';
const APPLE_VERIFY_URL_SANDBOX = 'https://sandbox.itunes.apple.com/verifyReceipt';

const SHARED_SECRET = process.env.APPLE_APP_STORE_SHARED_SECRET || '';

module.exports = async (req, res) => {
  res.setHeader('Content-Type', 'application/json');

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  if (!SHARED_SECRET) {
    return res.status(500).json({
      error: 'SERVER_NOT_CONFIGURED',
      message: 'Apple 订阅验证尚未配置，请在服务器环境变量中设置 APPLE_APP_STORE_SHARED_SECRET。',
    });
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

  const { receiptData, transactionId } = req.body || {};
  if (!receiptData || typeof receiptData !== 'string') {
    return res.status(400).json({ error: '缺少 receiptData', message: '请提供有效的 Apple 交易凭据。' });
  }

  let verified = false;
  let verificationResult;

  try {
    const productionResult = await verifyWithApple(APPLE_VERIFY_URL_PRODUCTION, receiptData);
    if (productionResult.status === 0) {
      verified = true;
      verificationResult = productionResult;
    } else if (productionResult.status === 21007) {
      const sandboxResult = await verifyWithApple(APPLE_VERIFY_URL_SANDBOX, receiptData);
      if (sandboxResult.status === 0) {
        verified = true;
        verificationResult = sandboxResult;
      } else {
        return res.status(400).json({
          error: 'INVALID_RECEIPT',
          message: '交易凭据验证失败，请确认使用的是正式环境。',
          detail: `sandbox_status: ${sandboxResult.status}`,
        });
      }
    } else {
      return res.status(400).json({
        error: 'INVALID_RECEIPT',
        message: '交易凭据验证失败。',
        detail: `production_status: ${productionResult.status}`,
      });
    }
  } catch (err) {
    return res.status(502).json({
      error: 'VERIFICATION_SERVICE_ERROR',
      message: 'Apple 验证服务暂时不可用，请稍后重试。',
    });
  }

  const latestSubscription = verificationResult.latest_receipt_info?.slice(-1)?.[0];

  const subscriptionExpiresDate = latestSubscription?.expires_date
    ? new Date(latestSubscription.expires_date)
    : null;

  if (!subscriptionExpiresDate || subscriptionExpiresDate < new Date()) {
    return res.status(400).json({
      error: 'SUBSCRIPTION_EXPIRED',
      message: '该订阅已过期，无法激活会员。',
    });
  }

  const { rows: memberships } = await sql`
    SELECT * FROM memberships WHERE user_id = ${user.id}
  `;

  if (memberships.length > 0) {
    await sql`
      UPDATE memberships SET
        membership_status = 'member',
        handbook_limit = NULL,
        ai_limit_count = 30,
        expires_at = ${subscriptionExpiresDate.toISOString()},
        updated_at = NOW()
      WHERE user_id = ${user.id}
    `;
  } else {
    await sql`
      INSERT INTO memberships (user_id, membership_status, handbook_limit, ai_remaining_count, ai_limit_count, expires_at)
      VALUES (${user.id}, 'member', NULL, 30, 30, ${subscriptionExpiresDate.toISOString()})
    `;
  }

  if (transactionId) {
    await sql`
      INSERT INTO apple_subscriptions (user_id, transaction_id, expires_at, verified_at)
      VALUES (${user.id}, ${transactionId}, ${subscriptionExpiresDate.toISOString()}, NOW())
      ON CONFLICT (transaction_id) DO UPDATE SET
        expires_at = ${subscriptionExpiresDate.toISOString()},
        verified_at = NOW()
    `;
  }

  const { rows: updated } = await sql`
    SELECT * FROM memberships WHERE user_id = ${user.id}
  `;

  return res.status(200).json({
    success: true,
    message: '会员状态已更新。',
    membership: formatMembership(updated[0]),
  });
};

async function verifyWithApple(url, receiptData) {
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      'receipt-data': receiptData,
      password: SHARED_SECRET,
      'exclude-old-transactions': false,
    }),
  });
  return response.json();
}

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
