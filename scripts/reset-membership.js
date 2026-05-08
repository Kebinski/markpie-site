const { sql } = require('@vercel/postgres');

async function main() {
  const userId = process.argv[2];
  if (!userId) {
    console.log('用法: node scripts/reset-membership.js <user_id>');
    console.log('示例: node scripts/reset-membership.js 45');
    process.exit(1);
  }

  await sql`
    UPDATE memberships SET
      membership_status = 'free',
      handbook_limit = 5,
      ai_remaining_count = 4,
      ai_limit_count = 4,
      expires_at = NULL,
      updated_at = NOW()
    WHERE user_id = ${Number(userId)}
  `;

  console.log(`用户 ${userId} 已恢复为免费账号`);
}

main().catch(e => console.error(e));
