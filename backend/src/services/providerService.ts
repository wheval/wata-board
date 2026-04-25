import { UtilityProvider, ProviderConfig } from '../types/provider';
import logger from '../utils/logger';

export class ProviderService {
  private providers: Map<string, UtilityProvider> = new Map();
  private defaultProviderId: string = 'wata-board';

  constructor() {
    this.initializeDefaultProviders();
  }

  /**
   * Initialize default providers
   */
  private initializeDefaultProviders(): void {
    const defaultProvider: UtilityProvider = {
      id: 'wata-board',
      name: 'Wata-Board',
      contractId: process.env.CONTRACT_ID_TESTNET || 'CDRRJ7IPYDL36YSK5ZQLBG3LICULETIBXX327AGJQNTWXNKY2UMDO4DA',
      network: 'testnet',
      rpcUrl: process.env.RPC_URL_TESTNET || 'https://soroban-testnet.stellar.org',
      isActive: true,
      supportedMeterTypes: ['electricity', 'water', 'gas'],
      metadata: {
        description: 'Default utility payment provider',
        region: 'Global'
      }
    };

    this.providers.set(defaultProvider.id, defaultProvider);
    logger.info('Default provider initialized', { providerId: defaultProvider.id });
  }

  /**
   * Get all active providers
   */
  getActiveProviders(): UtilityProvider[] {
    return Array.from(this.providers.values()).filter(provider => provider.isActive);
  }

  /**
   * Get provider by ID
   */
  getProviderById(providerId: string): UtilityProvider | undefined {
    return this.providers.get(providerId);
  }

  /**
   * Add a new provider
   */
  addProvider(provider: UtilityProvider): void {
    if (this.providers.has(provider.id)) {
      throw new Error(`Provider with ID ${provider.id} already exists`);
    }

    this.validateProvider(provider);
    this.providers.set(provider.id, provider);
    logger.info('New provider added', { providerId: provider.id, name: provider.name });
  }

  /**
   * Update an existing provider
   */
  updateProvider(providerId: string, updates: Partial<UtilityProvider>): void {
    const existingProvider = this.providers.get(providerId);
    if (!existingProvider) {
      throw new Error(`Provider with ID ${providerId} not found`);
    }

    const updatedProvider = { ...existingProvider, ...updates };
    this.validateProvider(updatedProvider);
    this.providers.set(providerId, updatedProvider);
    logger.info('Provider updated', { providerId, updates: Object.keys(updates) });
  }

  /**
   * Deactivate a provider
   */
  deactivateProvider(providerId: string): void {
    const provider = this.providers.get(providerId);
    if (!provider) {
      throw new Error(`Provider with ID ${providerId} not found`);
    }

    if (providerId === this.defaultProviderId) {
      throw new Error('Cannot deactivate the default provider');
    }

    provider.isActive = false;
    logger.info('Provider deactivated', { providerId });
  }

  /**
   * Get default provider
   */
  getDefaultProvider(): UtilityProvider {
    const provider = this.providers.get(this.defaultProviderId);
    if (!provider || !provider.isActive) {
      throw new Error('Default provider is not available');
    }
    return provider;
  }

  /**
   * Set default provider
   */
  setDefaultProvider(providerId: string): void {
    const provider = this.providers.get(providerId);
    if (!provider || !provider.isActive) {
      throw new Error(`Provider with ID ${providerId} is not active`);
    }

    this.defaultProviderId = providerId;
    logger.info('Default provider changed', { newDefaultProviderId: providerId });
  }

  /**
   * Get providers that support a specific meter type
   */
  getProvidersByMeterType(meterType: 'electricity' | 'water' | 'gas'): UtilityProvider[] {
    return this.getActiveProviders().filter(provider =>
      provider.supportedMeterTypes.includes(meterType)
    );
  }

  /**
   * Validate provider configuration
   */
  private validateProvider(provider: UtilityProvider): void {
    if (!provider.id || !provider.name || !provider.contractId) {
      throw new Error('Provider must have id, name, and contractId');
    }

    if (!['testnet', 'mainnet'].includes(provider.network)) {
      throw new Error('Provider network must be either testnet or mainnet');
    }

    if (!provider.rpcUrl) {
      throw new Error('Provider must have an RPC URL');
    }

    if (!Array.isArray(provider.supportedMeterTypes) || provider.supportedMeterTypes.length === 0) {
      throw new Error('Provider must support at least one meter type');
    }

    const validMeterTypes = ['electricity', 'water', 'gas'];
    const invalidMeterTypes = provider.supportedMeterTypes.filter(
      type => !validMeterTypes.includes(type)
    );

    if (invalidMeterTypes.length > 0) {
      throw new Error(`Invalid meter types: ${invalidMeterTypes.join(', ')}`);
    }
  }

  /**
   * Load providers from environment variables
   */
  loadProvidersFromEnvironment(): void {
    // Example: PROVIDER_1_ID=nepa,PROVIDER_1_NAME=NEPA,PROVIDER_1_CONTRACT_ID=...
    const providerCount = parseInt(process.env.PROVIDER_COUNT || '1', 10);

    for (let i = 1; i <= providerCount; i++) {
      const prefix = `PROVIDER_${i}_`;
      const providerId = process.env[`${prefix}ID`];
      const name = process.env[`${prefix}NAME`];
      const contractId = process.env[`${prefix}CONTRACT_ID`];
      const network = process.env[`${prefix}NETWORK`] as 'testnet' | 'mainnet';
      const rpcUrl = process.env[`${prefix}RPC_URL`];

      if (providerId && name && contractId && network && rpcUrl) {
        try {
          const provider: UtilityProvider = {
            id: providerId,
            name,
            contractId,
            network,
            rpcUrl,
            isActive: process.env[`${prefix}ACTIVE`] !== 'false',
            supportedMeterTypes: (process.env[`${prefix}METER_TYPES`] || 'electricity,water,gas').split(',') as ('electricity' | 'water' | 'gas')[],
            metadata: {
              description: process.env[`${prefix}DESCRIPTION`],
              region: process.env[`${prefix}REGION`]
            }
          };

          this.addProvider(provider);
        } catch (error) {
          logger.error('Failed to load provider from environment', { providerId, error });
        }
      }
    }
  }
}
