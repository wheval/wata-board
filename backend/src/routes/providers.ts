import express from 'express';
import { ProviderService } from '../services/providerService';
import { MultiProviderPaymentService } from '../services/multiProviderPaymentService';
import { RateLimiter, RateLimitConfig } from '../rate-limiter';
import logger from '../utils/logger';

const router = express.Router();

// Initialize services
const rateLimitConfig: RateLimitConfig = {
  windowMs: 60 * 1000,  // 1 minute
  maxRequests: 10,       // 10 requests per minute for provider endpoints
  queueSize: 5
};

const providerService = new ProviderService();
const multiProviderPaymentService = new MultiProviderPaymentService(rateLimitConfig, providerService);

// Load providers from environment variables
providerService.loadProvidersFromEnvironment();

/**
 * GET /api/providers
 * Get all active utility providers
 */
router.get('/', (req, res) => {
  try {
    const providers = providerService.getActiveProviders();
    return res.status(200).json({
      success: true,
      data: providers,
      count: providers.length
    });
  } catch (error) {
    logger.error('Failed to get providers', { error });
    return res.status(500).json({
      success: false,
      error: 'Failed to retrieve providers'
    });
  }
});

/**
 * GET /api/providers/:providerId
 * Get a specific provider by ID
 */
router.get('/:providerId', (req, res) => {
  try {
    const { providerId } = req.params;
    
    if (!providerId) {
      return res.status(400).json({
        success: false,
        error: 'Provider ID is required'
      });
    }

    const provider = providerService.getProviderById(providerId);
    if (!provider) {
      return res.status(404).json({
        success: false,
        error: 'Provider not found'
      });
    }

    return res.status(200).json({
      success: true,
      data: provider
    });
  } catch (error) {
    logger.error('Failed to get provider', { error, providerId: req.params.providerId });
    return res.status(500).json({
      success: false,
      error: 'Failed to retrieve provider'
    });
  }
});

/**
 * GET /api/providers/by-meter-type/:meterType
 * Get providers that support a specific meter type
 */
router.get('/by-meter-type/:meterType', (req, res) => {
  try {
    const { meterType } = req.params;
    
    if (!meterType) {
      return res.status(400).json({
        success: false,
        error: 'Meter type is required'
      });
    }

    const validMeterTypes = ['electricity', 'water', 'gas'];
    if (!validMeterTypes.includes(meterType)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid meter type. Must be one of: electricity, water, gas'
      });
    }

    const providers = providerService.getProvidersByMeterType(meterType as 'electricity' | 'water' | 'gas');
    
    return res.status(200).json({
      success: true,
      data: providers,
      meterType,
      count: providers.length
    });
  } catch (error) {
    logger.error('Failed to get providers by meter type', { error, meterType: req.params.meterType });
    return res.status(500).json({
      success: false,
      error: 'Failed to retrieve providers by meter type'
    });
  }
});

/**
 * POST /api/providers
 * Add a new provider (admin only)
 */
router.post('/', (req, res) => {
  try {
    const providerData = req.body;
    
    // Validate required fields
    const requiredFields = ['id', 'name', 'contractId', 'network', 'rpcUrl'];
    const missingFields = requiredFields.filter(field => !providerData[field]);
    
    if (missingFields.length > 0) {
      return res.status(400).json({
        success: false,
        error: `Missing required fields: ${missingFields.join(', ')}`
      });
    }

    // Validate network
    if (!['testnet', 'mainnet'].includes(providerData.network)) {
      return res.status(400).json({
        success: false,
        error: 'Network must be either testnet or mainnet'
      });
    }

    // Validate meter types
    if (!Array.isArray(providerData.supportedMeterTypes) || providerData.supportedMeterTypes.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Provider must support at least one meter type'
      });
    }

    const validMeterTypes = ['electricity', 'water', 'gas'];
    const invalidMeterTypes = providerData.supportedMeterTypes.filter(
      (type: string) => !validMeterTypes.includes(type)
    );

    if (invalidMeterTypes.length > 0) {
      return res.status(400).json({
        success: false,
        error: `Invalid meter types: ${invalidMeterTypes.join(', ')}`
      });
    }

    providerService.addProvider({
      id: providerData.id,
      name: providerData.name,
      contractId: providerData.contractId,
      network: providerData.network,
      rpcUrl: providerData.rpcUrl,
      isActive: providerData.isActive !== false,
      supportedMeterTypes: providerData.supportedMeterTypes,
      logo: providerData.logo,
      metadata: providerData.metadata || {}
    });

    logger.info('New provider added via API', { 
      providerId: providerData.id, 
      name: providerData.name,
      ip: req.ip 
    });

    return res.status(201).json({
      success: true,
      message: 'Provider added successfully',
      data: providerService.getProviderById(providerData.id)
    });
  } catch (error) {
    logger.error('Failed to add provider', { error, body: req.body });
    return res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to add provider'
    });
  }
});

/**
 * PUT /api/providers/:providerId
 * Update an existing provider (admin only)
 */
router.put('/:providerId', (req, res) => {
  try {
    const { providerId } = req.params;
    const updates = req.body;
    
    if (!providerId) {
      return res.status(400).json({
        success: false,
        error: 'Provider ID is required'
      });
    }

    // Validate network if provided
    if (updates.network && !['testnet', 'mainnet'].includes(updates.network)) {
      return res.status(400).json({
        success: false,
        error: 'Network must be either testnet or mainnet'
      });
    }

    // Validate meter types if provided
    if (updates.supportedMeterTypes) {
      if (!Array.isArray(updates.supportedMeterTypes) || updates.supportedMeterTypes.length === 0) {
        return res.status(400).json({
          success: false,
          error: 'Provider must support at least one meter type'
        });
      }

      const validMeterTypes = ['electricity', 'water', 'gas'];
      const invalidMeterTypes = updates.supportedMeterTypes.filter(
        (type: string) => !validMeterTypes.includes(type)
      );

      if (invalidMeterTypes.length > 0) {
        return res.status(400).json({
          success: false,
          error: `Invalid meter types: ${invalidMeterTypes.join(', ')}`
        });
      }
    }

    providerService.updateProvider(providerId, updates);

    logger.info('Provider updated via API', { 
      providerId, 
      updates: Object.keys(updates),
      ip: req.ip 
    });

    return res.status(200).json({
      success: true,
      message: 'Provider updated successfully',
      data: providerService.getProviderById(providerId)
    });
  } catch (error) {
    logger.error('Failed to update provider', { error, providerId: req.params.providerId, body: req.body });
    return res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to update provider'
    });
  }
});

/**
 * DELETE /api/providers/:providerId
 * Deactivate a provider (admin only)
 */
router.delete('/:providerId', (req, res) => {
  try {
    const { providerId } = req.params;
    
    if (!providerId) {
      return res.status(400).json({
        success: false,
        error: 'Provider ID is required'
      });
    }

    providerService.deactivateProvider(providerId);

    logger.info('Provider deactivated via API', { providerId, ip: req.ip });

    return res.status(200).json({
      success: true,
      message: 'Provider deactivated successfully'
    });
  } catch (error) {
    logger.error('Failed to deactivate provider', { error, providerId: req.params.providerId });
    return res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to deactivate provider'
    });
  }
});

/**
 * GET /api/providers/:providerId/rate-limit/:userId
 * Get rate limit status for a specific provider and user
 */
router.get('/:providerId/rate-limit/:userId', (req, res) => {
  try {
    const { providerId, userId } = req.params;
    
    if (!providerId || !userId) {
      return res.status(400).json({
        success: false,
        error: 'Provider ID and User ID are required'
      });
    }

    const status = multiProviderPaymentService.getProviderRateLimitStatus(userId, providerId);

    return res.status(200).json({
      success: true,
      data: {
        providerId,
        userId,
        ...status
      }
    });
  } catch (error) {
    logger.error('Failed to get provider rate limit status', { 
      error, 
      providerId: req.params.providerId, 
      userId: req.params.userId 
    });
    return res.status(500).json({
      success: false,
      error: 'Failed to retrieve rate limit status'
    });
  }
});

/**
 * GET /api/providers/default
 * Get the default provider
 */
router.get('/default', (req, res) => {
  try {
    const defaultProvider = providerService.getDefaultProvider();
    
    return res.status(200).json({
      success: true,
      data: defaultProvider
    });
  } catch (error) {
    logger.error('Failed to get default provider', { error });
    return res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to retrieve default provider'
    });
  }
});

export default router;
