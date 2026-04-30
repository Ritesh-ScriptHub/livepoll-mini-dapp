#![no_std]

use soroban_sdk::{
    contract, contracterror, contractimpl, contracttype, panic_with_error, symbol_short, Address,
    Env, String,
};

const INSTANCE_BUMP_AMOUNT: u32 = 518_400;
const INSTANCE_LIFETIME_THRESHOLD: u32 = 172_800;
const PERSISTENT_BUMP_AMOUNT: u32 = 2_592_000;
const PERSISTENT_LIFETIME_THRESHOLD: u32 = 864_000;

#[contracterror]
#[derive(Copy, Clone, Debug, Eq, PartialEq, PartialOrd, Ord)]
#[repr(u32)]
pub enum RewardTokenError {
    AlreadyInitialized = 1,
    NotInitialized = 2,
    InvalidAmount = 3,
    UnauthorizedMinter = 4,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub enum DataKey {
    Admin,
    Minter,
    Name,
    Symbol,
    TotalMinted,
    Balance(Address),
}

#[contract]
pub struct RewardTokenContract;

#[contractimpl]
impl RewardTokenContract {
    pub fn init(env: Env, admin: Address, minter: Address, name: String, symbol: String) {
        if env.storage().instance().has(&DataKey::Admin) {
            panic_with_error!(&env, RewardTokenError::AlreadyInitialized);
        }

        admin.require_auth();

        env.storage().instance().set(&DataKey::Admin, &admin);
        env.storage().instance().set(&DataKey::Minter, &minter);
        env.storage().instance().set(&DataKey::Name, &name);
        env.storage().instance().set(&DataKey::Symbol, &symbol);
        env.storage().instance().set(&DataKey::TotalMinted, &0i128);
        bump_instance(&env);
    }

    pub fn mint(env: Env, to: Address, amount: i128) {
        ensure_initialized(&env);

        if amount <= 0 {
            panic_with_error!(&env, RewardTokenError::InvalidAmount);
        }

        let minter = get_minter(&env);
        minter.require_auth();

        let balance_key = DataKey::Balance(to.clone());
        let current_balance = env
            .storage()
            .persistent()
            .get::<_, i128>(&balance_key)
            .unwrap_or(0);
        let next_balance = current_balance
            .checked_add(amount)
            .unwrap_or_else(|| panic_with_error!(&env, RewardTokenError::InvalidAmount));
        let total_minted = get_total_minted(&env)
            .checked_add(amount)
            .unwrap_or_else(|| panic_with_error!(&env, RewardTokenError::InvalidAmount));

        env.storage().persistent().set(&balance_key, &next_balance);
        env.storage().persistent().extend_ttl(
            &balance_key,
            PERSISTENT_LIFETIME_THRESHOLD,
            PERSISTENT_BUMP_AMOUNT,
        );
        env.storage().instance().set(&DataKey::TotalMinted, &total_minted);
        bump_instance(&env);

        env.events()
            .publish((symbol_short!("mint"), to), amount);
    }

    pub fn transfer_admin(env: Env, new_admin: Address) {
        ensure_initialized(&env);
        let admin = get_admin(&env);
        admin.require_auth();

        env.storage().instance().set(&DataKey::Admin, &new_admin);
        bump_instance(&env);

        env.events()
            .publish((symbol_short!("admin"),), new_admin);
    }

    pub fn balance(env: Env, account: Address) -> i128 {
        ensure_initialized(&env);
        let balance_key = DataKey::Balance(account);
        let balance = env
            .storage()
            .persistent()
            .get::<_, i128>(&balance_key)
            .unwrap_or(0);
        if balance > 0 {
            env.storage().persistent().extend_ttl(
                &balance_key,
                PERSISTENT_LIFETIME_THRESHOLD,
                PERSISTENT_BUMP_AMOUNT,
            );
        }
        bump_instance(&env);
        balance
    }

    pub fn total_minted(env: Env) -> i128 {
        ensure_initialized(&env);
        let total = get_total_minted(&env);
        bump_instance(&env);
        total
    }

    pub fn get_admin(env: Env) -> Address {
        ensure_initialized(&env);
        let admin = get_admin(&env);
        bump_instance(&env);
        admin
    }

    pub fn get_minter(env: Env) -> Address {
        ensure_initialized(&env);
        let minter = get_minter(&env);
        bump_instance(&env);
        minter
    }

    pub fn get_name(env: Env) -> String {
        ensure_initialized(&env);
        let name = env
            .storage()
            .instance()
            .get(&DataKey::Name)
            .unwrap_or_else(|| panic_with_error!(&env, RewardTokenError::NotInitialized));
        bump_instance(&env);
        name
    }

    pub fn get_symbol(env: Env) -> String {
        ensure_initialized(&env);
        let symbol = env
            .storage()
            .instance()
            .get(&DataKey::Symbol)
            .unwrap_or_else(|| panic_with_error!(&env, RewardTokenError::NotInitialized));
        bump_instance(&env);
        symbol
    }
}

fn ensure_initialized(env: &Env) {
    if !env.storage().instance().has(&DataKey::Admin) {
        panic_with_error!(env, RewardTokenError::NotInitialized);
    }
}

fn get_admin(env: &Env) -> Address {
    env.storage()
        .instance()
        .get(&DataKey::Admin)
        .unwrap_or_else(|| panic_with_error!(env, RewardTokenError::NotInitialized))
}

fn get_minter(env: &Env) -> Address {
    env.storage()
        .instance()
        .get(&DataKey::Minter)
        .unwrap_or_else(|| panic_with_error!(env, RewardTokenError::NotInitialized))
}

fn get_total_minted(env: &Env) -> i128 {
    env.storage()
        .instance()
        .get(&DataKey::TotalMinted)
        .unwrap_or_else(|| panic_with_error!(env, RewardTokenError::NotInitialized))
}

fn bump_instance(env: &Env) {
    env.storage()
        .instance()
        .extend_ttl(INSTANCE_LIFETIME_THRESHOLD, INSTANCE_BUMP_AMOUNT);
}

mod test;
