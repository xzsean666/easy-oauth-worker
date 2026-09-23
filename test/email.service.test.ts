import { describe, it, expect } from 'vitest';
import {
  getVerifyEmailTemplate,
  getResetPasswordTemplate,
} from '../src/views/email/templates';
import {
  sendSmtpEmail,
  sendEmail,
  type ISocket,
  type SocketConnector,
} from '../src/services/email.service';
import type { Bindings } from '../src/types/env';

/**
 * Creates a mock SMTP socket that simulates an SMTP server exchange.
 */
function createMockSmtpServer(options?: {
  failAuth?: boolean;
  failGreeting?: boolean;
}): { connector: SocketConnector; receivedCommands: string[] } {
  const receivedCommands: string[] = [];

  const connector: SocketConnector = () => {
    // Stream for client -> server
    const toServer = new TransformStream<Uint8Array, Uint8Array>();
    const serverReader = toServer.readable.getReader();

    // Stream for server -> client
    const toClient = new TransformStream<Uint8Array, Uint8Array>();
    const serverWriter = toClient.writable.getWriter();

    const enc = new TextEncoder();
    const dec = new TextDecoder();

    // Simulated server loop
    (async () => {
      const sendLine = async (line: string) => {
        await serverWriter.write(enc.encode(line + '\r\n'));
      };

      if (options?.failGreeting) {
        await sendLine('554 Service unavailable');
        return;
      }

      await sendLine('220 smtp.gmail.com ESMTP easy-oauth');

      let buffer = '';
      while (true) {
        const { value, done } = await serverReader.read();
        if (done) break;
        buffer += dec.decode(value, { stream: true });

        while (buffer.includes('\r\n')) {
          const idx = buffer.indexOf('\r\n');
          const line = buffer.substring(0, idx);
          buffer = buffer.substring(idx + 2);
          receivedCommands.push(line);

          if (line.startsWith('EHLO')) {
            await sendLine('250-smtp.gmail.com at your service');
            await sendLine('250-AUTH LOGIN');
            await sendLine('250 8BITMIME');
          } else if (line === 'AUTH LOGIN') {
            await sendLine('334 VXNlcm5hbWU6'); // base64 "Username:"
          } else if (receivedCommands[receivedCommands.length - 2] === 'AUTH LOGIN') {
            // Received username
            await sendLine('334 UGFzc3dvcmQ6'); // base64 "Password:"
          } else if (
            receivedCommands.length >= 3 &&
            receivedCommands[receivedCommands.length - 3] === 'AUTH LOGIN'
          ) {
            // Received password
            if (options?.failAuth) {
              await sendLine('535 5.7.8 Authentication credentials invalid');
              return;
            } else {
              await sendLine('235 2.7.0 Accepted');
            }
          } else if (line.startsWith('MAIL FROM:')) {
            await sendLine('250 2.1.0 OK');
          } else if (line.startsWith('RCPT TO:')) {
            await sendLine('250 2.1.5 OK');
          } else if (line === 'DATA') {
            await sendLine('354 Go ahead');
          } else if (line === '.') {
            await sendLine('250 2.0.0 OK message queued');
          } else if (line === 'QUIT') {
            await sendLine('221 2.0.0 Bye');
            return;
          }
        }
      }
    })().catch(() => {});

    const socket: ISocket = {
      readable: toClient.readable,
      writable: toServer.writable,
      close: async () => {},
    };

    return socket;
  };

  return { connector, receivedCommands };
}

describe('Email Templates', () => {
  it('generates verification email with site name and link', () => {
    const template = getVerifyEmailTemplate('My Auth Service', 'https://auth.example.com/verify-email?token=xyz123');

    expect(template.subject).toContain('My Auth Service');
    expect(template.text).toContain('https://auth.example.com/verify-email?token=xyz123');
    expect(template.html).toContain('Verify Email');
    expect(template.html).toContain('https://auth.example.com/verify-email?token=xyz123');
  });

  it('generates password reset email with site name and reset link', () => {
    const template = getResetPasswordTemplate('My Auth Service', 'https://auth.example.com/reset-password?token=abc456');

    expect(template.subject).toContain('Reset your password');
    expect(template.text).toContain('https://auth.example.com/reset-password?token=abc456');
    expect(template.html).toContain('Reset Password');
    expect(template.html).toContain('https://auth.example.com/reset-password?token=abc456');
  });
});

describe('SMTP Client and Socket Protocol', () => {
  it('successfully completes SMTP handshake, authentication and email delivery', async () => {
    const { connector, receivedCommands } = createMockSmtpServer();

    const result = await sendSmtpEmail(
      {
        host: 'smtp.gmail.com',
        port: 465,
        username: 'sender@gmail.com',
        password: 'app-password-1234',
        from: 'sender@gmail.com',
        fromName: 'EasyOAuth Admin',
      },
      {
        to: 'recipient@example.com',
        subject: 'Test Subject',
        text: 'Hello, this is a plain text email.',
        html: '<p>Hello, this is an HTML email.</p>',
      },
      connector
    );

    expect(result.success).toBe(true);

    // Verify SMTP sequence in received commands
    expect(receivedCommands).toContain('EHLO localhost');
    expect(receivedCommands).toContain('AUTH LOGIN');
    expect(receivedCommands).toContain('MAIL FROM:<sender@gmail.com>');
    expect(receivedCommands).toContain('RCPT TO:<recipient@example.com>');
    expect(receivedCommands).toContain('DATA');
    expect(receivedCommands).toContain('.');
    expect(receivedCommands).toContain('QUIT');
  });

  it('handles authentication failure (e.g. invalid Gmail App Password)', async () => {
    const { connector } = createMockSmtpServer({ failAuth: true });

    await expect(
      sendSmtpEmail(
        {
          host: 'smtp.gmail.com',
          port: 465,
          username: 'sender@gmail.com',
          password: 'bad-password',
          from: 'sender@gmail.com',
        },
        {
          to: 'user@example.com',
          subject: 'Test',
          text: 'Text',
          html: '<p>Html</p>',
        },
        connector
      )
    ).rejects.toThrow('Authentication failed');
  });

  it('handles unexpected initial server greeting failure', async () => {
    const { connector } = createMockSmtpServer({ failGreeting: true });

    await expect(
      sendSmtpEmail(
        {
          host: 'smtp.gmail.com',
          port: 465,
          username: 'user',
          password: 'pwd',
          from: 'user@example.com',
        },
        {
          to: 'to@example.com',
          subject: 'Test',
          text: 'Text',
          html: '<p>Html</p>',
        },
        connector
      )
    ).rejects.toThrow('Unexpected SMTP greeting');
  });

  it('sendEmail gracefully warns and returns failure if SMTP credentials are missing', async () => {
    const mockEnv: Bindings = {
      DB: {} as D1Database,
      AUTH_URL: 'http://localhost:8787',
      SITE_NAME: 'Test',
      // SMTP_USERNAME and SMTP_PASSWORD missing
    };

    const res = await sendEmail(mockEnv, {
      to: 'nobody@example.com',
      subject: 'Test',
      text: 'Test',
      html: '<p>Test</p>',
    });

    expect(res.success).toBe(false);
    expect(res.error).toBe('SMTP credentials not configured');
  });
});
