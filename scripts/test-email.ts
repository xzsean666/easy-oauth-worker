import * as fs from 'node:fs';
import * as path from 'node:path';
import * as http from 'node:http';
import * as tls from 'node:tls';
import { Readable, Writable } from 'node:stream';
import { sendSmtpEmail, type ISocket } from '../src/services/email.service.ts';

/**
 * Parses simple KEY="VALUE" or KEY=VALUE files (.dev.vars or .env)
 */
function parseEnvFile(filePath: string): Record<string, string> {
  const result: Record<string, string> = {};
  if (!fs.existsSync(filePath)) return result;

  const content = fs.readFileSync(filePath, 'utf-8');
  const lines = content.split('\n');

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;

    const eqIdx = trimmed.indexOf('=');
    if (eqIdx === -1) continue;

    const key = trimmed.substring(0, eqIdx).trim();
    let val = trimmed.substring(eqIdx + 1).trim();

    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.substring(1, val.length - 1);
    }
    result[key] = val;
  }
  return result;
}

/**
 * Creates an ISocket instance either directly or via HTTP CONNECT proxy.
 */
async function createNodeSocket(
  targetHost: string,
  targetPort: number,
  proxyUrlStr?: string
): Promise<ISocket> {
  if (proxyUrlStr) {
    const proxyUrl = new URL(proxyUrlStr);
    const proxyHost = proxyUrl.hostname;
    const proxyPort = parseInt(proxyUrl.port || '80', 10);

    return new Promise((resolve, reject) => {
      const req = http.request({
        host: proxyHost,
        port: proxyPort,
        method: 'CONNECT',
        path: `${targetHost}:${targetPort}`,
        headers: { Host: `${targetHost}:${targetPort}` },
      });

      req.on('connect', (res, rawSocket) => {
        if (res.statusCode !== 200) {
          rawSocket.destroy();
          reject(new Error(`Proxy CONNECT failed with status code ${res.statusCode}`));
          return;
        }

        const tlsSocket = tls.connect(
          {
            socket: rawSocket,
            servername: targetHost,
          },
          () => {
            const readable = Readable.toWeb(tlsSocket) as ReadableStream<Uint8Array>;
            const writable = Writable.toWeb(tlsSocket) as WritableStream<Uint8Array>;

            resolve({
              readable,
              writable,
              close: async () => {
                tlsSocket.destroy();
              },
            });
          }
        );

        tlsSocket.on('error', (err) => reject(err));
      });

      req.on('error', (err) => reject(err));
      req.end();
    });
  }

  // Direct TLS connection
  return new Promise((resolve, reject) => {
    const socket = tls.connect(
      {
        host: targetHost,
        port: targetPort,
        servername: targetHost,
      },
      () => {
        const readable = Readable.toWeb(socket) as ReadableStream<Uint8Array>;
        const writable = Writable.toWeb(socket) as WritableStream<Uint8Array>;
        resolve({
          readable,
          writable,
          close: async () => {
            socket.destroy();
          },
        });
      }
    );

    socket.on('error', (err) => reject(err));
  });
}

async function main() {
  const rootDir = path.resolve(import.meta.dirname, '..');
  const devVars = parseEnvFile(path.join(rootDir, '.dev.vars'));
  const dotEnv = parseEnvFile(path.join(rootDir, '.env'));
  const config = { ...dotEnv, ...devVars, ...process.env };

  const host = config.SMTP_HOST || 'smtp.gmail.com';
  const port = parseInt(config.SMTP_PORT || '465', 10);
  const username = config.SMTP_USERNAME;
  const password = config.SMTP_PASSWORD;
  const from = config.SMTP_FROM || username || '';
  const fromName = config.SITE_NAME || 'EasyOAuth Worker';

  const recipient = process.argv[2] || 'xz_sean@qq.com';

  console.log('================================================================');
  console.log(' EasyOAuth SMTP Test Utility');
  console.log('================================================================');
  console.log(`SMTP Host:     ${host}:${port}`);
  console.log(`SMTP Username: ${username}`);
  console.log(`From Header:   ${from}`);
  console.log(`To Recipient:  ${recipient}`);

  if (!username || !password) {
    console.error('Error: SMTP_USERNAME or SMTP_PASSWORD is not configured in .dev.vars or .env');
    process.exit(1);
  }

  const proxy = process.env.https_proxy || process.env.all_proxy || process.env.http_proxy;
  if (proxy) {
    console.log(`Using Proxy:   ${proxy}`);
  } else {
    console.log('Using Proxy:   (Direct connection)');
  }
  console.log('----------------------------------------------------------------');
  console.log('Sending test email...');

  const connector = async (address: { hostname: string; port: number }): Promise<ISocket> => {
    return createNodeSocket(address.hostname, address.port, proxy);
  };

  const startTime = Date.now();
  try {
    const result = await sendSmtpEmail(
      {
        host,
        port,
        username,
        password,
        from,
        fromName,
      },
      {
        to: recipient,
        subject: `[EasyOAuth] 邮件服务配置成功测试 - ${new Date().toLocaleTimeString()}`,
        text: `您好！\n\n这是一封来自 EasyOAuth Worker 的 Gmail SMTP 发信连通性测试邮件。\n\n配置信息：\n发件服务器: ${host}:${port}\n发件账号: ${username}\n目标邮箱: ${recipient}\n发送时间: ${new Date().toLocaleString()}\n\n当您收到这封邮件，说明 Gmail 应用专用密码有效且 SMTP 发信链路畅通无阻！`,
        html: `
          <div style="max-width: 600px; margin: 0 auto; padding: 24px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #ffffff; border: 1px solid #e5e7eb; border-radius: 12px; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05);">
            <div style="display: flex; align-items: center; margin-bottom: 20px;">
              <h2 style="margin: 0; color: #4338ca; font-size: 20px;">🚀 EasyOAuth 邮件配置测试成功</h2>
            </div>
            <p style="color: #374151; font-size: 15px; line-height: 1.6;">
              您好！这是一封来自 <strong>EasyOAuth Worker</strong> 的发信连通性验证邮件。
            </p>
            <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 16px; margin: 20px 0; font-size: 14px; line-height: 1.8; color: #1e293b;">
              <div><strong>发件邮箱:</strong> <span style="font-family: monospace; color: #0284c7;">${username}</span></div>
              <div><strong>收件邮箱:</strong> <span style="font-family: monospace; color: #0284c7;">${recipient}</span></div>
              <div><strong>SMTP 服务器:</strong> <span style="font-family: monospace;">${host}:${port} (SSL/TLS)</span></div>
              <div><strong>发送时间:</strong> ${new Date().toLocaleString()}</div>
              <div><strong>发信结果:</strong> <span style="color: #16a34a; font-weight: 600;">✓ 250 2.0.0 OK Message Queued</span></div>
            </div>
            <p style="color: #4b5563; font-size: 14px; line-height: 1.6;">
              本地开发配置文件 <code style="background-color: #e5e7eb; padding: 2px 6px; border-radius: 4px; font-family: monospace;">.dev.vars</code> 与生产配置模版已同步配置就绪。系统已可正常发送注册验证邮件及密码重置链接。
            </p>
            <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 24px 0;" />
            <p style="color: #9ca3af; font-size: 12px; margin: 0;">
              EasyOAuth Worker · 轻量级自托管 OAuth 2.0 / OIDC 认证中心
            </p>
          </div>
        `,
      },
      connector
    );

    const elapsed = Date.now() - startTime;
    console.log('----------------------------------------------------------------');
    console.log(`[SUCCESS] Email sent successfully to ${recipient} in ${elapsed}ms!`);
    console.log('Result:', JSON.stringify(result, null, 2));
    console.log('================================================================');
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    console.error('----------------------------------------------------------------');
    console.error('[FAILED] Failed to send email:', errorMsg);
    console.log('================================================================');
    process.exit(1);
  }
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
