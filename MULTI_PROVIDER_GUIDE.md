# Multi-Provider System Guide

## Overview

The Wata-Board platform now supports multiple utility providers, enabling business expansion and improved service offerings. This guide covers the architecture, configuration, and usage of the multi-provider system.

## Architecture

### Backend Components

1. **ProviderService** - Manages provider registration, validation, and configuration
2. **MultiProviderPaymentService** - Handles payments through specific providers with per-provider rate limiting
3. **Provider Routes** - REST API endpoints for provider management
4. **Database Schema** - Extended to support multiple providers

### Frontend Components

1. **ProviderSelector** - UI component for provider selection
2. **useProvider Hook** - React hook for provider state management
3. **ProviderService** - Frontend service for API communication

### Smart Contract

1. **MultiProviderContract** - Enhanced contract supporting multiple providers
2. **Provider Registration** - On-chain provider management
3. **Provider Statistics** - Per-provider payment tracking

## Configuration

### Backend Environment Variables

Create a `.env` file based on `.env.multi-provider.example`:

```bash
# Multi-Provider Setup
PROVIDER_COUNT=3

# Provider 1: Wata-Board (Default)
PROVIDER_1_ID=wata-board
PROVIDER_1_NAME=Wata-Board
PROVIDER_1_CONTRACT_ID=CDRRJ7IPYDL36YSK5ZQLBG3LICULETIBXX327AGJQNTWXNKY2UMDO4DA
PROVIDER_1_NETWORK=testnet
PROVIDER_1_RPC_URL=https://soroban-testnet.stellar.org
PROVIDER_1_ACTIVE=true
PROVIDER_1_METER_TYPES=electricity,water,gas
PROVIDER_1_DESCRIPTION=Default utility payment provider
PROVIDER_1_REGION=Global

# Provider 2: NEPA (Nigeria Electricity)
PROVIDER_2_ID=nepa
PROVIDER_2_NAME=National Electric Power Authority
PROVIDER_2_CONTRACT_ID=NEPA_CONTRACT_ID_HERE
PROVIDER_2_NETWORK=testnet
PROVIDER_2_RPC_URL=https://soroban-testnet.stellar.org
PROVIDER_2_ACTIVE=true
PROVIDER_2_METER_TYPES=electricity
PROVIDER_2_DESCRIPTION=Nigeria's national electricity provider
PROVIDER_2_REGION=Nigeria

# Provider 3: WaterBoard
PROVIDER_3_ID=waterboard
PROVIDER_3_NAME=National Water Board
PROVIDER_3_CONTRACT_ID=WATERBOARD_CONTRACT_ID_HERE
PROVIDER_3_NETWORK=testnet
PROVIDER_3_RPC_URL=https://soroban-testnet.stellar.org
PROVIDER_3_ACTIVE=true
PROVIDER_3_METER_TYPES=water
PROVIDER_3_DESCRIPTION=National water utility provider
PROVIDER_3_REGION=Global
```

### Frontend Environment Variables

```bash
# Multi-Provider Configuration
VITE_ENABLE_MULTI_PROVIDER=true
VITE_DEFAULT_PROVIDER_ID=wata-board
VITE_ENABLE_PROVIDER_SELECTION=true
```

## Database Migration

Run the multi-provider migration:

```bash
# Run the migration
psql -d wata_board -f database/migrations/003_multi_provider_support.sql
```

This migration:
- Creates `utility_providers` table
- Adds `provider_id` to existing tables
- Updates constraints and indexes
- Creates provider analytics views

## API Endpoints

### Provider Management

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/providers` | Get all active providers |
| GET | `/api/providers/:providerId` | Get specific provider |
| GET | `/api/providers/by-meter-type/:meterType` | Get providers by meter type |
| GET | `/api/providers/default` | Get default provider |
| POST | `/api/providers` | Add new provider (admin) |
| PUT | `/api/providers/:providerId` | Update provider (admin) |
| DELETE | `/api/providers/:providerId` | Deactivate provider (admin) |
| GET | `/api/providers/:providerId/rate-limit/:userId` | Get rate limit status |

### Payment Processing

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/payment` | Legacy payment (default provider) |
| POST | `/api/payment/multi-provider` | Multi-provider payment |

### Multi-Provider Payment Request

```json
{
  "meter_id": "METER001",
  "amount": 100,
  "userId": "USER123",
  "providerId": "nepa"
}
```

## Frontend Integration

### Using the ProviderSelector Component

```tsx
import { ProviderSelector } from './components/ProviderSelector';
import type { UtilityProvider } from './types/provider';

const PaymentForm = () => {
  const [selectedProvider, setSelectedProvider] = useState<UtilityProvider | null>(null);

  return (
    <div>
      <ProviderSelector
        meterType="electricity"
        selectedProviderId={selectedProvider?.id}
        onProviderSelect={setSelectedProvider}
        disabled={processing}
      />
      
      {selectedProvider && (
        <button onClick={() => processPayment(selectedProvider)}>
          Pay with {selectedProvider.name}
        </button>
      )}
    </div>
  );
};
```

### Using the useProvider Hook

```tsx
import { useProvider } from './hooks/useProvider';

const PaymentComponent = () => {
  const {
    providers,
    selectedProvider,
    loading,
    error,
    selectProvider,
    refreshProviders
  } = useProvider('wata-board', { meterType: 'electricity' });

  if (loading) return <div>Loading providers...</div>;
  if (error) return <div>Error: {error}</div>;

  return (
    <div>
      <h3>Selected: {selectedProvider?.name}</h3>
      <select onChange={(e) => {
        const provider = providers.find(p => p.id === e.target.value);
        if (provider) selectProvider(provider);
      }}>
        {providers.map(provider => (
          <option key={provider.id} value={provider.id}>
            {provider.name}
          </option>
        ))}
      </select>
    </div>
  );
};
```

## Provider Management

### Adding a New Provider

1. **Backend Registration**:
```bash
curl -X POST http://localhost:3001/api/providers \
  -H "Content-Type: application/json" \
  -d '{
    "id": "new-provider",
    "name": "New Utility Provider",
    "contractId": "NEW_CONTRACT_ID",
    "network": "testnet",
    "rpcUrl": "https://soroban-testnet.stellar.org",
    "supportedMeterTypes": ["electricity"],
    "metadata": {
      "region": "Region",
      "description": "Provider description"
    }
  }'
```

2. **Environment Configuration**:
Add provider configuration to `.env` file as shown in the configuration section.

3. **Smart Contract Deployment**:
Deploy the provider's smart contract and update the contract ID.

### Updating Provider Information

```bash
curl -X PUT http://localhost:3001/api/providers/provider-id \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Updated Provider Name",
    "isActive": true
  }'
```

### Deactivating a Provider

```bash
curl -X DELETE http://localhost:3001/api/providers/provider-id
```

## Rate Limiting

The multi-provider system implements per-provider rate limiting:

- **Default**: 5 requests per minute per provider
- **Queue Size**: 10 queued requests per provider
- **Per-Provider Tracking**: Separate rate limits for each provider

### Rate Limit Status

```bash
curl http://localhost:3001/api/providers/provider-id/rate-limit/user-id
```

## Analytics and Monitoring

### Provider Analytics

```bash
curl http://localhost:3001/api/providers/analytics
```

Returns:
- Total payments per provider
- Success/failure rates
- Revenue per provider
- Last payment timestamps

### Database Views

- `provider_analytics` - Provider performance metrics
- `payment_analytics` - Payment analytics with provider info
- `user_activity` - User activity with provider context

## Testing

### Backend Tests

```bash
cd backend
npm test -- multiProvider.test.ts
```

### Frontend Tests

```bash
cd frontend
npm test -- multiProvider.test.tsx
```

### Test Coverage

- Provider registration and validation
- Payment processing with multiple providers
- Rate limiting per provider
- Provider selection UI
- Error handling and edge cases

## Deployment

### Production Deployment

1. **Database Migration**:
```bash
psql -d wata_board_production -f database/migrations/003_multi_provider_support.sql
```

2. **Environment Configuration**:
Update production `.env` files with provider configurations.

3. **Smart Contract Deployment**:
Deploy multi-provider contracts to mainnet.

4. **Frontend Build**:
```bash
cd frontend
npm run build
```

5. **Backend Deployment**:
```bash
cd backend
npm run build
npm start
```

### Monitoring

Monitor the following metrics:
- Provider availability
- Per-provider transaction volumes
- Rate limiting effectiveness
- Error rates per provider

## Security Considerations

1. **Provider Validation**: All provider configurations are validated before registration
2. **Access Control**: Admin-only endpoints for provider management
3. **Rate Limiting**: Per-provider rate limiting prevents abuse
4. **Contract Security**: Each provider uses isolated smart contracts
5. **Audit Trail**: All provider changes are logged

## Troubleshooting

### Common Issues

1. **Provider Not Available**:
   - Check if provider is active in database
   - Verify environment configuration
   - Check contract deployment status

2. **Payment Failures**:
   - Verify provider contract is deployed
   - Check network configuration
   - Review rate limiting status

3. **Rate Limiting Issues**:
   - Check per-provider rate limits
   - Review rate limit configuration
   - Monitor queue sizes

### Debug Commands

```bash
# Check active providers
curl http://localhost:3001/api/providers

# Check rate limit status
curl http://localhost:3001/api/providers/wata-board/rate-limit/user123

# Check provider analytics
curl http://localhost:3001/api/providers/analytics
```

## Migration from Single Provider

### Automatic Migration

The system automatically migrates existing data:
- Existing payments are assigned to the default provider
- Database constraints are updated
- Backward compatibility is maintained

### Manual Steps

1. Update environment configuration
2. Register additional providers
3. Update frontend to use provider selection
4. Test with legacy payment endpoints

## Best Practices

1. **Provider Configuration**:
   - Use descriptive provider IDs
   - Set appropriate rate limits
   - Configure supported meter types accurately

2. **Frontend Integration**:
   - Handle loading states gracefully
   - Provide clear provider information
   - Implement proper error handling

3. **Monitoring**:
   - Track provider performance
   - Monitor rate limiting effectiveness
   - Set up alerts for provider failures

4. **Testing**:
   - Test with multiple providers
   - Verify rate limiting behavior
   - Test error scenarios

## Future Enhancements

Planned features for the multi-provider system:

1. **Provider Reputation System**: Rate providers based on performance
2. **Dynamic Provider Selection**: Automatically select best provider based on criteria
3. **Provider Analytics Dashboard**: Advanced analytics UI
4. **Provider API Integration**: Direct integration with provider systems
5. **Multi-Currency Support**: Different currencies per provider
