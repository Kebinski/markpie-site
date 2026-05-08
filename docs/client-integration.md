# MarkPie 会员能力 — 客户端接入文档

## 接口基础信息

- Base URL: `https://markpie-site.vercel.app/api`
- 认证方式: Bearer Token（登录后获取）
- 请求头: `Authorization: Bearer <token>`
- 响应格式: JSON

---

## 1. 获取当前用户及会员状态

### `GET /api/auth/me`

登录后调此接口，同时获取用户信息和会员状态。

**响应示例：**

```json
{
  "id": 1,
  "provider": "wechat",
  "nickname": "用户昵称",
  "avatar_url": "https://...",
  "created_at": "2026-01-01T00:00:00.000Z",
  "last_login_at": "2026-05-06T10:00:00.000Z",
  "membership": {
    "membershipStatus": "free",
    "dailyMemoryCount": null,
    "dailyMemoryLimit": null,
    "handbookCount": 3,
    "handbookLimit": 5,
    "aiRemainingCount": 4,
    "aiLimitCount": 4,
    "resetAt": null,
    "expiresAt": null
  }
}
```

> `membership` 字段在登录后首次请求即返回，无需额外请求。

---

## 2. 兑换码接口

### `POST /api/membership/redeem`

前端已有兑换码输入框和按钮，接入此接口即可。

**请求：**

```json
{
  "code": "MARKPIE-PRO-XXXXX"
}
```

**成功响应（200）：**

```json
{
  "success": true,
  "message": "兑换成功！会员有效期至 2026/6/5。",
  "membership": {
    "membershipStatus": "member",
    "handbookLimit": null,
    "aiRemainingCount": 30,
    "aiLimitCount": 30,
    "expiresAt": "2026-06-05T06:57:00.000Z"
  }
}
```

**错误处理：**

| HTTP 状态 | `error` 值 | 前端提示 |
|-----------|-----------|----------|
| 400 | 兑换码已过期 | 该兑换码已过期，请联系客服获取新的兑换码。 |
| 400 | 兑换码已使用 | 该兑换码已被使用，无法再次兑换。 |
| 404 | 兑换码不存在 | 兑换码无效，请检查后重试。 |
| 401 | Invalid token | 重新登录 |

**客户端逻辑：**

```
用户输入兑换码 → 点击兑换
  → POST /api/membership/redeem { code }
  → 成功 → 刷新页面会员状态
  → 失败 → 显示对应错误提示
```

---

## 3. Apple 订阅购买后同步

### `POST /api/membership/apple-verify`

> 当前阶段可跳过，用兑换码代替。此接口需要在 App Store Connect 配置订阅商品并设置 `APPLE_APP_STORE_SHARED_SECRET` 环境变量后才能使用。

**请求：**

```json
{
  "receiptData": "base64 收据字符串",
  "transactionId": "事务 ID（可选）"
}
```

**成功响应（200）：**

```json
{
  "success": true,
  "message": "会员状态已更新。",
  "membership": {
    "membershipStatus": "member",
    "aiRemainingCount": 30,
    "aiLimitCount": 30,
    "expiresAt": "2026-06-05T...",
    "handbookLimit": null
  }
}
```

**客户端逻辑：**

```
用户完成 StoreKit 购买
  → 获取 transaction 和 receiptData
  → POST /api/membership/apple-verify { receiptData, transactionId }
  → 成功 → 刷新会员状态
  → 失败 → 提示重试
```

**恢复购买：** 同样的接口，传入从 StoreKit 获取的最新 receiptData 即可。

---

## 4. Membership 字段含义

| 字段 | 类型 | 说明 | FREE 值 | PRO 值 |
|------|------|------|---------|--------|
| `membershipStatus` | string | 会员状态 | `"free"` | `"member"` |
| `dailyMemoryCount` | number | 已创建记忆数 | `null` | `null` |
| `dailyMemoryLimit` | number | 记忆上限（已不限量） | `null` | `null` |
| `handbookCount` | number | 已创建手册数 | 实际数量 | 实际数量 |
| `handbookLimit` | number | 手册上限 | `5` | `null`（无上限） |
| `aiRemainingCount` | number | 本月剩余复盘次数 | 4 | 30 |
| `aiLimitCount` | number | 月度复盘总次数 | 4 | 30 |
| `resetAt` | string | 复盘重置时间 | `null` | `null` |
| `expiresAt` | string | 会员过期时间 | `null` | ISO 日期 |

---

## 5. 客户端权限判断规则

```swift
// 手册上限
if membershipStatus == "member" {
    handbookLimit = nil  // 无上限
} else {
    handbookLimit = 5
}

// AI 复盘月度额度
if membershipStatus == "member" {
    aiLimit = 30
} else {
    aiLimit = 4
}

// 回忆 — 不限量，不判断
```

---

## 6. 对接顺序建议

| 优先级 | 内容 | 状态 |
|--------|------|------|
| P0 | 会员中心展示 `expiresAt` 过期时间 | 后端已就绪 |
| P0 | 兑换码接口对接 | **后端已就绪** |
| P1 | Apple 购买后同步 | 需 App Store Connect 配置完成 |
| P1 | Apple 恢复购买同步 | 同上 |
