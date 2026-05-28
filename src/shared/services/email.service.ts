import nodemailer from 'nodemailer';
import type { Transporter } from 'nodemailer';
import logger from '../utils/logger';

let transporter: Transporter | null = null;

function smtpConfigured(): boolean {
  return Boolean(process.env.SMTP_USER && process.env.SMTP_PASS);
}

function getTransporter(): Transporter | null {
  if (!smtpConfigured()) return null;
  if (!transporter) {
    const port = parseInt(process.env.SMTP_PORT || '587', 10);
    transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST || 'smtp.gmail.com',
      port,
      secure: process.env.SMTP_SECURE === 'true',
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });
  }
  return transporter;
}

function frontendUrl(): string {
  return process.env.FRONTEND_URL || 'http://localhost:5173';
}

function fromAddress(): string {
  return process.env.SMTP_FROM || process.env.SMTP_USER || 'NOTAP Compliance <noreply@notap.gov.ng>';
}

export class EmailService {
  static async sendMail(opts: {
    to: string;
    subject: string;
    html: string;
    text?: string;
  }): Promise<boolean> {
    const transport = getTransporter();
    if (!transport) {
      logger.info(`📧 [SMTP not configured] To: ${opts.to} | Subject: ${opts.subject}`);
      logger.info(`   Body preview: ${(opts.text || opts.html).slice(0, 200)}...`);
      return false;
    }
    await transport.sendMail({
      from: fromAddress(),
      to: opts.to,
      subject: opts.subject,
      html: opts.html,
      text: opts.text || opts.html.replace(/<[^>]+>/g, ' '),
    });
    logger.info(`📧 Email sent to ${opts.to}: ${opts.subject}`);
    return true;
  }

  static async sendAccountSetupInvite(opts: {
    email: string;
    name: string;
    token: string;
    invitedBy?: string;
    portalRole?: 'admin' | 'partner' | 'acquirer';
  }) {
    const setupUrl = `${frontendUrl()}/set-password?token=${opts.token}`;
    const roleLabels: Record<string, string> = {
      admin: 'NOTAP staff',
      partner: 'Local Partner',
      acquirer: 'Software Acquirer',
    };
    const roleLabel = opts.portalRole ? roleLabels[opts.portalRole] || 'NOTAP Compliance' : 'NOTAP Compliance';
    const inviterLine = opts.invitedBy
      ? `<p><strong>${opts.invitedBy}</strong> invited you to join the NOTAP Compliance Platform as <strong>${roleLabel}</strong>.</p>`
      : `<p>You have been invited to join the NOTAP Compliance Platform as <strong>${roleLabel}</strong>.</p>`;

    const html = `
      <div style="font-family: sans-serif; max-width: 560px;">
        <p>Hello <strong>${opts.name}</strong>,</p>
        ${inviterLine}
        <p>Create your password using the link below (valid for 7 days):</p>
        <p><a href="${setupUrl}" style="display:inline-block;padding:12px 24px;background:#2563eb;color:#fff;text-decoration:none;border-radius:8px;">Set your password</a></p>
        <p style="font-size:12px;color:#64748b;">Or copy this URL: ${setupUrl}</p>
        <p style="font-size:12px;color:#64748b;">If you did not expect this invitation, you can ignore this email.</p>
      </div>
    `;

    const sent = await this.sendMail({
      to: opts.email,
      subject: 'NOTAP — Set up your account password',
      html,
      text: `Set your password: ${setupUrl}`,
    });
    if (!sent) logger.info(`🔗 Account setup URL: ${setupUrl}`);
    return true;
  }

  static async sendPasswordReset(email: string, token: string) {
    const resetUrl = `${frontendUrl()}/set-password?token=${token}`;
    const html = `
      <p>You requested a password reset for your NOTAP Compliance account.</p>
      <p><a href="${resetUrl}">Reset your password</a></p>
      <p>This link expires in 1 hour. If you did not request this, ignore this email.</p>
    `;
    const sent = await this.sendMail({
      to: email,
      subject: 'NOTAP — Reset your password',
      html,
      text: `Reset your password: ${resetUrl}`,
    });
    if (!sent) logger.info(`🔗 Reset URL: ${resetUrl}`);
    return true;
  }

  static async sendEmailVerification(opts: { email: string; name: string; token: string }) {
    const verifyUrl = `${frontendUrl()}/verify-email?token=${opts.token}`;
    const html = `
      <div style="font-family: sans-serif; max-width: 560px;">
        <p>Hello <strong>${opts.name}</strong>,</p>
        <p>Thank you for registering on the NOTAP Compliance Platform. Please verify your email address:</p>
        <p><a href="${verifyUrl}" style="display:inline-block;padding:12px 24px;background:#2563eb;color:#fff;text-decoration:none;border-radius:8px;">Verify email address</a></p>
        <p style="font-size:12px;color:#64748b;">Or copy this URL: ${verifyUrl}</p>
        <p style="font-size:12px;color:#64748b;">This link expires in 48 hours. After verification, your registration will remain pending until NOTAP approves your organisation.</p>
      </div>
    `;
    const sent = await this.sendMail({
      to: opts.email,
      subject: 'NOTAP — Verify your email address',
      html,
      text: `Verify your email: ${verifyUrl}`,
    });
    if (!sent) logger.info(`🔗 Email verification URL: ${verifyUrl}`);
    return true;
  }

  static async sendRegistrationApproved(opts: {
    email: string;
    name: string;
    companyName: string;
  }) {
    const loginUrl = `${frontendUrl()}/login`;
    const html = `
      <div style="font-family: sans-serif; max-width: 560px;">
        <p>Hello <strong>${opts.name}</strong>,</p>
        <p>Your registration for <strong>${opts.companyName}</strong> has been <strong>approved</strong> by NOTAP.</p>
        <p>You may now sign in to the Compliance Platform and begin your technology transfer submissions.</p>
        <p><a href="${loginUrl}" style="display:inline-block;padding:12px 24px;background:#2563eb;color:#fff;text-decoration:none;border-radius:8px;">Sign in to NOTAP</a></p>
        <p style="font-size:12px;color:#64748b;">Or copy this URL: ${loginUrl}</p>
      </div>
    `;
    return this.sendMail({
      to: opts.email,
      subject: 'NOTAP — Your organisation registration has been approved',
      html,
      text: `Your registration for ${opts.companyName} was approved. Sign in: ${loginUrl}`,
    });
  }

  static async sendRegistrationRejected(opts: {
    email: string;
    name: string;
    companyName: string;
    reason: string;
  }) {
    const html = `
      <div style="font-family: sans-serif; max-width: 560px;">
        <p>Hello <strong>${opts.name}</strong>,</p>
        <p>Your registration request for <strong>${opts.companyName}</strong> was <strong>not approved</strong> at this time.</p>
        <p><strong>Reason:</strong></p>
        <p style="background:#fef2f2;padding:12px;border-radius:8px;color:#991b1b;">${opts.reason}</p>
        <p style="font-size:12px;color:#64748b;">If you believe this was in error, contact NOTAP support.</p>
      </div>
    `;
    return this.sendMail({
      to: opts.email,
      subject: 'NOTAP — Registration not approved',
      html,
      text: `Registration for ${opts.companyName} was not approved. Reason: ${opts.reason}`,
    });
  }

  static async sendOrganizationInvite(opts: {
    email: string;
    inviteeName?: string;
    intendedRole: 'local_partner' | 'acquirer';
    inviterOrgName: string;
    technologyLabel?: string;
    token: string;
  }) {
    const signupUrl = `${frontendUrl()}/signup?invite=${opts.token}`;
    const roleLabel =
      opts.intendedRole === 'local_partner' ? 'Local Partner' : 'Software Acquirer';
    const subject =
      opts.intendedRole === 'local_partner'
        ? 'NOTAP — Register as Local Partner to complete a technology submission'
        : 'NOTAP — Register as Software Acquirer to complete a technology submission';

    const techLine = opts.technologyLabel
      ? `<p><strong>Technology:</strong> ${opts.technologyLabel}</p>`
      : '';

    const greeting = opts.inviteeName
      ? `<p>Hello <strong>${opts.inviteeName}</strong>,</p>`
      : '';

    const html = `
      <div style="font-family: sans-serif; max-width: 560px;">
        ${greeting}
        <p><strong>${opts.inviterOrgName}</strong> has invited you to join the NOTAP Compliance Platform as a <strong>${roleLabel}</strong>.</p>
        ${techLine}
        <p>Please register using the link below (valid for 14 days):</p>
        <p><a href="${signupUrl}" style="display:inline-block;padding:12px 24px;background:#2563eb;color:#fff;text-decoration:none;border-radius:8px;">Create your account</a></p>
        <p style="font-size:12px;color:#64748b;">Or copy this URL: ${signupUrl}</p>
      </div>
    `;

    const sent = await this.sendMail({
      to: opts.email,
      subject,
      html,
      text: `${opts.inviterOrgName} invited you to register as ${roleLabel}. Sign up: ${signupUrl}`,
    });
    if (!sent) logger.info(`🔗 Invite signup URL: ${signupUrl}`);
    return true;
  }
}
