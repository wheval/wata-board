import type { ProviderPaymentRequest, ProviderPaymentResult } from '../types/provider';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

export class MultiProviderPaymentService {
  /**
   * Process a payment with a specific provider
   */
  static async processPayment(request: ProviderPaymentRequest): Promise<ProviderPaymentResult> {
    try {
      const response = await fetch(`${API_BASE_URL}/api/payment/multi-provider`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(request),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result: ProviderPaymentResult = await response.json();
      
      if (!result.success) {
        throw new Error(result.error || 'Payment processing failed');
      }

      return result;
    } catch (error) {
      console.error('Multi-provider payment failed:', error);
      throw error;
    }
  }

  /**
   * Get total paid amount for a meter using a specific provider
   */
  static async getTotalPaid(meterId: string, providerId: string): Promise<{ total: number; provider: any }> {
    try {
      const response = await fetch(`${API_BASE_URL}/api/payment/${meterId}?providerId=${providerId}`);
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const result = await response.json();
      
      if (!result.success) {
        throw new Error(result.error || 'Failed to get total paid amount');
      }
      
      return result.data;
    } catch (error) {
      console.error(`Failed to get total paid for meter ${meterId}:`, error);
      throw error;
    }
  }

  /**
   * Get rate limit status for a user across all providers
   */
  static async getRateLimitStatus(userId: string): Promise<Record<string, any>> {
    try {
      const response = await fetch(`${API_BASE_URL}/api/rate-limit/${userId}`);
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const result = await response.json();
      
      if (!result.success) {
        throw new Error(result.error || 'Failed to get rate limit status');
      }
      
      return result.data;
    } catch (error) {
      console.error('Failed to get rate limit status:', error);
      throw error;
    }
  }

  /**
   * Get rate limit status for a specific provider and user
   */
  static async getProviderRateLimitStatus(providerId: string, userId: string): Promise<any> {
    try {
      const response = await fetch(`${API_BASE_URL}/api/providers/${providerId}/rate-limit/${userId}`);
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const result = await response.json();
      
      if (!result.success) {
        throw new Error(result.error || 'Failed to get provider rate limit status');
      }
      
      return result.data;
    } catch (error) {
      console.error(`Failed to get rate limit status for provider ${providerId}:`, error);
      throw error;
    }
  }
}
