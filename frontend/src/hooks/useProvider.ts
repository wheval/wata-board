import { useState, useEffect, useCallback } from 'react';
import type { UtilityProvider } from '../types/provider';
import { ProviderService } from '../services/providerService';

interface UseProviderOptions {
  meterType?: 'electricity' | 'water' | 'gas';
  autoSelect?: boolean;
}

interface UseProviderReturn {
  providers: UtilityProvider[];
  selectedProvider: UtilityProvider | null;
  loading: boolean;
  error: string | null;
  selectProvider: (provider: UtilityProvider) => void;
  refreshProviders: () => Promise<void>;
}

export const useProvider = (
  initialProviderId?: string,
  options: UseProviderOptions = {}
): UseProviderReturn => {
  const { meterType, autoSelect = true } = options;
  
  const [providers, setProviders] = useState<UtilityProvider[]>([]);
  const [selectedProvider, setSelectedProvider] = useState<UtilityProvider | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadProviders = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      
      let providerList: UtilityProvider[];
      
      if (meterType) {
        providerList = await ProviderService.getProvidersByMeterType(meterType);
      } else {
        providerList = await ProviderService.getActiveProviders();
      }
      
      setProviders(providerList);
      
      // Auto-select provider if requested
      if (autoSelect && !selectedProvider && providerList.length > 0) {
        const providerToSelect = initialProviderId
          ? providerList.find(p => p.id === initialProviderId) || providerList[0]
          : providerList[0];
        
        setSelectedProvider(providerToSelect);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load providers');
    } finally {
      setLoading(false);
    }
  }, [meterType, autoSelect, initialProviderId, selectedProvider]);

  useEffect(() => {
    loadProviders();
  }, [loadProviders]);

  const selectProvider = useCallback((provider: UtilityProvider) => {
    setSelectedProvider(provider);
  }, []);

  const refreshProviders = useCallback(async () => {
    await loadProviders();
  }, [loadProviders]);

  return {
    providers,
    selectedProvider,
    loading,
    error,
    selectProvider,
    refreshProviders,
  };
};
