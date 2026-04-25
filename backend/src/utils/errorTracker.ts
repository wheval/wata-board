import https from 'https';
import { URL } from 'url';
import { envConfig } from './env';
import logger from './logger';

interface ErrorPayload {
  message: string;
  stack?: string;
  context?: Record<string, unknown>;
  timestamp: string;
}

function sendJsonWebhook(url: string, payload: ErrorPayload, apiKey?: string): Promise<void> {
  return new Promise((resolve, reject) => {
    try {
      const parsedUrl = new URL(url);
      const body = JSON.stringify(payload);
      const options: https.RequestOptions = {
        method: 'POST',
        hostname: parsedUrl.hostname,
        path: `${parsedUrl.pathname}${parsedUrl.search}`,
        port: parsedUrl.port ? Number(parsedUrl.port) : parsedUrl.protocol === 'https:' ? 443 : 80,
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(body),
          ...(apiKey ? { 'X-API-Key': apiKey } : {}),
        },
      };

      const request = https.request(options, (response) => {
        const status = response.statusCode || 0;
        if (status >= 200 && status < 300) {
          resolve();
        } else {
          reject(new Error(`Error tracking request failed with status ${status}`));
        }
      });

      request.on('error', reject);
      request.write(body);
      request.end();
    } catch (err) {
      reject(err);
    }
  });
}

export async function captureException(
  error: unknown,
  context: Record<string, unknown> = {},
): Promise<void> {
  const payload: ErrorPayload = {
    message: error instanceof Error ? error.message : String(error),
    stack: error instanceof Error ? error.stack : undefined,
    context,
    timestamp: new Date().toISOString(),
  };

  logger.error('CaptureException invoked', { ...payload, source: 'error-tracker' });

  if (!envConfig.ERROR_TRACKING_ENDPOINT) {
    logger.info('Error tracking endpoint not configured, skipping remote delivery');
    return;
  }

  try {
    await sendJsonWebhook(
      envConfig.ERROR_TRACKING_ENDPOINT,
      payload,
      envConfig.ERROR_TRACKING_API_KEY,
    );
    logger.info('Error tracking event delivered', {
      endpoint: envConfig.ERROR_TRACKING_ENDPOINT,
    });
  } catch (sendError) {
    logger.warn('Failed to send error tracking event', {
      error: sendError,
      endpoint: envConfig.ERROR_TRACKING_ENDPOINT,
    });
  }
}
