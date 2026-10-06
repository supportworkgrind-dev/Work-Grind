import crypto from 'crypto';
import { parsePhoneNumberFromString } from 'libphonenumber-js/max';

export type PhoneOtpPurpose = 'signup' | 'login' | 'recovery' | 'change';

export const PHONE_OTP_TTL_MS = 5 * 60_000;
export const PHONE_OTP_COOLDOWN_MS = 60_000;
export const PHONE_OTP_MAX_ATTEMPTS = 5;

export const isE164PhoneNumber = (value: unknown): value is string =>
  typeof value === 'string' &&
  /^\+[1-9]\d{7,14}$/.test(value) &&
  normalizePhoneNumber(value) === value;

export const normalizePhoneNumber = (value: unknown): string | null => {
  if (typeof value !== 'string') return null;
  const phoneNumber = parsePhoneNumberFromString(value);
  return phoneNumber?.isValid() ? phoneNumber.number : null;
};

export const createPhoneOtp = () => crypto.randomInt(100000, 1000000).toString();

const derivePhoneOtpKey = () => {
  const secret = process.env.JWT_SECRET;
  if (!secret?.trim()) throw new Error('JWT_SECRET is missing from environment');
  return crypto.createHash('sha256').update(secret).digest();
};

export const hashPhoneOtp = (phone: string, purpose: PhoneOtpPurpose, code: string) =>
  crypto.createHmac('sha256', derivePhoneOtpKey()).update(`${purpose}:${phone}:${code}`).digest('hex');

export const phoneOtpMatches = (phone: string, purpose: PhoneOtpPurpose, code: string, expectedHash: string) => {
  const actual = Buffer.from(hashPhoneOtp(phone, purpose, code), 'hex');
  const expected = Buffer.from(expectedHash, 'hex');
  return actual.length === expected.length && crypto.timingSafeEqual(actual, expected);
};

export class PhoneOtpDeliveryError extends Error {
  constructor(
    readonly diagnosticCode: 'sms_provider_unconfigured' | 'sms_provider_configuration_incomplete' |
      'sms_provider_rejected' | 'sms_provider_unavailable',
    readonly httpStatus?: number,
    readonly providerCode?: number,
  ) {
    super(diagnosticCode);
  }
}

export const sendPhoneOtp = async (phone: string, code: string): Promise<{ developmentCode?: never }> => {
  const isDevelopment = process.env.NODE_ENV === 'development';
  const provider = process.env.SMS_PROVIDER?.trim().toLowerCase() || '';
  if (provider === 'dev') {
    if (!isDevelopment) throw new PhoneOtpDeliveryError('sms_provider_unconfigured');
    console.info('[Phone OTP] Development code generated for', phone.replace(/.(?=.{4})/g, '*'), code);
    return {};
  }
  if (provider !== 'twilio') throw new PhoneOtpDeliveryError('sms_provider_unconfigured');

  const accountSid = process.env.TWILIO_ACCOUNT_SID?.trim();
  const authToken = process.env.TWILIO_AUTH_TOKEN?.trim();
  const fromNumber = process.env.TWILIO_FROM_NUMBER?.trim();
  if (!accountSid || !authToken || !fromNumber) {
    throw new PhoneOtpDeliveryError('sms_provider_configuration_incomplete');
  }

  const credentials = Buffer.from(`${accountSid}:${authToken}`).toString('base64');
  const body = new URLSearchParams({
    To: phone,
    From: fromNumber,
    Body: `Your WorkGrind verification code is ${code}. It expires in 5 minutes.`,
  });
  let response: Response;
  try {
    response = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${encodeURIComponent(accountSid)}/Messages.json`, {
      method: 'POST',
      signal: AbortSignal.timeout(10_000),
      headers: {
        Authorization: `Basic ${credentials}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body,
    });
  } catch {
    throw new PhoneOtpDeliveryError('sms_provider_unavailable');
  }
  if (!response.ok) {
    let providerCode: number | undefined;
    try {
      const result = await response.json() as { code?: unknown };
      if (typeof result.code === 'number') providerCode = result.code;
    } catch {
      // Status is sufficient when the provider response body is absent or not JSON.
    }
    console.error('[Phone OTP] SMS provider rejected delivery.', {
      provider: 'twilio',
      httpStatus: response.status,
      ...(providerCode ? { providerCode } : {}),
    });
    throw new PhoneOtpDeliveryError('sms_provider_rejected', response.status, providerCode);
  }
  return {};
};
