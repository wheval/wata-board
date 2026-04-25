/**
 * Environment-Specific Configuration Loader (#200)
 *
 * Loads configuration based on NODE_ENV:
 * - development: config.dev.ts
 * - production: config.prod.ts
 * - test: config.test.ts
 * - default: config.default.ts
 */

import { config as dotenvConfig } from 'dotenv';
import path from 'path';

// Load environment variables first
dotenvConfig();

export interface AppConfig {
  server: {
    port: number;
    nodeEnv: string;
    httpsEnabled: boolean;
    sslKeyPath?: string;
    sslCertPath?: string;
    sslCaPath?: string;
  };
  cors: {
    allowedOrigins: string[];
    frontendUrl: string;
  };
  network: {
    type: 'testnet' | 'mainnet';
    contractId: string;
    rpcUrl: string;
    networkPassphrase: string;
  };
  security: {
    keyMasterPassword?: string;
    adminSecretKey?: string;
  };
  rateLimits: {
    tierLimits: Record<string, { windowMs: number; maxRequests: number; queueSize: number }>;
  };
  monitoring: {
    enabled: boolean;
    metricsRetentionMs: number;
    alertThresholds: {
      errorRate: number;
      requestsPerMinute: number;
      responseTimeMs: number;
    };
  };
}

// Default configuration
const defaultConfig: AppConfig = {
  server: {
    port: parseInt(process.env.PORT || '3001'),
    nodeEnv: process.env.NODE_ENV || 'development',
    httpsEnabled: process.env.HTTPS_ENABLED === 'true',
    sslKeyPath: process.env.SSL_KEY_PATH,
    sslCertPath: process.env.SSL_CERT_PATH,
    sslCaPath: process.env.SSL_CA_PATH,
  },
  cors: {
    allowedOrigins: (process.env.ALLOWED_ORIGINS || 'http://localhost:3000,http://localhost:5173').split(','),
    frontendUrl: process.env.FRONTEND_URL || 'http://localhost:5173',
  },
  network: {
    type: (process.env.NETWORK as 'testnet' | 'mainnet') || 'testnet',
    contractId: process.env.CONTRACT_ID_TESTNET || 'CDRRJ7IPYDL36YSK5ZQLBG3LICULETIBXX327AGJQNTWXNKY2UMDO4DA',
    rpcUrl: process.env.RPC_URL_TESTNET || 'https://soroban-testnet.stellar.org',
    networkPassphrase: process.env.NETWORK_PASSPHRASE_TESTNET || 'Test SDF Network ; September 2015',
  },
  security: {
    keyMasterPassword: process.env.KEY_MASTER_PASSWORD,
    adminSecretKey: process.env.ADMIN_SECRET_KEY,
  },
  rateLimits: {
    tierLimits: {
      anonymous: { windowMs: 60000, maxRequests: 5, queueSize: 5 },
      verified: { windowMs: 60000, maxRequests: 15, queueSize: 10 },
      premium: { windowMs: 60000, maxRequests: 50, queueSize: 25 },
      admin: { windowMs: 60000, maxRequests: 200, queueSize: 50 },
    },
  },
  monitoring: {
    enabled: true,
    metricsRetentionMs: 10 * 60 * 1000, // 10 minutes
    alertThresholds: {
      errorRate: 0.1,
      requestsPerMinute: 500,
      responseTimeMs: 5000,
    },
  },
};

// Environment-specific overrides
const envConfigs: Record<string, Partial<AppConfig>> = {
  development: {
    server: {
      ...defaultConfig.server,
      port: 3001,
      httpsEnabled: false,
    },
    cors: {
      allowedOrigins: ['http://localhost:3000', 'http://localhost:5173'],
      frontendUrl: 'http://localhost:5173',
    },
    network: {
      type: 'testnet',
      contractId: process.env.CONTRACT_ID_TESTNET || 'CDRRJ7IPYDL36YSK5ZQLBG3LICULETIBXX327AGJQNTWXNKY2UMDO4DA',
      rpcUrl: process.env.RPC_URL_TESTNET || 'https://soroban-testnet.stellar.org',
      networkPassphrase: 'Test SDF Network ; September 2015',
    },
    monitoring: {
      enabled: true,
      metricsRetentionMs: 5 * 60 * 1000, // 5 minutes for dev
      alertThresholds: {
        errorRate: 0.05,
        requestsPerMinute: 100,
        responseTimeMs: 2000,
      },
    },
  },
  production: {
    server: {
      ...defaultConfig.server,
      port: parseInt(process.env.PORT || '3001'),
      httpsEnabled: true,
      sslKeyPath: process.env.SSL_KEY_PATH || '/etc/letsencrypt/live/yourdomain.com/privkey.pem',
      sslCertPath: process.env.SSL_CERT_PATH || '/etc/letsencrypt/live/yourdomain.com/fullchain.pem',
      sslCaPath: process.env.SSL_CA_PATH || '/etc/letsencrypt/live/yourdomain.com/chain.pem',
    },
    cors: {
      allowedOrigins: (process.env.ALLOWED_ORIGINS || '').split(',').filter(Boolean),
      frontendUrl: process.env.FRONTEND_URL || '',
    },
    network: {
      type: (process.env.NETWORK as 'testnet' | 'mainnet') || 'mainnet',
      contractId: process.env.CONTRACT_ID_MAINNET || 'MAINNET_CONTRACT_ID_HERE',
      rpcUrl: process.env.RPC_URL_MAINNET || 'https://soroban.stellar.org',
      networkPassphrase: 'Public Global Stellar Network ; September 2015',
    },
    monitoring: {
      enabled: true,
      metricsRetentionMs: 60 * 60 * 1000, // 1 hour for prod
      alertThresholds: {
        errorRate: 0.05,
        requestsPerMinute: 1000,
        responseTimeMs: 3000,
      },
    },
  },
  test: {
    server: {
      ...defaultConfig.server,
      port: 3002,
      httpsEnabled: false,
    },
    cors: {
      allowedOrigins: ['http://localhost:3001'],
      frontendUrl: 'http://localhost:3001',
    },
    network: {
      type: 'testnet',
      contractId: 'TEST_CONTRACT_ID',
      rpcUrl: 'https://soroban-testnet.stellar.org',
      networkPassphrase: 'Test SDF Network ; September 2015',
    },
    monitoring: {
      enabled: false,
      metricsRetentionMs: 1 * 60 * 1000, // 1 minute for tests
      alertThresholds: {
        errorRate: 0.5,
        requestsPerMinute: 10,
        responseTimeMs: 10000,
      },
    },
  },
};

/**
 * Load configuration based on NODE_ENV
 */
export function loadConfig(): AppConfig {
  const env = process.env.NODE_ENV || 'development';
  const envConfig = envConfigs[env] || {};

  // Deep merge default config with environment-specific config
  return deepMerge(defaultConfig, envConfig);
}

/**
 * Deep merge two configuration objects
 */
function deepMerge<T extends Record<string, any>>(target: T, source: Partial<T>): T {
  const result = { ...target };

  for (const key in source) {
    if (source.hasOwnProperty(key)) {
      const sourceValue = source[key];
      const targetValue = result[key];

      if (isObject(sourceValue) && isObject(targetValue)) {
        result[key] = deepMerge(targetValue, sourceValue);
      } else if (sourceValue !== undefined) {
        result[key] = sourceValue;
      }
    }
  }

  return result;
}

function isObject(value: any): value is Record<string, any> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

// Export the loaded configuration
export const config = loadConfig();