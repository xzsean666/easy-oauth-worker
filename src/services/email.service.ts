import type { Bindings } from '../types/env';

export interface EmailOptions {
  to: string;
  subject: string;
  html: string;
  text: string;
  from?: string;
  fromName?: string;
}

export interface ISocket {
  readable: ReadableStream<Uint8Array>;
  writable: WritableStream<Uint8Array>;
  close(): Promise<void>;
  startTls?: (options?: { expectedServerHostname?: string }) => ISocket;
}

export type SocketConnector = (
  address: { hostname: string; port: number },
  options?: { secureTransport?: string; allowHalfOpen?: boolean }
) => Promise<ISocket> | ISocket;

function stringToBase64(str: string): string {
  const bytes = new TextEncoder().encode(str);
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

export const DEFAULT_SMTP_TIMEOUT_MS = 10000;

function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs = DEFAULT_SMTP_TIMEOUT_MS,
  errorMsg = 'SMTP socket timeout'
): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error(errorMsg)), timeoutMs)
    ),
  ]);
}

export class SmtpBufferReader {
  private reader: ReadableStreamDefaultReader<Uint8Array>;
  private buffer: string = '';
  private decoder = new TextDecoder();

  constructor(stream: ReadableStream<Uint8Array>) {
    this.reader = stream.getReader();
  }

  async readLine(): Promise<string> {
    while (true) {
      const lineEnd = this.buffer.indexOf('\r\n');
      if (lineEnd !== -1) {
        const line = this.buffer.substring(0, lineEnd);
        this.buffer = this.buffer.substring(lineEnd + 2);
        return line;
      }
      const { value, done } = await withTimeout(
        this.reader.read(),
        DEFAULT_SMTP_TIMEOUT_MS,
        'SMTP connection read timed out'
      );
      if (done) {
        if (this.buffer.length > 0) {
          const line = this.buffer;
          this.buffer = '';
          return line;
        }
        throw new Error('Connection unexpectedly closed by SMTP server');
      }
      this.buffer += this.decoder.decode(value, { stream: true });
    }
  }

  async readResponse(): Promise<{ code: number; lines: string[] }> {
    const lines: string[] = [];
    while (true) {
      const line = await this.readLine();
      lines.push(line);
      if (line.length >= 4 && line[3] === ' ') {
        const code = parseInt(line.substring(0, 3), 10);
        return { code, lines };
      }
      if (line.length === 3) {
        const code = parseInt(line, 10);
        return { code, lines };
      }
    }
  }

  release() {
    this.reader.releaseLock();
  }
}

export class SmtpBufferWriter {
  private writer: WritableStreamDefaultWriter<Uint8Array>;
  private encoder = new TextEncoder();

  constructor(stream: WritableStream<Uint8Array>) {
    this.writer = stream.getWriter();
  }

  async writeCommand(cmd: string): Promise<void> {
    await this.writer.write(this.encoder.encode(cmd + '\r\n'));
  }

  release() {
    this.writer.releaseLock();
  }
}

export async function sendSmtpEmail(
  config: {
    host: string;
    port: number;
    username: string;
    password: string;
    from: string;
    fromName?: string;
  },
  email: EmailOptions,
  connector?: SocketConnector
): Promise<{ success: boolean; messageId?: string }> {
  let socketConnector = connector;
  if (!socketConnector) {
    const mod = await import('cloudflare:sockets');
    socketConnector = mod.connect as unknown as SocketConnector;
  }

  const isTlsDirect = config.port === 465;
  let socket = await socketConnector(
    { hostname: config.host, port: config.port },
    {
      secureTransport: isTlsDirect ? 'on' : 'starttls',
      allowHalfOpen: false,
    }
  );

  let reader = new SmtpBufferReader(socket.readable);
  let writer = new SmtpBufferWriter(socket.writable);

  try {
    // 1. Read greeting
    const greeting = await reader.readResponse();
    if (greeting.code !== 220) {
      throw new Error(`Unexpected SMTP greeting: ${greeting.code} ${greeting.lines.join(' ')}`);
    }

    // 2. EHLO
    await writer.writeCommand('EHLO localhost');
    const ehloRes = await reader.readResponse();
    if (ehloRes.code !== 250) {
      throw new Error(`EHLO failed: ${ehloRes.code} ${ehloRes.lines.join(' ')}`);
    }

    // 3. STARTTLS if port 587
    if (!isTlsDirect && socket.startTls) {
      await writer.writeCommand('STARTTLS');
      const startTlsRes = await reader.readResponse();
      if (startTlsRes.code !== 220) {
        throw new Error(`STARTTLS failed: ${startTlsRes.code}`);
      }
      reader.release();
      writer.release();

      socket = socket.startTls({ expectedServerHostname: config.host });
      reader = new SmtpBufferReader(socket.readable);
      writer = new SmtpBufferWriter(socket.writable);

      // Re-send EHLO after TLS
      await writer.writeCommand('EHLO localhost');
      const ehloTlsRes = await reader.readResponse();
      if (ehloTlsRes.code !== 250) {
        throw new Error(`EHLO after STARTTLS failed: ${ehloTlsRes.code}`);
      }
    }

    // 4. AUTH LOGIN
    await writer.writeCommand('AUTH LOGIN');
    const authPrompt = await reader.readResponse();
    if (authPrompt.code !== 334) {
      throw new Error(`AUTH LOGIN failed: ${authPrompt.code} ${authPrompt.lines.join(' ')}`);
    }

    // Send Base64 Username
    await writer.writeCommand(stringToBase64(config.username));
    const userPrompt = await reader.readResponse();
    if (userPrompt.code !== 334) {
      throw new Error(`Username submission failed: ${userPrompt.code} ${userPrompt.lines.join(' ')}`);
    }

    // Send Base64 Password
    await writer.writeCommand(stringToBase64(config.password));
    const passPrompt = await reader.readResponse();
    if (passPrompt.code !== 235) {
      throw new Error(`Authentication failed (check Gmail App Password): ${passPrompt.code} ${passPrompt.lines.join(' ')}`);
    }

    // 5. MAIL FROM
    const fromAddr = email.from || config.from;
    await writer.writeCommand(`MAIL FROM:<${fromAddr}>`);
    const mailFromRes = await reader.readResponse();
    if (mailFromRes.code !== 250) {
      throw new Error(`MAIL FROM failed: ${mailFromRes.code} ${mailFromRes.lines.join(' ')}`);
    }

    // 6. RCPT TO
    await writer.writeCommand(`RCPT TO:<${email.to}>`);
    const rcptToRes = await reader.readResponse();
    if (rcptToRes.code !== 250) {
      throw new Error(`RCPT TO failed: ${rcptToRes.code} ${rcptToRes.lines.join(' ')}`);
    }

    // 7. DATA
    await writer.writeCommand('DATA');
    const dataRes = await reader.readResponse();
    if (dataRes.code !== 354) {
      throw new Error(`DATA initiation failed: ${dataRes.code} ${dataRes.lines.join(' ')}`);
    }

    // 8. Compose and send email content
    const boundary = `boundary_${Date.now()}_${Math.random().toString(36).substring(2)}`;
    const fromHeader = config.fromName ? `"${config.fromName}" <${fromAddr}>` : fromAddr;
    const encodedSubject = `=?UTF-8?B?${stringToBase64(email.subject)}?=`;

    const rawMessage = [
      `From: ${fromHeader}`,
      `To: <${email.to}>`,
      `Subject: ${encodedSubject}`,
      `Date: ${new Date().toUTCString()}`,
      `MIME-Version: 1.0`,
      `Content-Type: multipart/alternative; boundary="${boundary}"`,
      '',
      `--${boundary}`,
      `Content-Type: text/plain; charset=UTF-8`,
      `Content-Transfer-Encoding: base64`,
      '',
      stringToBase64(email.text),
      '',
      `--${boundary}`,
      `Content-Type: text/html; charset=UTF-8`,
      `Content-Transfer-Encoding: base64`,
      '',
      stringToBase64(email.html),
      '',
      `--${boundary}--`,
      '.',
    ].join('\r\n');

    await writer.writeCommand(rawMessage);
    const sendRes = await reader.readResponse();
    if (sendRes.code !== 250) {
      throw new Error(`Email transmission failed: ${sendRes.code} ${sendRes.lines.join(' ')}`);
    }

    // 9. QUIT
    await writer.writeCommand('QUIT');
    try {
      await reader.readResponse();
    } catch {
      // Ignore EOF on quit
    }

    return { success: true };
  } finally {
    try {
      reader.release();
    } catch {}
    try {
      writer.release();
    } catch {}
    try {
      await socket.close();
    } catch {}
  }
}

/**
 * High-level helper that sends an email using bindings in Env.
 */
export async function sendEmail(
  env: Bindings,
  email: EmailOptions,
  connector?: SocketConnector
): Promise<{ success: boolean; error?: string }> {
  if (!env.SMTP_USERNAME || !env.SMTP_PASSWORD) {
    console.warn('[email.service] SMTP credentials not set, email skipped for:', email.to);
    return { success: false, error: 'SMTP credentials not configured' };
  }

  const host = env.SMTP_HOST || 'smtp.gmail.com';
  const port = parseInt(env.SMTP_PORT || '465', 10);
  const from = env.SMTP_FROM || env.SMTP_USERNAME;
  const fromName = env.SITE_NAME || 'EasyOAuth';

  try {
    const result = await sendSmtpEmail(
      {
        host,
        port,
        username: env.SMTP_USERNAME,
        password: env.SMTP_PASSWORD,
        from,
        fromName,
      },
      email,
      connector
    );
    return { success: result.success };
  } catch (err: unknown) {
    const error = err instanceof Error ? err.message : String(err);
    console.error('[email.service] Failed to send email to', email.to, ':', error);
    return { success: false, error };
  }
}
