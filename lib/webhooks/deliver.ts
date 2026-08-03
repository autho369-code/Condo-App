import 'server-only';

import { createHmac } from 'node:crypto';
import { request as httpsRequest } from 'node:https';
import { resolvePublicWebhookTarget } from './url';

export type WebhookDelivery = {
  deliveryId: string;
  endpointUrl: string;
  eventType: string;
  payload: unknown;
  signingSecret: string;
};

export function webhookSignature(secret: string, timestamp: string, body: string) {
  return createHmac('sha256', secret).update(`${timestamp}.${body}`).digest('hex');
}

export async function deliverWebhook(delivery: WebhookDelivery): Promise<{ status: number; body: string }> {
  const target = await resolvePublicWebhookTarget(delivery.endpointUrl);
  const address = target.addresses[0]?.address;
  if (!address) throw new Error('Webhook endpoint has no public address');
  const body = JSON.stringify(delivery.payload);
  if (Buffer.byteLength(body) > 1024 * 1024) throw new Error('Webhook payload exceeds 1 MB');
  const timestamp = Math.floor(Date.now() / 1000).toString();
  const signature = webhookSignature(delivery.signingSecret, timestamp, body);

  return new Promise((resolve, reject) => {
    const req = httpsRequest({
      protocol: 'https:',
      hostname: address,
      port: 443,
      servername: target.url.hostname,
      method: 'POST',
      path: `${target.url.pathname}${target.url.search}`,
      headers: {
        host: target.url.host,
        'content-type': 'application/json',
        'content-length': Buffer.byteLength(body),
        'user-agent': 'Portier369-Webhooks/1.0',
        'portier-event': delivery.eventType,
        'portier-delivery-id': delivery.deliveryId,
        'portier-signature': `t=${timestamp},v1=${signature}`,
      },
      rejectUnauthorized: true,
      timeout: 10_000,
    }, (response) => {
      const chunks: Buffer[] = [];
      let size = 0;
      response.on('data', (chunk: Buffer) => {
        size += chunk.length;
        if (size <= 4096) chunks.push(chunk);
      });
      response.on('end', () => {
        const status = response.statusCode ?? 0;
        const responseBody = Buffer.concat(chunks).toString('utf8');
        if (status < 200 || status >= 300) reject(Object.assign(new Error(`Endpoint returned HTTP ${status}`), { status, responseBody }));
        else resolve({ status, body: responseBody });
      });
    });
    req.on('timeout', () => req.destroy(new Error('Webhook request timed out')));
    req.on('error', reject);
    req.end(body);
  });
}
