#![cfg(test)]

use super::{RewardTokenContract, RewardTokenContractClient, RewardTokenError};
use soroban_sdk::{
    testutils::{Address as _, MockAuth, MockAuthInvoke},
    Address, Env, IntoVal, String,
};

#[test]
fn initializes_mints_and_tracks_totals() {
    let env = Env::default();

    let contract_id = env.register(RewardTokenContract, ());
    let client = RewardTokenContractClient::new(&env, &contract_id);

    let admin = Address::generate(&env);
    let minter = Address::generate(&env);
    let voter = Address::generate(&env);

    client
        .mock_auths(&[MockAuth {
            address: &admin,
            invoke: &MockAuthInvoke {
                contract: &contract_id,
                fn_name: "init",
                args: (
                    admin.clone(),
                    minter.clone(),
                    String::from_str(&env, "Poll Reward Token"),
                    String::from_str(&env, "VOTE"),
                )
                    .into_val(&env),
                sub_invokes: &[],
            },
        }])
        .init(
            &admin,
            &minter,
            &String::from_str(&env, "Poll Reward Token"),
            &String::from_str(&env, "VOTE"),
        );

    client
        .mock_auths(&[MockAuth {
            address: &minter,
            invoke: &MockAuthInvoke {
                contract: &contract_id,
                fn_name: "mint",
                args: (voter.clone(), 10_i128).into_val(&env),
                sub_invokes: &[],
            },
        }])
        .mint(&voter, &10);

    assert_eq!(client.balance(&voter), 10);
    assert_eq!(client.total_minted(), 10);
    assert_eq!(client.get_admin(), admin);
    assert_eq!(client.get_minter(), minter);
    assert_eq!(client.get_symbol(), String::from_str(&env, "VOTE"));
}

#[test]
fn transfers_admin() {
    let env = Env::default();

    let contract_id = env.register(RewardTokenContract, ());
    let client = RewardTokenContractClient::new(&env, &contract_id);

    let admin = Address::generate(&env);
    let next_admin = Address::generate(&env);
    let minter = Address::generate(&env);

    client
        .mock_auths(&[MockAuth {
            address: &admin,
            invoke: &MockAuthInvoke {
                contract: &contract_id,
                fn_name: "init",
                args: (
                    admin.clone(),
                    minter.clone(),
                    String::from_str(&env, "Poll Reward Token"),
                    String::from_str(&env, "VOTE"),
                )
                    .into_val(&env),
                sub_invokes: &[],
            },
        }])
        .init(
            &admin,
            &minter,
            &String::from_str(&env, "Poll Reward Token"),
            &String::from_str(&env, "VOTE"),
        );
    client
        .mock_auths(&[MockAuth {
            address: &admin,
            invoke: &MockAuthInvoke {
                contract: &contract_id,
                fn_name: "transfer_admin",
                args: (next_admin.clone(),).into_val(&env),
                sub_invokes: &[],
            },
        }])
        .transfer_admin(&next_admin);

    assert_eq!(client.get_admin(), next_admin);
}

#[test]
#[should_panic(expected = "Error(Auth, InvalidAction)")]
fn rejects_direct_minting_from_non_minter() {
    let env = Env::default();

    let contract_id = env.register(RewardTokenContract, ());
    let client = RewardTokenContractClient::new(&env, &contract_id);

    let admin = Address::generate(&env);
    let minter = Address::generate(&env);
    let voter = Address::generate(&env);

    client
        .mock_auths(&[MockAuth {
            address: &admin,
            invoke: &MockAuthInvoke {
                contract: &contract_id,
                fn_name: "init",
                args: (
                    admin.clone(),
                    minter.clone(),
                    String::from_str(&env, "Poll Reward Token"),
                    String::from_str(&env, "VOTE"),
                )
                    .into_val(&env),
                sub_invokes: &[],
            },
        }])
        .init(
            &admin,
            &minter,
            &String::from_str(&env, "Poll Reward Token"),
            &String::from_str(&env, "VOTE"),
        );

    client
        .mock_auths(&[MockAuth {
            address: &voter,
            invoke: &MockAuthInvoke {
                contract: &contract_id,
                fn_name: "mint",
                args: (voter.clone(), 10_i128).into_val(&env),
                sub_invokes: &[],
            },
        }])
        .mint(&voter, &10);
}

#[test]
fn error_codes_stay_stable() {
    assert_eq!(RewardTokenError::AlreadyInitialized as u32, 1);
    assert_eq!(RewardTokenError::NotInitialized as u32, 2);
    assert_eq!(RewardTokenError::InvalidAmount as u32, 3);
    assert_eq!(RewardTokenError::UnauthorizedMinter as u32, 4);
}
