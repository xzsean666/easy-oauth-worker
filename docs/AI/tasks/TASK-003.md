# TASK-003: 密码学基础服务与凭据安全模块

## Objective
基于原生 Web Crypto API 实现系统所需的全部密码学与令牌管理功能，包括安全的 PBKDF2 密码哈希与加盐校验、PKCE S256 挑战验证、高熵随机 Token 生成，以及基于 RS256/WebCrypto 的 JWT 签名与 JWKS 公钥导出模块。

## Scope
- `src/crypto/password.ts`: PBKDF2 密码哈希生成与时间安全比对
- `src/crypto/token.ts`: 安全随机字符串、Session ID 生成
- `src/crypto/pkce.ts`: PKCE S256 算法实现与 code_verifier 校验
- `src/crypto/jwt.ts`: RS256 签名密钥生成、ID Token 签名与 JWKS 结构导出
- `test/crypto.test.ts`: 全面单元测试覆盖上述所有密码学算法

## Allowed Files
- `src/crypto/password.ts`
- `src/crypto/token.ts`
- `src/crypto/pkce.ts`
- `src/crypto/jwt.ts`
- `test/crypto.test.ts`

## Dependencies
- TASK-001

## Inputs and Outputs
- **Inputs**: 密码字符串、PKCE verifier、密钥参数
- **Outputs**: 哈希值、安全随机 Token、符合 RFC 7517 标准的 JWKS、符合 RFC 7519 的 JWT

## Acceptance Criteria
1. 密码哈希具备随机盐与高迭代抗暴力破解特性，校验函数逻辑正确。
2. PKCE S256 严格遵循 RFC 7636 规范并通过标准用例向量验证。
3. JWT 生成、签名与验签均在 WebCrypto 原生接口下完成。
4. 单元测试全部通过。

## Verification Commands
```bash
pnpm run test test/crypto.test.ts
```

## Risks and Assumptions
- 原生 SubtleCrypto 兼容性（Cloudflare Workers 完全原生支持）。

## Status
DONE
