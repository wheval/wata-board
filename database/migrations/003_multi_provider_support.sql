-- Wata Board Database Migration - Multi-Provider Support
-- Version: 003
-- Description: Adds support for multiple utility providers
-- Created: 2025-04-18

-- Create utility_providers table
CREATE TABLE utility_providers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    provider_id VARCHAR(50) UNIQUE NOT NULL,
    name VARCHAR(100) NOT NULL,
    logo_url VARCHAR(255),
    contract_id VARCHAR(56) NOT NULL,
    network blockchain_network NOT NULL DEFAULT 'testnet',
    rpc_url VARCHAR(255) NOT NULL,
    is_active BOOLEAN DEFAULT true,
    supported_meter_types meter_type[] NOT NULL DEFAULT ARRAY['electricity', 'water', 'gas'],
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    
    -- Constraints
    CONSTRAINT utility_providers_provider_id_format CHECK (provider_id ~ '^[a-z0-9_-]+$'),
    CONSTRAINT utility_providers_contract_id_format CHECK (contract_id ~ '^[A-Za-z0-9]{56}$'),
    CONSTRAINT utility_providers_name_not_empty CHECK (length(trim(name)) > 0),
    CONSTRAINT utility_providers_rpc_url_not_empty CHECK (length(trim(rpc_url)) > 0)
);

-- Add provider_id to meters table
ALTER TABLE meters ADD COLUMN provider_id VARCHAR(50) NOT NULL DEFAULT 'wata-board';
ALTER TABLE meters ADD CONSTRAINT meters_provider_id_fkey 
    FOREIGN KEY (provider_id) REFERENCES utility_providers(provider_id) ON DELETE RESTRICT;

-- Add provider_id to payments table
ALTER TABLE payments ADD COLUMN provider_id VARCHAR(50) NOT NULL DEFAULT 'wata-board';
ALTER TABLE payments ADD CONSTRAINT payments_provider_id_fkey 
    FOREIGN KEY (provider_id) REFERENCES utility_providers(provider_id) ON DELETE RESTRICT;

-- Update payment_cache table to include provider_id
ALTER TABLE payment_cache ADD COLUMN provider_id VARCHAR(50) NOT NULL DEFAULT 'wata-board';
ALTER TABLE payment_cache DROP CONSTRAINT payment_cache_unique_meter_network;
ALTER TABLE payment_cache ADD CONSTRAINT payment_cache_unique_meter_network_provider 
    UNIQUE (meter_id, blockchain_network, provider_id);

-- Create indexes for provider-related queries
CREATE INDEX idx_utility_providers_provider_id ON utility_providers(provider_id);
CREATE INDEX idx_utility_providers_is_active ON utility_providers(is_active);
CREATE INDEX idx_utility_providers_network ON utility_providers(network);
CREATE INDEX idx_meters_provider_id ON meters(provider_id);
CREATE INDEX idx_payments_provider_id ON payments(provider_id);
CREATE INDEX idx_payment_cache_provider_id ON payment_cache(provider_id);

-- Create trigger to update utility_providers.updated_at
CREATE TRIGGER update_utility_providers_updated_at BEFORE UPDATE ON utility_providers
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Insert default Wata-Board provider
INSERT INTO utility_providers (provider_id, name, contract_id, network, rpc_url, supported_meter_types, metadata) VALUES
('wata-board', 'Wata-Board', 'CDRRJ7IPYDL36YSK5ZQLBG3LICULETIBXX327AGJQNTWXNKY2UMDO4DA', 'testnet', 'https://soroban-testnet.stellar.org', ARRAY['electricity', 'water', 'gas'], 
 '{"description": "Default utility payment provider", "region": "Global", "is_default": true}');

-- Update existing meters and payments to use the default provider
UPDATE meters SET provider_id = 'wata-board' WHERE provider_id IS NULL OR provider_id = '';
UPDATE payments SET provider_id = 'wata-board' WHERE provider_id IS NULL OR provider_id = '';
UPDATE payment_cache SET provider_id = 'wata-board' WHERE provider_id IS NULL OR provider_id = '';

-- Create view for provider analytics
CREATE OR REPLACE VIEW provider_analytics AS
SELECT 
    up.provider_id,
    up.name as provider_name,
    up.network,
    up.is_active,
    COUNT(DISTINCT m.id) as total_meters,
    COUNT(DISTINCT p.id) as total_payments,
    COALESCE(SUM(p.amount), 0) as total_amount,
    AVG(p.amount) as average_amount,
    COUNT(CASE WHEN p.status = 'confirmed' THEN 1 END) as confirmed_payments,
    COUNT(CASE WHEN p.status = 'failed' THEN 1 END) as failed_payments,
    MAX(p.created_at) as last_payment_date
FROM utility_providers up
LEFT JOIN meters m ON up.provider_id = m.provider_id
LEFT JOIN payments p ON up.provider_id = p.provider_id
GROUP BY up.provider_id, up.name, up.network, up.is_active
ORDER BY total_amount DESC;

-- Create function to get provider by meter type
CREATE OR REPLACE FUNCTION get_providers_by_meter_type(p_meter_type meter_type)
RETURNS TABLE (
    provider_id VARCHAR(50),
    name VARCHAR(100),
    contract_id VARCHAR(56),
    network blockchain_network,
    rpc_url VARCHAR(255),
    is_active BOOLEAN
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        up.provider_id,
        up.name,
        up.contract_id,
        up.network,
        up.rpc_url,
        up.is_active
    FROM utility_providers up
    WHERE up.is_active = true
    AND p_meter_type = ANY(up.supported_meter_types)
    ORDER BY up.name;
END;
$$ LANGUAGE plpgsql;

-- Create function to validate provider exists
CREATE OR REPLACE FUNCTION validate_provider_exists(p_provider_id VARCHAR(50))
RETURNS BOOLEAN AS $$
DECLARE
    v_exists BOOLEAN;
BEGIN
    SELECT EXISTS(
        SELECT 1 FROM utility_providers 
        WHERE provider_id = p_provider_id 
        AND is_active = true
    ) INTO v_exists;
    
    RETURN v_exists;
END;
$$ LANGUAGE plpgsql;

-- Add constraint to ensure provider exists for meters
ALTER TABLE meters ADD CONSTRAINT meters_provider_exists 
    CHECK (validate_provider_exists(provider_id));

-- Add constraint to ensure provider exists for payments
ALTER TABLE payments ADD CONSTRAINT payments_provider_exists 
    CHECK (validate_provider_exists(provider_id));

-- Update payment analytics view to include provider information
CREATE OR REPLACE VIEW payment_analytics AS
SELECT 
    DATE_TRUNC('month', p.created_at) as payment_month,
    m.meter_type,
    p.blockchain_network,
    up.provider_id,
    up.name as provider_name,
    COUNT(*) as total_payments,
    SUM(p.amount) as total_amount,
    AVG(p.amount) as average_amount,
    MIN(p.amount) as min_amount,
    MAX(p.amount) as max_amount,
    COUNT(CASE WHEN p.status = 'confirmed' THEN 1 END) as confirmed_payments,
    COUNT(CASE WHEN p.status = 'failed' THEN 1 END) as failed_payments
FROM payments p
JOIN meters m ON p.meter_id = m.meter_id
JOIN utility_providers up ON p.provider_id = up.provider_id
GROUP BY DATE_TRUNC('month', p.created_at), m.meter_type, p.blockchain_network, up.provider_id, up.name
ORDER BY payment_month DESC, provider_name;

-- Update get_meter_total_paid function to include provider
CREATE OR REPLACE FUNCTION get_meter_total_paid(
    p_meter_id VARCHAR(50),
    p_blockchain_network blockchain_network DEFAULT 'testnet',
    p_provider_id VARCHAR(50) DEFAULT 'wata-board'
)
RETURNS DECIMAL(12, 2) AS $$
DECLARE
    v_total_paid DECIMAL(12, 2);
    v_cache_exists BOOLEAN;
BEGIN
    -- Check if cache exists and is not expired
    SELECT EXISTS(
        SELECT 1 FROM payment_cache 
        WHERE meter_id = p_meter_id 
        AND blockchain_network = p_blockchain_network 
        AND provider_id = p_provider_id
        AND cache_expiry > CURRENT_TIMESTAMP
    ) INTO v_cache_exists;
    
    IF v_cache_exists THEN
        -- Return cached value
        SELECT total_paid INTO v_total_paid
        FROM payment_cache
        WHERE meter_id = p_meter_id 
        AND blockchain_network = p_blockchain_network
        AND provider_id = p_provider_id;
    ELSE
        -- Calculate from payments table
        SELECT COALESCE(SUM(amount), 0) INTO v_total_paid
        FROM payments
        WHERE meter_id = p_meter_id
        AND blockchain_network = p_blockchain_network
        AND provider_id = p_provider_id
        AND status = 'confirmed';
        
        -- Update cache
        INSERT INTO payment_cache (meter_id, total_paid, blockchain_network, provider_id)
        VALUES (p_meter_id, v_total_paid, p_blockchain_network, p_provider_id)
        ON CONFLICT (meter_id, blockchain_network, provider_id)
        DO UPDATE SET 
            total_paid = EXCLUDED.total_paid,
            last_updated = CURRENT_TIMESTAMP,
            cache_expiry = CURRENT_TIMESTAMP + INTERVAL '1 hour';
    END IF;
    
    RETURN v_total_paid;
END;
$$ LANGUAGE plpgsql;

-- Update invalidate_payment_cache function to include provider
CREATE OR REPLACE FUNCTION invalidate_payment_cache(p_meter_id VARCHAR(50), p_provider_id VARCHAR(50) DEFAULT NULL)
RETURNS VOID AS $$
BEGIN
    IF p_provider_id IS NOT NULL THEN
        UPDATE payment_cache
        SET cache_expiry = CURRENT_TIMESTAMP - INTERVAL '1 second'
        WHERE meter_id = p_meter_id AND provider_id = p_provider_id;
    ELSE
        UPDATE payment_cache
        SET cache_expiry = CURRENT_TIMESTAMP - INTERVAL '1 second'
        WHERE meter_id = p_meter_id;
    END IF;
END;
$$ LANGUAGE plpgsql;

-- Migration completed successfully
-- Record migration
INSERT INTO system_config (key, value, description) VALUES
('migration_003_multi_provider_support', '"completed"', 'Multi-provider support migration completed at ' || CURRENT_TIMESTAMP);

COMMIT;
