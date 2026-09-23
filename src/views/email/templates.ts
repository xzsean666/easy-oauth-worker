export interface EmailTemplate {
  subject: string;
  html: string;
  text: string;
}

export function getVerifyEmailTemplate(siteName: string, verifyUrl: string): EmailTemplate {
  const subject = `Verify your email address - ${siteName}`;

  const text = `
Welcome to ${siteName}!

Please verify your email address by opening the following link in your browser:
${verifyUrl}

This link will expire in 24 hours. If you did not create an account, you can safely ignore this email.
`.trim();

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>${subject}</title>
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f4f4f7; color: #333333; margin: 0; padding: 32px 16px;">
  <div style="max-width: 560px; margin: 0 auto; background-color: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.06);">
    <div style="background-color: #4f46e5; padding: 24px; text-align: center;">
      <h1 style="color: #ffffff; margin: 0; font-size: 22px; font-weight: 700;">${siteName}</h1>
    </div>
    <div style="padding: 32px 24px;">
      <h2 style="margin-top: 0; font-size: 18px; color: #111827;">Confirm your email address</h2>
      <p style="font-size: 14px; line-height: 1.6; color: #4b5563;">
        Thank you for joining ${siteName}! Click the button below to verify your email address and activate your account.
      </p>
      <div style="text-align: center; margin: 32px 0;">
        <a href="${verifyUrl}" style="background-color: #4f46e5; color: #ffffff; text-decoration: none; padding: 12px 28px; border-radius: 6px; font-weight: 600; font-size: 14px; display: inline-block;">
          Verify Email
        </a>
      </div>
      <p style="font-size: 12px; line-height: 1.5; color: #9ca3af; margin-bottom: 0;">
        If the button above does not work, copy and paste this URL into your browser:<br>
        <a href="${verifyUrl}" style="color: #4f46e5; word-break: break-all;">${verifyUrl}</a>
      </p>
    </div>
    <div style="background-color: #f9fafb; padding: 16px 24px; text-align: center; font-size: 12px; color: #9ca3af; border-top: 1px solid #e5e7eb;">
      This verification link will expire in 24 hours. If you did not request this, please ignore this email.
    </div>
  </div>
</body>
</html>
`.trim();

  return { subject, html, text };
}

export function getResetPasswordTemplate(siteName: string, resetUrl: string): EmailTemplate {
  const subject = `Reset your password - ${siteName}`;

  const text = `
You recently requested to reset your password for ${siteName}.

Please click the link below to set a new password:
${resetUrl}

This link will expire in 1 hour. If you did not request a password reset, please ignore this email.
`.trim();

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>${subject}</title>
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f4f4f7; color: #333333; margin: 0; padding: 32px 16px;">
  <div style="max-width: 560px; margin: 0 auto; background-color: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.06);">
    <div style="background-color: #4f46e5; padding: 24px; text-align: center;">
      <h1 style="color: #ffffff; margin: 0; font-size: 22px; font-weight: 700;">${siteName}</h1>
    </div>
    <div style="padding: 32px 24px;">
      <h2 style="margin-top: 0; font-size: 18px; color: #111827;">Reset Your Password</h2>
      <p style="font-size: 14px; line-height: 1.6; color: #4b5563;">
        We received a request to reset your password. Click the button below to choose a new password.
      </p>
      <div style="text-align: center; margin: 32px 0;">
        <a href="${resetUrl}" style="background-color: #4f46e5; color: #ffffff; text-decoration: none; padding: 12px 28px; border-radius: 6px; font-weight: 600; font-size: 14px; display: inline-block;">
          Reset Password
        </a>
      </div>
      <p style="font-size: 12px; line-height: 1.5; color: #9ca3af; margin-bottom: 0;">
        If you did not request a password reset, you can safely ignore this email. Your password will remain unchanged.
      </p>
    </div>
    <div style="background-color: #f9fafb; padding: 16px 24px; text-align: center; font-size: 12px; color: #9ca3af; border-top: 1px solid #e5e7eb;">
      This password reset link will expire in 1 hour.
    </div>
  </div>
</body>
</html>
`.trim();

  return { subject, html, text };
}
