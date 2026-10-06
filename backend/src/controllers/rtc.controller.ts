import { Request, Response } from 'express';

const CLOUDFLARE_TURN_API = 'https://rtc.live.cloudflare.com/v1/turn/keys';
const TURN_CREDENTIAL_TTL_SECONDS = 60 * 60;

const STUN_SERVERS = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
];

interface IceServerConfig {
  urls: string | string[];
  username?: string;
  credential?: string;
}

interface CloudflareIceServerResponse {
  iceServers?: Array<{
    urls?: string | string[];
    username?: string;
    credential?: string;
  }>;
}

export async function getIceServers(_req: Request, res: Response): Promise<void> {
  res.setHeader('Cache-Control', 'no-store');

  const keyId = process.env.CLOUDFLARE_TURN_KEY_ID?.trim();
  const apiToken = process.env.CLOUDFLARE_TURN_API_TOKEN?.trim();
  if (!keyId || !apiToken) {
    res.status(503).json({
      success: false,
      code: 'TURN_CONFIGURATION_INCOMPLETE',
      message: 'Cloudflare TURN key ID and API token must be configured on the server.',
    });
    return;
  }

  let cloudflareResponse: Awaited<ReturnType<typeof fetch>>;
  try {
    cloudflareResponse = await fetch(
      `${CLOUDFLARE_TURN_API}/${encodeURIComponent(keyId)}/credentials/generate-ice-servers`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ ttl: TURN_CREDENTIAL_TTL_SECONDS }),
        signal: AbortSignal.timeout(10_000),
      },
    );
  } catch (error) {
    console.error('[RTC] Cloudflare TURN credential request failed:', error);
    res.status(502).json({
      success: false,
      code: 'TURN_CREDENTIALS_UNAVAILABLE',
      message: 'Short-lived TURN credentials could not be obtained. Please retry.',
    });
    return;
  }

  if (!cloudflareResponse.ok) {
    console.error('[RTC] Cloudflare TURN credential request returned HTTP', cloudflareResponse.status);
    res.status(502).json({
      success: false,
      code: 'TURN_CREDENTIALS_UNAVAILABLE',
      message: 'Short-lived TURN credentials could not be obtained. Please retry.',
    });
    return;
  }

  let turnConfig: CloudflareIceServerResponse;
  try {
    turnConfig = await cloudflareResponse.json() as CloudflareIceServerResponse;
  } catch (error) {
    console.error('[RTC] Cloudflare TURN response was not valid JSON:', error);
    res.status(502).json({
      success: false,
      code: 'TURN_CONFIGURATION_INVALID',
      message: 'Cloudflare returned an invalid TURN configuration.',
    });
    return;
  }

  const turnServers = (turnConfig.iceServers || []).filter((server) => {
    const urls = Array.isArray(server.urls) ? server.urls : [server.urls || ''];
    return urls.some((url) => /^turns?:/i.test(url)) &&
      Boolean(server.username?.trim()) &&
      Boolean(server.credential?.trim());
  });
  if (!turnServers.length) {
    console.error('[RTC] Cloudflare TURN response did not include valid TURN URLs and short-lived credentials.');
    res.status(502).json({
      success: false,
      code: 'TURN_CONFIGURATION_INVALID',
      message: 'Cloudflare returned no usable TURN servers.',
    });
    return;
  }

  const iceServers: IceServerConfig[] = [
    ...STUN_SERVERS,
    ...turnServers.map((server) => ({
      urls: server.urls!,
      username: server.username!,
      credential: server.credential!,
    })),
  ];

  res.json({
    success: true,
    iceServers,
    turnConfigured: true,
    credentialExpiresIn: TURN_CREDENTIAL_TTL_SECONDS,
  });
}
