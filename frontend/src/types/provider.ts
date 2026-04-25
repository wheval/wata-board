/**
 * Utility Provider Types
 */

export interface UtilityProvider {
  id: string;
  name: string;
  logo?: string;
  contractId: string;
  network: 'testnet' | 'mainnet';
  rpcUrl: string;
  isActive: boolean;
  supportedMeterTypes: ('electricity' | 'water' | 'gas')[];
  metadata?: Record<string, any>;
}

export interface ProviderPaymentRequest {
  meter_id: string;
  amount: number;
  userId: string;
  providerId: string;
}

export interface ProviderPaymentResult {
  success: boolean;
  transactionId?: string;
  providerId: string;
  error?: string;
  rateLimitInfo?: {
    remainingRequests?: number;
    resetTime?: Date;
  };
}

export interface ProviderListResponse {
  success: boolean;
  data: UtilityProvider[];
  count: number;
  error?: string;
}

export interface ProviderResponse {
  success: boolean;
  data: UtilityProvider;
  error?: string;
}

export interface ProviderAnalyticsResponse {
  success: boolean;
  data: {
    providerId: string;
    name: string;
    network: string;
    isActive: boolean;
    totalMeters: number;
    totalPayments: number;
    totalAmount: number;
    averageAmount: number;
    confirmedPayments: number;
    failedPayments: number;
    lastPaymentDate?: string;
  }[];
  error?: string;
}
