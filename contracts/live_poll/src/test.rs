#![cfg(test)]

use super::{LivePollContract, LivePollContractClient, LivePollError};
use soroban_sdk::{testutils::Address as _, Address, Env, String};

#[test]
fn initializes_and_votes() {
    let env = Env::default();
    env.mock_all_auths();
    let contract_id = env.register(LivePollContract, ());
    let client = LivePollContractClient::new(&env, &contract_id);

    let admin = Address::generate(&env);
    let voter = Address::generate(&env);

    client.init(
        &admin,
        &String::from_str(&env, "Which wallet should we demo?"),
        &String::from_str(&env, "Freighter"),
        &String::from_str(&env, "xBull"),
    );

    let poll = client.get_poll();
    assert_eq!(poll.total_votes, 0);

    client.vote(&voter, &0);
    let updated = client.get_poll();
    assert_eq!(updated.votes_a, 1);
    assert_eq!(updated.votes_b, 0);
    assert_eq!(updated.total_votes, 1);
    assert_eq!(client.get_vote(&voter), Some(0));
}

#[test]
#[should_panic(expected = "Error(Contract, #4)")]
fn rejects_double_vote() {
    let env = Env::default();
    env.mock_all_auths();
    let contract_id = env.register(LivePollContract, ());
    let client = LivePollContractClient::new(&env, &contract_id);

    let admin = Address::generate(&env);
    let voter = Address::generate(&env);

    client.init(
        &admin,
        &String::from_str(&env, "Question"),
        &String::from_str(&env, "A"),
        &String::from_str(&env, "B"),
    );

    client.vote(&voter, &1);
    client.vote(&voter, &0);
}

#[test]
fn error_codes_stay_stable() {
    assert_eq!(LivePollError::AlreadyInitialized as u32, 1);
    assert_eq!(LivePollError::NotInitialized as u32, 2);
    assert_eq!(LivePollError::InvalidChoice as u32, 3);
    assert_eq!(LivePollError::AlreadyVoted as u32, 4);
}

#[test]
#[should_panic(expected = "Error(Contract, #2)")]
fn rejects_reads_before_initialization() {
    let env = Env::default();
    let contract_id = env.register(LivePollContract, ());
    let client = LivePollContractClient::new(&env, &contract_id);

    client.get_poll();
}

#[test]
#[should_panic(expected = "Error(Contract, #3)")]
fn rejects_invalid_vote_choice() {
    let env = Env::default();
    env.mock_all_auths();
    let contract_id = env.register(LivePollContract, ());
    let client = LivePollContractClient::new(&env, &contract_id);

    let admin = Address::generate(&env);
    let voter = Address::generate(&env);

    client.init(
        &admin,
        &String::from_str(&env, "Question"),
        &String::from_str(&env, "A"),
        &String::from_str(&env, "B"),
    );

    client.vote(&voter, &2);
}
