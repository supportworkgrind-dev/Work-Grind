import { Request, Response } from 'express';

type RequestWithRawBody = Request & { rawBody?: Buffer };

export function capturePolarWebhookRawBody(req: Request, _res: Response, body: Buffer): void {
  if (req.url?.split('?')[0] === '/api/subscription/webhook') {
    (req as RequestWithRawBody).rawBody = Buffer.from(body);
  }
}
