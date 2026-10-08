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
      'sms_provider_rejected' | 'sms_provider_unavailable' |
      'whatsapp_provider_configuration_incomplete' | 'whatsapp_provider_rejected' |
      'whatsapp_provider_unavailable',
    readonly httpStatus?: number,
    readonly providerCode?: number,
    readonly providerType?: string,
    readonly providerMessage?: string,
    readonly providerSubcode?: number,
  ) {
    super(diagnosticCode);
  }
}

const safeProviderText = (value: unknown, secrets: string[], maxLength: number): string | undefined => {
  if (typeof value !== 'string') return undefined;
  let sanitized = value.replace(/[\r\n\t]+/g, ' ').slice(0, maxLength);
  for (const secret of secrets) {
    if (secret) sanitized = sanitized.split(secret).join('[REDACTED]');
  }
  return sanitized;
};

export const sendPhoneOtp = async (phone: string, code: string): Promise<{ developmentCode?: never }> => {
  const isDevelopment = process.env.NODE_ENV === 'development';
  const selectedProvider = process.env.SMS_PROVIDER?.trim().toLowerCase() || '';
  const whatsappAccessToken = process.env.WHATSAPP_ACCESS_TOKEN?.trim();
  const whatsappPhoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID?.trim();
  const hasWhatsAppSettings = Boolean(
    whatsappAccessToken ||
    whatsappPhoneNumberId ||
    process.env.WHATSAPP_BUSINESS_ACCOUNT_ID?.trim(),
  );
  const provider = selectedProvider || (hasWhatsAppSettings ? 'whatsapp' : '');
  if (provider === 'dev') {
    if (!isDevelopment) throw new PhoneOtpDeliveryError('sms_provider_unconfigured');
    console.info('[Phone OTP] Development code generated for', phone.replace(/.(?=.{4})/g, '*'), code);
    return {};
  }
  if (provider === 'whatsapp') {
    if (!whatsappAccessToken || !whatsappPhoneNumberId) {
      throw new PhoneOtpDeliveryError('whatsapp_provider_configuration_incomplete');
    }

    let response: Response;
    try {
      response = await fetch(
        `https://graph.facebook.com/v25.0/${encodeURIComponent(whatsappPhoneNumberId)}/messages`,
        {
          method: 'POST',
          signal: AbortSignal.timeout(10_000),
          headers: {
            Authorization: `Bearer ${whatsappAccessToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            messaging_product: 'whatsapp',
            recipient_type: 'individual',
            to: phone.replace(/^\+/, ''),
            type: 'template',
            template: {
              name: 'verification_code',
              language: { code: 'en_US' },
              components: [
                { type: 'body', parameters: [{ type: 'text', text: code }] },
                {
                  type: 'button',
                  sub_type: 'url',
                  index: '0',
                  parameters: [{ type: 'text', text: code }],
                },
              ],
            },
          }),
        },
      );
    } catch {
      throw new PhoneOtpDeliveryError('whatsapp_provider_unavailable');
    }
    if (!response.ok) {
      let providerCode: number | undefined;
      let providerSubcode: number | undefined;
      let providerType: string | undefined;
      let providerMessage: string | undefined;
      try {
        const result = await response.json() as {
          error?: { code?: unknown; error_subcode?: unknown; type?: unknown; message?: unknown };
        };
        if (typeof result.error?.code === 'number') providerCode = result.error.code;
        if (typeof result.error?.error_subcode === 'number') providerSubcode = result.error.error_subcode;
        const sensitiveValues = [whatsappAccessToken, code, phone, phone.replace(/^\+/, '')];
        providerType = safeProviderText(result.error?.type, sensitiveValues, 100);
        providerMessage = safeProviderText(result.error?.message, sensitiveValues, 500);
      } catch {
        // Status is sufficient when the provider response body is absent or not JSON.
      }
      throw new PhoneOtpDeliveryError(
        'whatsapp_provider_rejected',
        response.status,
        providerCode,
        providerType,
        providerMessage,
        providerSubcode,
      );
    }
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
