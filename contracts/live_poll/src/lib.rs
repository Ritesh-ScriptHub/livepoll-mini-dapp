#![no_std]

use soroban_sdk::{
    contract, contracterror, contractimpl, contracttype, panic_with_error, symbol_short, Address,
    Env, String, Symbol,
};

const INSTANCE_BUMP_AMOUNT: u32 = 518_400;
const INSTANCE_LIFETIME_THRESHOLD: u32 = 172_800;
const PERSISTENT_BUMP_AMOUNT: u32 = 2_592_000;
const PERSISTENT_LIFETIME_THRESHOLD: u32 = 864_000;

#[contracterror]
#[derive(Copy, Clone, Debug, Eq, PartialEq, PartialOrd, Ord)]
#[repr(u32)]
pub enum LivePollError {
    AlreadyInitialized = 1,
    NotInitialized = 2,
    InvalidChoice = 3,
    AlreadyVoted = 4,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub enum DataKey {
    Poll,
    Admin,
    Vote(Address),
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct PollState {
    pub question: String,
    pub option_a: String,
    pub option_b: String,
    pub votes_a: u32,
    pub votes_b: u32,
    pub total_votes: u32,
}

#[contract]
pub struct LivePollContract;

#[contractimpl]
impl LivePollContract {
    pub fn init(env: Env, admin: Address, question: String, option_a: String, option_b: String) {
        if env.storage().instance().has(&DataKey::Poll) {
            panic_with_error!(&env, LivePollError::AlreadyInitialized);
        }

        admin.require_auth();

        let poll = PollState {
            question,
            option_a,
            option_b,
            votes_a: 0,
            votes_b: 0,
            total_votes: 0,
        };

        env.storage().instance().set(&DataKey::Poll, &poll);
        env.storage().instance().set(&DataKey::Admin, &admin);
        bump_instance(&env);

        env.events()
            .publish((symbol_short!("init"),), poll.total_votes);
    }

    pub fn vote(env: Env, voter: Address, choice: u32) {
        voter.require_auth();
        ensure_initialized(&env);

        if choice > 1 {
            panic_with_error!(&env, LivePollError::InvalidChoice);
        }

        let vote_key = DataKey::Vote(voter.clone());
        if env.storage().persistent().has(&vote_key) {
            panic_with_error!(&env, LivePollError::AlreadyVoted);
        }

        let mut poll = get_poll_state(&env);
        if choice == 0 {
            poll.votes_a += 1;
        } else {
            poll.votes_b += 1;
        }
        poll.total_votes += 1;

        env.storage().instance().set(&DataKey::Poll, &poll);
        env.storage().persistent().set(&vote_key, &choice);
        env.storage().persistent().extend_ttl(
            &vote_key,
            PERSISTENT_LIFETIME_THRESHOLD,
            PERSISTENT_BUMP_AMOUNT,
        );
        bump_instance(&env);

        env.events()
            .publish((symbol_short!("vote"), voter), choice);
    }

    pub fn get_poll(env: Env) -> PollState {
        let poll = get_poll_state(&env);
        bump_instance(&env);
        poll
    }

    pub fn get_vote(env: Env, voter: Address) -> Option<u32> {
        ensure_initialized(&env);

        let vote_key = DataKey::Vote(voter.clone());
        let vote = env.storage().persistent().get::<_, u32>(&vote_key);
        if vote.is_some() {
            env.storage().persistent().extend_ttl(
                &vote_key,
                PERSISTENT_LIFETIME_THRESHOLD,
                PERSISTENT_BUMP_AMOUNT,
            );
        }
        bump_instance(&env);
        vote
    }

    pub fn get_admin(env: Env) -> Address {
        ensure_initialized(&env);
        let admin = env
            .storage()
            .instance()
            .get(&DataKey::Admin)
            .unwrap_or_else(|| panic_with_error!(&env, LivePollError::NotInitialized));
        bump_instance(&env);
        admin
    }

    pub fn version(_env: Env) -> u32 {
        1
    }
}

fn ensure_initialized(env: &Env) {
    if !env.storage().instance().has(&DataKey::Poll) {
        panic_with_error!(env, LivePollError::NotInitialized);
    }
}

fn get_poll_state(env: &Env) -> PollState {
    ensure_initialized(env);
    env.storage()
        .instance()
        .get(&DataKey::Poll)
        .unwrap_or_else(|| panic_with_error!(env, LivePollError::NotInitialized))
}

fn bump_instance(env: &Env) {
    env.storage()
        .instance()
        .extend_ttl(INSTANCE_LIFETIME_THRESHOLD, INSTANCE_BUMP_AMOUNT);
}

#[allow(dead_code)]
fn _event_symbol(_symbol: Symbol) {}

mod test;
