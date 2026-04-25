import type { UtilityProvider, ProviderListResponse, ProviderResponse, ProviderAnalyticsResponse } from '../types/provider';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

export class ProviderService {
  /**
   * Get all active utility providers
   */
  static async getActiveProviders(): Promise<UtilityProvider[]> {
    try {
      const response = await fetch(`${API_BASE_URL}/api/providers`);
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const result: ProviderListResponse = await response.json();
      
      if (!result.success) {
        throw new Error(result.error || 'Failed to fetch providers');
      }
      
      return result.data;
    } catch (error) {
      console.error('Failed to get active providers:', error);
      throw error;
    }
  }

  /**
   * Get a specific provider by ID
   */
  static async getProviderById(providerId: string): Promise<UtilityProvider> {
    try {
      const response = await fetch(`${API_BASE_URL}/api/providers/${providerId}`);
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const result: ProviderResponse = await response.json();
      
      if (!result.success) {
        throw new Error(result.error || 'Failed to fetch provider');
      }
      
      return result.data;
    } catch (error) {
      console.error(`Failed to get provider ${providerId}:`, error);
      throw error;
    }
  }

  /**
   * Get providers that support a specific meter type
   */
  static async getProvidersByMeterType(meterType: 'electricity' | 'water' | 'gas'): Promise<UtilityProvider[]> {
    try {
      const response = await fetch(`${API_BASE_URL}/api/providers/by-meter-type/${meterType}`);
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const result: ProviderListResponse = await response.json();
      
      if (!result.success) {
        throw new Error(result.error || 'Failed to fetch providers by meter type');
      }
      
      return result.data;
    } catch (error) {
      console.error(`Failed to get providers for meter type ${meterType}:`, error);
      throw error;
    }
  }

  /**
   * Get the default provider
   */
  static async getDefaultProvider(): Promise<UtilityProvider> {
    try {
      const response = await fetch(`${API_BASE_URL}/api/providers/default`);
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const result: ProviderResponse = await response.json();
      
      if (!result.success) {
        throw new Error(result.error || 'Failed to fetch default provider');
      }
      
      return result.data;
    } catch (error) {
      console.error('Failed to get default provider:', error);
      throw error;
    }
  }

  /**
   * Get provider analytics (admin only)
   */
  static async getProviderAnalytics(): Promise<ProviderAnalyticsResponse['data']> {
    try {
      const response = await fetch(`${API_BASE_URL}/api/providers/analytics`);
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const result: ProviderAnalyticsResponse = await response.json();
      
      if (!result.success) {
        throw new Error(result.error || 'Failed to fetch provider analytics');
      }
      
      return result.data;
    } catch (error) {
      console.error('Failed to get provider analytics:', error);
      throw error;
    }
  }

  /**
   * Add a new provider (admin only)
   */
  static async addProvider(providerData: Omit<UtilityProvider, 'id'>): Promise<UtilityProvider> {
    try {
      const response = await fetch(`${API_BASE_URL}/api/providers`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(providerData),
      });
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const result: ProviderResponse = await response.json();
      
      if (!result.success) {
        throw new Error(result.error || 'Failed to add provider');
      }
      
      return result.data;
    } catch (error) {
      console.error('Failed to add provider:', error);
      throw error;
    }
  }

  /**
   * Update an existing provider (admin only)
   */
  static async updateProvider(providerId: string, updates: Partial<UtilityProvider>): Promise<UtilityProvider> {
    try {
      const response = await fetch(`${API_BASE_URL}/api/providers/${providerId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(updates),
      });
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const result: ProviderResponse = await response.json();
      
      if (!result.success) {
        throw new Error(result.error || 'Failed to update provider');
      }
      
      return result.data;
    } catch (error) {
      console.error(`Failed to update provider ${providerId}:`, error);
      throw error;
    }
  }

  /**
   * Deactivate a provider (admin only)
   */
  static async deactivateProvider(providerId: string): Promise<void> {
    try {
      const response = await fetch(`${API_BASE_URL}/api/providers/${providerId}`, {
        method: 'DELETE',
      });
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const result = await response.json();
      
      if (!result.success) {
        throw new Error(result.error || 'Failed to deactivate provider');
      }
    } catch (error) {
      console.error(`Failed to deactivate provider ${providerId}:`, error);
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
        throw new Error(result.error || 'Failed to fetch rate limit status');
      }
      
      return result.data;
    } catch (error) {
      console.error(`Failed to get rate limit status for provider ${providerId}:`, error);
      throw error;
    }
  }
}
