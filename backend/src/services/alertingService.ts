import https from 'https';
import { URL } from 'url';
import { envConfig } from '../utils/env';
import logger from '../utils/logger';

export interface AlertNotification {
  id: string;
  level: 'info' | 'warning' | 'critical';
  message: string;
  timestamp: number;
}

function sendJsonWebhook<T>(url: string, payload: T, apiKey?: string): Promise<void> {
  return new Promise((resolve, reject) => {
    try {
      const parsedUrl = new URL(url);
      const body = JSON.stringify(payload);
      const request = https.request(
        {
          method: 'POST',
          hostname: parsedUrl.hostname,
          path: `${parsedUrl.pathname}${parsedUrl.search}`,
          port: parsedUrl.port ? Number(parsedUrl.port) : parsedUrl.protocol === 'https:' ? 443 : 80,
          headers: {
            'Content-Type': 'application/json',
            'Content-Length': Buffer.byteLength(body),
            ...(apiKey ? { 'X-API-Key': apiKey } : {}),
          },
        },
        (response) => {
          const status = response.statusCode || 0;
          if (status >= 200 && status < 300) {
            resolve();
          } else {
            reject(new Error(`Alert delivery failed with status ${status}`));
          }
        },
      );

      request.on('error', reject);
      request.write(body);
      request.end();
    } catch (err) {
      reject(err);
    }
  });
}

export async function notifyAlert(alert: AlertNotification): Promise<void> {
  if (!envConfig.ALERT_WEBHOOK_URL) {
    logger.debug('Alert webhook disabled, skipping alert delivery', {
      alertId: alert.id,
      level: alert.level,
    });
    return;
  }

  try {
    await sendJsonWebhook(envConfig.ALERT_WEBHOOK_URL, {
      id: alert.id,
      level: alert.level,
      message: alert.message,
      timestamp: new Date(alert.timestamp).toISOString(),
      source: 'monitoring-service',
    }, envConfig.ERROR_TRACKING_API_KEY);

    logger.info('Alert webhook delivered', {
      alertId: alert.id,
      webhook: envConfig.ALERT_WEBHOOK_URL,
    });
  } catch (error) {
    logger.warn('Failed to deliver alert webhook', {
      alertId: alert.id,
      error,
      webhook: envConfig.ALERT_WEBHOOK_URL,
    });
  }
}
