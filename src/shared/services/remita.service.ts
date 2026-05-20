import crypto from 'crypto';
import logger from '../utils/logger';

export interface RemitaInitParams {
  orderId: string;
  amount: number;
  payerName: string;
  payerEmail: string;
  payerPhone?: string;
  description: string;
}

export interface RemitaInitResult {
  rrr: string;
  paymentUrl: string;
  simulated: boolean;
}

export interface RemitaVerifyResult {
  paid: boolean;
  status: string;
  simulated: boolean;
}

function isConfigured(): boolean {
  return Boolean(
    process.env.REMITA_MERCHANT_ID &&
      process.env.REMITA_API_KEY &&
      process.env.REMITA_SERVICE_TYPE_ID
  );
}

function baseUrl(): string {
  return (
    process.env.REMITA_BASE_URL ||
    'https://remitademo.net/remita/exapp/api/v1/send/api'
  ).replace(/\/$/, '');
}

function paymentPageBase(): string {
  return (
    process.env.REMITA_PAYMENT_URL_BASE ||
    'https://remitademo.net/remita/ecomm/finalize.reg'
  ).replace(/\/$/, '');
}

function buildHash(...parts: string[]): string {
  return crypto.createHash('sha512').update(parts.join('')).digest('hex');
}

export class RemitaService {
  static configured(): boolean {
    return isConfigured();
  }

  static async generateRRR(params: RemitaInitParams): Promise<RemitaInitResult> {
    if (!isConfigured()) {
      const rrr = `RRR-${Date.now().toString(36).toUpperCase()}`
      logger.warn('Remita not configured — using simulated RRR');
      return {
        rrr,
        paymentUrl: '',
        simulated: true,
      };
    }

    const merchantId = process.env.REMITA_MERCHANT_ID!;
    const apiKey = process.env.REMITA_API_KEY!;
    const serviceTypeId = process.env.REMITA_SERVICE_TYPE_ID!;
    const amount = String(Math.round(params.amount));
    const orderId = params.orderId;

    const apiHash = buildHash(merchantId, serviceTypeId, orderId, amount, apiKey);

    const body = {
      serviceTypeId,
      amount,
      orderId,
      payerName: params.payerName,
      payerEmail: params.payerEmail,
      payerPhone: params.payerPhone || '08000000000',
      description: params.description,
    };

    const res = await fetch(`${baseUrl()}/echannelsvc/merchant/api/paymentinit`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `remitaConsumerKey=${merchantId},remitaConsumerToken=${apiHash}`,
      },
      body: JSON.stringify(body),
    });

    const data = (await res.json()) as Record<string, unknown>;
    const statusCode = String(data.statuscode ?? data.statusCode ?? '');
    const rrr = String(data.RRR ?? data.rrr ?? '');

    if (!res.ok || (statusCode && statusCode !== '025' && statusCode !== '00')) {
      logger.error('Remita RRR generation failed', { data });
      throw new Error(
        (data.statusMessage as string) ||
          (data.message as string) ||
          'Remita could not generate payment reference'
      );
    }

    if (!rrr) {
      throw new Error('Remita did not return an RRR');
    }

    return {
      rrr,
      paymentUrl: `${paymentPageBase()}/${rrr}`,
      simulated: false,
    };
  }

  static async verifyRRR(rrr: string): Promise<RemitaVerifyResult> {
    if (!isConfigured()) {
      logger.warn('Remita not configured — simulating successful verification');
      return { paid: true, status: '00', simulated: true };
    }

    const merchantId = process.env.REMITA_MERCHANT_ID!;
    const apiKey = process.env.REMITA_API_KEY!;
    const apiHash = buildHash(rrr, apiKey, merchantId);

    const url = `${baseUrl()}/echannelsvc/${merchantId}/${rrr}/${apiHash}/status.reg`;
    const res = await fetch(url, { method: 'GET' });
    const data = (await res.json()) as Record<string, unknown>;
    const status = String(data.status ?? data.statuscode ?? '');
    const paid = status === '00' || status === '01';

    return { paid, status, simulated: false };
  }
}
