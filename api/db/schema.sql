-- 用户表
CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    display_id TEXT UNIQUE,
    wechat_openid TEXT UNIQUE,
    wechat_unionid TEXT,
    apple_user_id TEXT UNIQUE,
    nickname TEXT,
    avatar_url TEXT,
    provider TEXT NOT NULL DEFAULT 'wechat',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    last_login_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 登录 token 表
CREATE TABLE IF NOT EXISTS auth_tokens (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token TEXT UNIQUE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    last_used_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 登录记录表（用于统计）
CREATE TABLE IF NOT EXISTS login_records (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    method TEXT NOT NULL DEFAULT 'wechat',
    ip_address TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_auth_tokens_token ON auth_tokens(token);
CREATE INDEX IF NOT EXISTS idx_login_records_created_at ON login_records(created_at);
CREATE INDEX IF NOT EXISTS idx_login_records_user_id ON login_records(user_id);

-- 会员表
CREATE TABLE IF NOT EXISTS memberships (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    membership_status TEXT NOT NULL DEFAULT 'free',
    daily_memory_count INTEGER,
    daily_memory_limit INTEGER,
    handbook_count INTEGER DEFAULT 0,
    handbook_limit INTEGER DEFAULT 5,
    ai_remaining_count INTEGER DEFAULT 4,
    ai_limit_count INTEGER DEFAULT 4,
    reset_at TIMESTAMP WITH TIME ZONE,
    expires_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_id)
);

CREATE INDEX IF NOT EXISTS idx_memberships_user_id ON memberships(user_id);

-- 兑换码表
CREATE TABLE IF NOT EXISTS redemption_codes (
    id SERIAL PRIMARY KEY,
    code TEXT UNIQUE NOT NULL,
    duration_days INTEGER NOT NULL,
    max_uses INTEGER NOT NULL DEFAULT 1,
    use_count INTEGER NOT NULL DEFAULT 0,
    expires_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_redemption_codes_code ON redemption_codes(code);

-- Apple 订阅记录表
CREATE TABLE IF NOT EXISTS apple_subscriptions (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    transaction_id TEXT UNIQUE NOT NULL,
    expires_at TIMESTAMP WITH TIME ZONE,
    verified_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_apple_subscriptions_user_id ON apple_subscriptions(user_id);
