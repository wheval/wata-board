#![no_std]
use soroban_sdk::{contract, contractimpl, contracttype, Address, Env, String, Map, Vec, Symbol, Vec};

// Provider Information Structure
#[derive(Clone, Debug, PartialEq, Eq)]
#[contracttype]
pub struct ProviderInfo {
    pub provider_id: String,
    pub name: String,
    pub contract_address: Address,
    pub is_active: bool,
    pub supported_meter_types: Vec<String>,
    pub metadata: Map<String, String>,
}

// Payment Record with Provider Information
#[derive(Clone, Debug, PartialEq, Eq)]
#[contracttype]
pub struct ProviderPaymentRecord {
    pub payment_id: u64,
    pub payer: Address,
    pub provider_id: String,
    pub meter_id: String,
    pub amount: i128,
    pub timestamp: u64,
    pub transaction_hash: String,
    pub status: PaymentStatus,
}

// Payment Status Enum
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
#[contracttype]
pub enum PaymentStatus {
    Pending,
    Confirmed,
    Failed,
    Refunded,
}

// Provider Statistics
#[derive(Clone, Debug, PartialEq, Eq)]
#[contracttype]
pub struct ProviderStats {
    pub total_payments: u64,
    pub total_amount: i128,
    pub successful_payments: u64,
    pub failed_payments: u64,
    pub last_payment_timestamp: u64,
}

// Storage Keys
const ADMIN_KEY: Symbol = Symbol::short("ADMIN");
const PROVIDERS_KEY: Symbol = Symbol::short("PROVIDERS");
const PAYMENT_COUNTER: Symbol = Symbol::short("PAY_CNT");
const PROVIDER_PAYMENTS: Symbol = Symbol::short("PROV_PAY");
const PROVIDER_STATS: Symbol = Symbol = Symbol::short("PROV_STATS");

#[contract]
pub struct MultiProviderContract;

#[contractimpl]
impl MultiProviderContract {
    /// Initialize the multi-provider contract
    pub fn initialize(env: Env, admin: Address) {
        // Only allow initialization once
        if env.storage().persistent().has(&ADMIN_KEY) {
            panic!("Contract already initialized");
        }
        
        env.storage().persistent().set(&ADMIN_KEY, &admin);
        env.storage().persistent().set(&PAYMENT_COUNTER, &0u64);
        env.storage().persistent().set(&PROVIDERS_KEY, &Map::new(&env));
    }

    /// Register a new utility provider
    pub fn register_provider(
        env: Env,
        admin: Address,
        provider_id: String,
        name: String,
        contract_address: Address,
        supported_meter_types: Vec<String>,
        metadata: Map<String, String>
    ) {
        admin.require_auth();
        
        // Verify admin
        let contract_admin = Self::get_admin(env.clone());
        if admin != contract_admin {
            panic!("Only admin can register providers");
        }

        // Validate inputs
        if provider_id.len() == 0 || name.len() == 0 {
            panic!("Provider ID and name cannot be empty");
        }

        if supported_meter_types.is_empty() {
            panic!("Provider must support at least one meter type");
        }

        // Check if provider already exists
        let mut providers: Map<String, ProviderInfo> = env.storage().persistent()
            .get(&PROVIDERS_KEY)
            .unwrap_or(Map::new(&env));
        
        if providers.contains_key(provider_id.clone()) {
            panic!("Provider already registered");
        }

        // Create provider info
        let provider_info = ProviderInfo {
            provider_id: provider_id.clone(),
            name,
            contract_address,
            is_active: true,
            supported_meter_types,
            metadata,
        };

        // Add provider
        providers.set(provider_id.clone(), provider_info);
        env.storage().persistent().set(&PROVIDERS_KEY, &providers);

        // Initialize provider statistics
        let stats = ProviderStats {
            total_payments: 0,
            total_amount: 0,
            successful_payments: 0,
            failed_payments: 0,
            last_payment_timestamp: 0,
        };
        env.storage().persistent().set((PROVIDER_STATS, provider_id), &stats);

        // Emit event
        env.events().publish(
            (Symbol::short("provider"), Symbol::short("registered")),
            (provider_id,)
        );
    }

    /// Update provider information
    pub fn update_provider(
        env: Env,
        admin: Address,
        provider_id: String,
        name: Option<String>,
        contract_address: Option<Address>,
        is_active: Option<bool>,
        supported_meter_types: Option<Vec<String>>,
        metadata: Option<Map<String, String>>
    ) {
        admin.require_auth();
        
        // Verify admin
        let contract_admin = Self::get_admin(env.clone());
        if admin != contract_admin {
            panic!("Only admin can update providers");
        }

        // Get existing provider
        let mut providers: Map<String, ProviderInfo> = env.storage().persistent()
            .get(&PROVIDERS_KEY)
            .unwrap_or_else(|| panic!("No providers registered"));
        
        let mut provider_info: ProviderInfo = providers.get(provider_id.clone())
            .unwrap_or_else(|| panic!("Provider not found"));

        // Update fields
        if let Some(n) = name { provider_info.name = n; }
        if let Some(addr) = contract_address { provider_info.contract_address = addr; }
        if let Some(active) = is_active { provider_info.is_active = active; }
        if let Some(types) = supported_meter_types { 
            if types.is_empty() {
                panic!("Provider must support at least one meter type");
            }
            provider_info.supported_meter_types = types; 
        }
        if let Some(meta) = metadata { provider_info.metadata = meta; }

        // Save updated provider
        providers.set(provider_id.clone(), provider_info);
        env.storage().persistent().set(&PROVIDERS_KEY, &providers);

        // Emit event
        env.events().publish(
            (Symbol::short("provider"), Symbol::short("updated")),
            (provider_id,)
        );
    }

    /// Deactivate a provider
    pub fn deactivate_provider(env: Env, admin: Address, provider_id: String) {
        admin.require_auth();
        
        // Verify admin
        let contract_admin = Self::get_admin(env.clone());
        if admin != contract_admin {
            panic!("Only admin can deactivate providers");
        }

        // Update provider
        Self::update_provider(
            env,
            admin,
            provider_id,
            None,
            None,
            Some(false),
            None,
            None
        );
    }

    /// Process a payment through a specific provider
    pub fn process_payment(
        env: Env,
        payer: Address,
        provider_id: String,
        meter_id: String,
        amount: i128,
        transaction_hash: String
    ) -> u64 {
        // Verify payer authorization
        payer.require_auth();

        // Validate amount
        if amount <= 0 {
            panic!("Amount must be positive");
        }

        // Check if provider exists and is active
        let providers: Map<String, ProviderInfo> = env.storage().persistent()
            .get(&PROVIDERS_KEY)
            .unwrap_or_else(|| panic!("No providers registered"));
        
        let provider_info: ProviderInfo = providers.get(provider_id.clone())
            .unwrap_or_else(|| panic!("Provider not found"));

        if !provider_info.is_active {
            panic!("Provider is not active");
        }

        // Generate payment ID
        let payment_id = Self::_generate_payment_id(&env);

        // Create payment record
        let payment_record = ProviderPaymentRecord {
            payment_id,
            payer: payer.clone(),
            provider_id: provider_id.clone(),
            meter_id: meter_id.clone(),
            amount,
            timestamp: env.ledger().timestamp(),
            transaction_hash: transaction_hash.clone(),
            status: PaymentStatus::Confirmed,
        };

        // Store payment record
        env.storage().persistent().set((PROVIDER_PAYMENTS, payment_id), &payment_record);

        // Update provider statistics
        Self::_update_provider_stats(&env, provider_id.clone(), amount, true);

        // Emit event
        env.events().publish(
            (Symbol::short("payment"), Symbol::short("processed")),
            (payment_id, provider_id, payer, meter_id, amount)
        );

        payment_id
    }

    /// Get provider information
    pub fn get_provider(env: Env, provider_id: String) -> ProviderInfo {
        let providers: Map<String, ProviderInfo> = env.storage().persistent()
            .get(&PROVIDERS_KEY)
            .unwrap_or_else(|| panic!("No providers registered"));
        
        providers.get(provider_id)
            .unwrap_or_else(|| panic!("Provider not found"))
    }

    /// Get all active providers
    pub fn get_active_providers(env: Env) -> Vec<ProviderInfo> {
        let providers: Map<String, ProviderInfo> = env.storage().persistent()
            .get(&PROVIDERS_KEY)
            .unwrap_or_else(|| panic!("No providers registered"));
        
        let mut active_providers = Vec::new(&env);
        for (_, provider_info) in providers.iter() {
            if provider_info.is_active {
                active_providers.push_back(provider_info);
            }
        }
        
        active_providers
    }

    /// Get providers by meter type
    pub fn get_providers_by_meter_type(env: Env, meter_type: String) -> Vec<ProviderInfo> {
        let providers: Map<String, ProviderInfo> = env.storage().persistent()
            .get(&PROVIDERS_KEY)
            .unwrap_or_else(|| panic!("No providers registered"));
        
        let mut matching_providers = Vec::new(&env);
        for (_, provider_info) in providers.iter() {
            if provider_info.is_active && provider_info.supported_meter_types.contains(meter_type.clone()) {
                matching_providers.push_back(provider_info);
            }
        }
        
        matching_providers
    }

    /// Get provider statistics
    pub fn get_provider_stats(env: Env, provider_id: String) -> ProviderStats {
        env.storage().persistent()
            .get((PROVIDER_STATS, provider_id))
            .unwrap_or_else(|| panic!("Provider statistics not found"))
    }

    /// Get payment record
    pub fn get_payment_record(env: Env, payment_id: u64) -> ProviderPaymentRecord {
        env.storage().persistent()
            .get((PROVIDER_PAYMENTS, payment_id))
            .unwrap_or_else(|| panic!("Payment record not found"))
    }

    /// Get payments for a specific provider
    pub fn get_provider_payments(
        env: Env,
        provider_id: String,
        from_index: Option<u32>,
        limit: Option<u32>
    ) -> Vec<ProviderPaymentRecord> {
        let counter: u64 = env.storage().persistent().get(&PAYMENT_COUNTER).unwrap_or(0);
        let mut payments = Vec::new(&env);
        
        let start = from_index.unwrap_or(0) as u64;
        let end = if let Some(l) = limit {
            (start + l as u64).min(counter)
        } else {
            counter
        };

        for i in start..end {
            if let Some(record) = env.storage().persistent().get::<(Symbol, u64), ProviderPaymentRecord>((PROVIDER_PAYMENTS, i)) {
                if record.provider_id == provider_id {
                    payments.push_back(record);
                }
            }
        }
        
        payments
    }

    /// Get payments for a specific payer
    pub fn get_payer_payments(env: Env, payer: Address) -> Vec<u64> {
        let counter: u64 = env.storage().persistent().get(&PAYMENT_COUNTER).unwrap_or(0);
        let mut payment_ids = Vec::new(&env);
        
        for i in 0..counter {
            let payment_id = i + 1; // Payment IDs start from 1
            if let Some(record) = env.storage().persistent().get::<(Symbol, u64), ProviderPaymentRecord>((PROVIDER_PAYMENTS, payment_id)) {
                if record.payer == payer {
                    payment_ids.push_back(payment_id);
                }
            }
        }
        
        payment_ids
    }

    /// Get the contract admin
    pub fn get_admin(env: Env) -> Address {
        env.storage().persistent().get(&ADMIN_KEY)
            .unwrap_or_else(|| panic!("Contract not initialized"))
    }

    // ===== HELPER FUNCTIONS =====

    /// Generate unique payment ID
    fn _generate_payment_id(env: &Env) -> u64 {
        let counter: u64 = env.storage().persistent().get(&PAYMENT_COUNTER).unwrap_or(0);
        let new_id = counter + 1;
        env.storage().persistent().set(&PAYMENT_COUNTER, &new_id);
        new_id
    }

    /// Update provider statistics
    fn _update_provider_stats(env: &Env, provider_id: String, amount: i128, successful: bool) {
        let mut stats: ProviderStats = env.storage().persistent()
            .get((PROVIDER_STATS, provider_id.clone()))
            .unwrap_or(ProviderStats {
                total_payments: 0,
                total_amount: 0,
                successful_payments: 0,
                failed_payments: 0,
                last_payment_timestamp: 0,
            });

        stats.total_payments += 1;
        stats.total_amount += amount;
        if successful {
            stats.successful_payments += 1;
        } else {
            stats.failed_payments += 1;
        }
        stats.last_payment_timestamp = env.ledger().timestamp();

        env.storage().persistent().set((PROVIDER_STATS, provider_id), &stats);
    }
}
