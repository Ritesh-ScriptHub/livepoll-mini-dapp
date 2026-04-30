#![cfg(test)]

use super::{LivePollContract, LivePollContractClient, LivePollError};
use poll_reward_token::{RewardTokenContract, RewardTokenContractClient};
use soroban_sdk::{testutils::Address as _, Address, Env, String};

#[test]
fn initializes_votes_and_mints_rewards() {
    let env = Env::default();
    env.mock_all_auths();
    let poll_contract_id = env.register(LivePollContract, ());
    let reward_contract_id = env.register(RewardTokenContract, ());
    let client = LivePollContractClient::new(&env, &poll_contract_id);
    let reward_client = RewardTokenContractClient::new(&env, &reward_contract_id);

    let admin = Address::generate(&env);
    let voter = Address::generate(&env);
    let poll_address = poll_contract_id.clone();

    reward_client.init(
        &admin,
        &poll_address,
        &String::from_str(&env, "Poll Reward Token"),
        &String::from_str(&env, "VOTE"),
    );

    client.init(
        &admin,
        &reward_contract_id,
        &String::from_str(&env, "Which wallet should we demo?"),
        &String::from_str(&env, "Freighter"),
        &String::from_str(&env, "xBull"),
    );

    let poll = client.get_poll();
    assert_eq!(poll.total_votes, 0);

    client.vote_for(&voter, &0);
    let updated = client.get_poll();
    assert_eq!(updated.votes_a, 1);
    assert_eq!(updated.votes_b, 0);
    assert_eq!(updated.total_votes, 1);
    assert_eq!(client.get_vote(&voter), Some(0));
    assert_eq!(client.get_reward_token(), reward_contract_id.clone());
    assert_eq!(client.reward_points_per_vote(), 10);
    assert_eq!(reward_client.balance(&voter), 10);
    assert_eq!(reward_client.total_minted(), 10);
}

#[test]
#[should_panic(expected = "Error(Contract, #4)")]
fn rejects_double_vote() {
    let env = Env::default();
    env.mock_all_auths();
    let poll_contract_id = env.register(LivePollContract, ());
    let reward_contract_id = env.register(RewardTokenContract, ());
    let client = LivePollContractClient::new(&env, &poll_contract_id);
    let reward_client = RewardTokenContractClient::new(&env, &reward_contract_id);

    let admin = Address::generate(&env);
    let voter = Address::generate(&env);
    let poll_address = poll_contract_id.clone();

    reward_client.init(
        &admin,
        &poll_address,
        &String::from_str(&env, "Poll Reward Token"),
        &String::from_str(&env, "VOTE"),
    );

    client.init(
        &admin,
        &reward_contract_id,
        &String::from_str(&env, "Question"),
        &String::from_str(&env, "A"),
        &String::from_str(&env, "B"),
    );

    client.vote_for(&voter, &1);
    client.vote_for(&voter, &0);
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
    let poll_contract_id = env.register(LivePollContract, ());
    let client = LivePollContractClient::new(&env, &poll_contract_id);

    client.get_poll();
}

#[test]
#[should_panic(expected = "Error(Contract, #3)")]
fn rejects_invalid_vote_choice() {
    let env = Env::default();
    env.mock_all_auths();
    let poll_contract_id = env.register(LivePollContract, ());
    let reward_contract_id = env.register(RewardTokenContract, ());
    let client = LivePollContractClient::new(&env, &poll_contract_id);
    let reward_client = RewardTokenContractClient::new(&env, &reward_contract_id);

    let admin = Address::generate(&env);
    let voter = Address::generate(&env);
    let poll_address = poll_contract_id.clone();

    reward_client.init(
        &admin,
        &poll_address,
        &String::from_str(&env, "Poll Reward Token"),
        &String::from_str(&env, "VOTE"),
    );

    client.init(
        &admin,
        &reward_contract_id,
        &String::from_str(&env, "Question"),
        &String::from_str(&env, "A"),
        &String::from_str(&env, "B"),
    );

    client.vote_for(&voter, &2);
}
