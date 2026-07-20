import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';
import type { Transporter } from 'nodemailer';

@Injectable()
export class MailService {
  private readonly log = new Logger(MailService.name);
  private transporter: Transporter | null = null;

  constructor(private config: ConfigService) {
    const host = this.config.get<string>('SMTP_HOST');
    if (!host) return;

    this.transporter = nodemailer.createTransport({
      host,
      port: Number(this.config.get('SMTP_PORT') ?? 587),
      secure: this.config.get('SMTP_SECURE') === 'true',
      auth: this.config.get('SMTP_USER')
        ? {
            user: this.config.getOrThrow<string>('SMTP_USER'),
            pass: this.config.getOrThrow<string>('SMTP_PASS'),
          }
        : undefined,
    });
  }

  isConfigured() {
    return !!this.transporter;
  }

  async send(to: string, subject: string, text: string, html?: string) {
    const from =
      this.config.get<string>('SMTP_FROM') ?? 'ITCLUB <noreply@clubit.local>';

    if (!this.transporter) {
      this.log.log(`[mail:stub] to=${to} subject=${subject}`);
      this.log.debug(text);
      return { queued: false, stub: true as const };
    }

    try {
      const info = await this.transporter.sendMail({
        from,
        to,
        subject,
        text,
        html: html ?? text.replace(/\n/g, '<br/>'),
      });
      this.log.log(`Mail sent to ${to}: ${info.messageId}`);
      return { queued: true, stub: false as const, messageId: info.messageId };
    } catch (err) {
      this.log.error(`Mail failed to ${to}`, err instanceof Error ? err.stack : err);
      throw err;
    }
  }

  async sendPasswordReset(to: string, code: string) {
    const subject = 'ITCLUB — Kode reset password';
    const text = [
      'Kamu meminta reset password ITCLUB.',
      '',
      `Kode verifikasi: ${code}`,
      '',
      'Kode berlaku 15 menit. Jika bukan kamu, abaikan email ini.',
    ].join('\n');
    return this.send(to, subject, text);
  }

  async sendWelcomeCredentials(
    to: string,
    username: string,
    temporaryPassword: string,
  ) {
    const subject = 'ITCLUB — Akun anggota disetujui';
    const text = [
      'Selamat! Pendaftaran ITCLUB kamu disetujui.',
      '',
      `Username: ${username}`,
      `Password sementara: ${temporaryPassword}`,
      '',
      'Segera login dan ganti password lewat menu lupa password / profil.',
      'Jangan bagikan email ini.',
    ].join('\n');
    return this.send(to, subject, text);
  }
}
