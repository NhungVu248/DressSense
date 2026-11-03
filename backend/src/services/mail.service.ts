import nodemailer, { type Transporter } from 'nodemailer';
import { env, mailEnabled } from '../config/env';

// ============================================================
//  Gửi email qua SMTP (nodemailer). Cấu hình SMTP_* ở .env.
//  Chưa cấu hình -> ném MailNotConfiguredError để tầng trên báo lỗi rõ ràng.
// ============================================================

let transporter: Transporter | null = null;

function getTransporter(): Transporter {
  if (!transporter) {
    transporter = nodemailer.createTransport({
      host: env.smtp.host,
      port: env.smtp.port,
      secure: env.smtp.secure,
      auth: { user: env.smtp.user, pass: env.smtp.pass },
    });
  }
  return transporter;
}

export class MailNotConfiguredError extends Error {
  constructor() { super('MAIL_NOT_CONFIGURED'); this.name = 'MailNotConfiguredError'; }
}

export interface MailAttachment { filename: string; content: string | Buffer; contentType?: string }

export async function sendMail(opts: { to: string; subject: string; html: string; attachments?: MailAttachment[] }): Promise<void> {
  if (!mailEnabled()) throw new MailNotConfiguredError();
  await getTransporter().sendMail({
    from: env.smtp.from,
    to: opts.to,
    subject: opts.subject,
    html: opts.html,
    attachments: opts.attachments,
  });
}
