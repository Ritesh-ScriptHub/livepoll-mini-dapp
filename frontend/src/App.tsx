import { useEffect, useMemo, useRef, useState } from "react";
import { CONTRACT_ID, MIN_BALANCE_XLM } from "./config";
import { clearCachedItem, getCachedItem, setCachedItem } from "./lib/cache";
import { humanizeWalletError, isContractNotInitializedError } from "./lib/errors";
import { calculateVotePercents, defaultPoll } from "./lib/poll";
import {
  decodeEventTopic,
  decodeEventValue,
  encodeInitArgs,
  encodeVoteArgs,
  fetchPollState,
  fetchVoteFor,
  getEvents,
  latestLedger,
  pollTransaction,
  prepareWriteTx,
  sendSignedTransaction,
} from "./lib/stellar";
import {
  chooseWallet,
  disconnectWalletSession,
  fetchAccount,
  signTransaction,
  WALLET_OPTIONS,
} from "./lib/wallet";
import type { ActivityItem, PollState, PollVote, TxStatus, WalletAccount, WalletState } from "./types";

const POLL_CACHE_KEY = "livepoll:poll";
const voteCacheKey = (address: string) => `livepoll:vote:${address}`;
const CACHE_TTL_MS = 30_000;
const explorerTxUrl = (hash: string) => `https://stellar.expert/explorer/testnet/tx/${hash}`;

function shortAddress(address: string) {
  return `${address.slice(0, 4)}...${address.slice(-4)}`;
}

function TxPulse({ status }: { status: TxStatus }) {
  const map: Record<TxStatus, { label: string; cls: string }> = {
    idle: { label: "IDLE", cls: "status-idle" },
    pending: { label: "PENDING", cls: "status-pending" },
    success: { label: "SUCCESS", cls: "status-success" },
    failed: { label: "FAILED", cls: "status-failed" },
  };
  const { label, cls } = map[status];

  return (
    <span className={`tx-badge ${cls}`}>
      <span className="tx-dot" />
      {label}
    </span>
  );
}

function WalletIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="6" width="20" height="14" rx="2" />
      <path d="M16 14a1 1 0 1 0 0-2 1 1 0 0 0 0 2z" fill="currentColor" stroke="none" />
      <path d="M22 10H18a2 2 0 0 0 0 4h4" />
      <path d="M6 6V5a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v1" />
    </svg>
  );
}

function ChevronIcon({ open }: { open: boolean }) {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      style={{ transform: open ? "rotate(180deg)" : "rotate(0deg)", transition: "transform 0.2s" }}
    >
      <polyline points="6 9 12 15 18 9" />
    </svg>
  );
}

function StarIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 32 32" fill="none">
      <path d="M16 2 C16 2 17.5 10 24 12 C17.5 14 16 22 16 22 C16 22 14.5 14 8 12 C14.5 10 16 2 16 2Z" fill="#00b4ff" />
    </svg>
  );
}

function ActivityIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
    </svg>
  );
}

function App() {
  const [walletState, setWalletState] = useState<WalletState>("idle");
  const [walletLabel, setWalletLabel] = useState("Connect wallet");
  const [wallet, setWallet] = useState<WalletAccount | null>(null);
  const [selectedWalletId, setSelectedWalletId] = useState(WALLET_OPTIONS[0]?.id ?? "");
  const [poll, setPoll] = useState<PollState>(defaultPoll);
  const [selectedVote, setSelectedVote] = useState<PollVote>(0);
  const [existingVote, setExistingVote] = useState<number | null>(null);
  const [txStatus, setTxStatus] = useState<TxStatus>("idle");
  const [txMessage, setTxMessage] = useState("Waiting for your next action.");
  const [latestTxHash, setLatestTxHash] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState("");
  const [events, setEvents] = useState<ActivityItem[]>([]);
  const [eventCursor, setEventCursor] = useState<string | undefined>(undefined);
  const [eventStartLedger, setEventStartLedger] = useState<number>(0);
  const [isInitialized, setIsInitialized] = useState(Boolean(CONTRACT_ID));
  const [formQuestion, setFormQuestion] = useState(defaultPoll.question);
  const [formOptionA, setFormOptionA] = useState(defaultPoll.optionA);
  const [formOptionB, setFormOptionB] = useState(defaultPoll.optionB);
  const [isBusy, setIsBusy] = useState(false);
  const [isHydrating, setIsHydrating] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isUsingCachedSnapshot, setIsUsingCachedSnapshot] = useState(false);
  const [lastSyncAt, setLastSyncAt] = useState<number | null>(null);
  const [walletMenuOpen, setWalletMenuOpen] = useState(false);
  const intervalRef = useRef<number | null>(null);
  const cursorRef = useRef<string | undefined>(undefined);
  const walletAddressRef = useRef<string | undefined>(undefined);

  const { votePercentA, votePercentB } = useMemo(() => calculateVotePercents(poll), [poll]);

  function hydratePollFromCache(address?: string) {
    const cachedPoll = getCachedItem<PollState>(POLL_CACHE_KEY, CACHE_TTL_MS);
    if (cachedPoll) {
      setPoll(cachedPoll.value);
      setFormQuestion(cachedPoll.value.question);
      setFormOptionA(cachedPoll.value.optionA);
      setFormOptionB(cachedPoll.value.optionB);
      setIsInitialized(true);
      setIsUsingCachedSnapshot(true);
      setLastSyncAt(cachedPoll.savedAt);
    }

    if (!address) {
      return;
    }

    const cachedVote = getCachedItem<number | null>(voteCacheKey(address), CACHE_TTL_MS);
    if (cachedVote) {
      setExistingVote(cachedVote.value);
    }
  }

  async function refreshPoll(address?: string, options?: { silent?: boolean }) {
    if (!CONTRACT_ID) {
      return;
    }

    if (!options?.silent) {
      setIsRefreshing(true);
    }

    try {
      const nextPoll = await fetchPollState();
      setPoll(nextPoll);
      setFormQuestion(nextPoll.question);
      setFormOptionA(nextPoll.optionA);
      setFormOptionB(nextPoll.optionB);
      setIsInitialized(true);
      setIsUsingCachedSnapshot(false);
      setLastSyncAt(Date.now());
      setCachedItem(POLL_CACHE_KEY, nextPoll);

      if (address) {
        try {
          const vote = await fetchVoteFor(address);
          setExistingVote(vote);
          setCachedItem(voteCacheKey(address), vote);
        } catch {
          setExistingVote(null);
        }
      }
    } catch (error) {
      if (!isContractNotInitializedError(error)) {
        throw error;
      }

      setPoll(defaultPoll);
      setFormQuestion(defaultPoll.question);
      setFormOptionA(defaultPoll.optionA);
      setFormOptionB(defaultPoll.optionB);
      setExistingVote(null);
      setIsInitialized(false);
      setIsUsingCachedSnapshot(false);
      setLastSyncAt(null);
      clearCachedItem(POLL_CACHE_KEY);
      if (address) {
        clearCachedItem(voteCacheKey(address));
      }
      setErrorMessage("This contract is live on testnet, but the poll has not been initialized yet.");
    } finally {
      setIsHydrating(false);
      setIsRefreshing(false);
    }
  }

  async function startEventLoop() {
    if (!CONTRACT_ID) {
      return;
    }

    const startLedger = await latestLedger();
    setEventStartLedger(startLedger);

    intervalRef.current = window.setInterval(async () => {
      try {
        const result = await getEvents(startLedger, cursorRef.current);
        if (result.events.length > 0) {
          const mapped = result.events.map((event) => {
            const firstTopic = event.topic[0] ? decodeEventTopic(event.topic[0]) : "";
            const secondTopic = event.topic[1] ? decodeEventTopic(event.topic[1]) : undefined;
            const decodedValue = decodeEventValue(event.value);
            const choice = typeof decodedValue === "number" ? Number(decodedValue) : undefined;

            return {
              id: event.id,
              ledger: event.ledger,
              txHash: event.txHash,
              voter: firstTopic === "vote" ? secondTopic : undefined,
              choice,
              closedAt: event.ledgerClosedAt,
            };
          });

          setEvents((current) => {
            const merged = [...mapped.reverse(), ...current];
            const unique = merged.filter((item, index, array) => array.findIndex((entry) => entry.id === item.id) === index);
            return unique.slice(0, 8);
          });

          cursorRef.current = result.cursor;
          setEventCursor(result.cursor);
          await refreshPoll(walletAddressRef.current, { silent: true });
        }
      } catch {
        // Keep the app responsive if RPC event retention or connectivity is flaky.
      }
    }, 6000);
  }

  useEffect(() => {
    if (!CONTRACT_ID) {
      setErrorMessage("Set VITE_STELLAR_CONTRACT_ID after deploying the contract to testnet.");
      setIsHydrating(false);
      return;
    }

    hydratePollFromCache();
    refreshPoll().catch((error: Error) => {
      setErrorMessage(humanizeWalletError(error));
      setIsHydrating(false);
    });
    startEventLoop().catch(() => undefined);

    return () => {
      if (intervalRef.current) {
        window.clearInterval(intervalRef.current);
      }
    };
  }, []);

  async function connectWallet() {
    if (!selectedWalletId) {
      setWalletState("error");
      setErrorMessage("Select a Stellar wallet before connecting.");
      return;
    }

    setWalletState("connecting");
    setErrorMessage("");
    setWalletMenuOpen(false);

    try {
      const { address, walletName } = await chooseWallet(selectedWalletId);
      walletAddressRef.current = address;
      setWalletLabel(`${walletName}: ${shortAddress(address)}`);
      setWalletState("connected");
      setWallet({ address, balance: null });

      try {
        const account = await fetchAccount(address);
        setWallet(account);
      } catch (error) {
        setErrorMessage(humanizeWalletError(error));
      }

      hydratePollFromCache(address);
      await refreshPoll(address);
    } catch (error) {
      setWalletState("error");
      setErrorMessage(humanizeWalletError(error));
    }
  }

  async function disconnectWallet() {
    await disconnectWalletSession();
    setWallet(null);
    setWalletState("idle");
    setWalletLabel("Connect wallet");
    walletAddressRef.current = undefined;
    setExistingVote(null);
    setWalletMenuOpen(false);
    setErrorMessage("");
  }

  async function trackTransaction(hash: string): Promise<boolean> {
    setLatestTxHash(hash);
    setTxStatus("pending");
    setTxMessage("Transaction submitted. Waiting for ledger confirmation...");

    for (let attempt = 0; attempt < 20; attempt += 1) {
      const result = await pollTransaction(hash);

      if (result.status === "SUCCESS") {
        setTxStatus("success");
        setTxMessage("Confirmed on testnet.");
        await refreshPoll(wallet?.address, { silent: true });
        return true;
      }

      if (result.status === "FAILED") {
        setTxStatus("failed");
        setTxMessage("The network rejected the transaction.");
        return false;
      }

      await new Promise((resolve) => window.setTimeout(resolve, 2500));
    }

    setTxStatus("failed");
    setTxMessage("Timed out while waiting for the final transaction status.");
    return false;
  }

  async function submitInit() {
    if (!wallet?.address) {
      setErrorMessage("Connect a wallet before initializing the poll.");
      return;
    }

    if (!CONTRACT_ID) {
      setErrorMessage("Deploy the contract first, then add its ID to VITE_STELLAR_CONTRACT_ID.");
      return;
    }

    setIsBusy(true);
    setErrorMessage("");
    setLatestTxHash(null);

    try {
      const prepared = await prepareWriteTx(
        wallet.address,
        "init",
        encodeInitArgs(formQuestion, formOptionA, formOptionB, wallet.address),
      );
      const { signedTxXdr } = await signTransaction(prepared.toXDR(), wallet.address);
      const sendResult = await sendSignedTransaction(signedTxXdr);
      setTxStatus("pending");
      setTxMessage("Initialization sent to the network.");

      const succeeded = await trackTransaction(sendResult.hash);
      if (!succeeded) {
        throw new Error("Initialization was submitted but did not complete successfully.");
      }

      setIsInitialized(true);
    } catch (error) {
      setTxStatus("failed");
      setTxMessage("Initialization failed.");
      setErrorMessage(humanizeWalletError(error));
    } finally {
      setIsBusy(false);
    }
  }

  async function submitVote() {
    if (!wallet?.address) {
      setErrorMessage("Connect a wallet to vote.");
      return;
    }

    if (wallet.balance !== null && wallet.balance < MIN_BALANCE_XLM) {
      setErrorMessage(`Insufficient XLM balance. Keep at least ${MIN_BALANCE_XLM} XLM available for fees and reserve.`);
      return;
    }

    setIsBusy(true);
    setErrorMessage("");
    setLatestTxHash(null);

    try {
      const prepared = await prepareWriteTx(wallet.address, "vote", encodeVoteArgs(wallet.address, selectedVote));
      const { signedTxXdr } = await signTransaction(prepared.toXDR(), wallet.address);
      const sendResult = await sendSignedTransaction(signedTxXdr);
      setTxStatus("pending");
      setTxMessage("Vote submitted.");

      const succeeded = await trackTransaction(sendResult.hash);
      if (!succeeded) {
        throw new Error("Vote transaction did not complete successfully.");
      }

      setExistingVote(selectedVote);
    } catch (error) {
      setTxStatus("failed");
      setTxMessage("Vote failed.");
      setErrorMessage(humanizeWalletError(error));
    } finally {
      setIsBusy(false);
    }
  }

  return (
    <div className="app-root">
      <div className="bg-orb bg-orb-1" />
      <div className="bg-orb bg-orb-2" />
      <div className="grid-overlay" aria-hidden="true" />

      <header className="site-header">
        <div className="header-inner">
          <div className="header-brand">
            <div className="brand-icon">
              <StarIcon />
            </div>
            <div className="brand-text">
              <span className="brand-name">LivePoll</span>
              <span className="brand-sub">Stellar Testnet</span>
            </div>
          </div>

          <nav className="header-nav">
            <span className="nav-tag">Soroban Contract</span>
            <span className="nav-divider" />
            <span className="nav-tag net-tag">Testnet</span>
          </nav>

          <div className="wallet-zone">
            {walletState === "connected" ? (
              <div className="wallet-dropdown-wrap">
                <button className="wallet-btn wallet-btn--connected" onClick={() => setWalletMenuOpen((open) => !open)}>
                  <span className="wallet-indicator" />
                  <WalletIcon />
                  <span className="wallet-label">{walletLabel}</span>
                  <ChevronIcon open={walletMenuOpen} />
                </button>

                {walletMenuOpen && (
                  <div className="wallet-menu">
                    <div className="wallet-menu-header">
                      <span className="wallet-menu-title">Connected Wallet</span>
                    </div>
                    {wallet && (
                      <>
                        <div className="wallet-menu-row">
                          <span className="wm-label">Address</span>
                          <span className="wm-value mono">{shortAddress(wallet.address)}</span>
                        </div>
                        <div className="wallet-menu-row">
                          <span className="wm-label">Balance</span>
                          <span className="wm-value">
                            {wallet.balance !== null && wallet.balance !== undefined ? `${wallet.balance} XLM` : "Loading..."}
                          </span>
                        </div>
                      </>
                    )}
                    <button className="wallet-disconnect-btn" onClick={disconnectWallet}>
                      Disconnect
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <div className="wallet-connect-stack">
                <label className="wallet-picker-label" htmlFor="wallet-picker">
                  Stellar Wallet
                </label>
                <div className="wallet-picker-row">
                  <div className="wallet-picker-wrap">
                    <WalletIcon />
                    <select
                      id="wallet-picker"
                      className="wallet-picker"
                      value={selectedWalletId}
                      onChange={(event) => setSelectedWalletId(event.target.value)}
                      disabled={walletState === "connecting"}
                    >
                      {WALLET_OPTIONS.map((option) => (
                        <option key={option.id} value={option.id}>
                          {option.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <button className="wallet-btn wallet-btn--idle" onClick={connectWallet} disabled={walletState === "connecting"}>
                    {walletState === "connecting" ? (
                      <>
                        <span className="spinner" />
                        Connecting...
                      </>
                    ) : (
                      "Connect Wallet"
                    )}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </header>

      <div className="hero-strip">
        <div className="hero-inner">
          <div className="hero-badge">On-chain voting</div>
          <h1 className="hero-title">Live Poll</h1>
          <p className="hero-sub">
            A one-question Soroban poll with multi-wallet login, contract-backed votes,
            <br />
            live event updates, and transaction tracking.
          </p>
        </div>
      </div>

      <main className="main-grid">
        <section className="card vote-card">
          <div className="card-header">
            <div>
              <p className="card-eyebrow">Contract | Poll</p>
              <h2 className="card-title">{poll.question}</h2>
              <p className="hint-text">
                {isHydrating
                  ? "Loading on-chain poll state..."
                  : isUsingCachedSnapshot
                    ? "Showing a cached snapshot while the latest ledger data loads."
                    : lastSyncAt
                      ? `Synced ${new Date(lastSyncAt).toLocaleTimeString()}.`
                      : "Ready to read from Stellar testnet."}
              </p>
            </div>
            <TxPulse status={txStatus} />
          </div>

          <div className="vote-options">
            <label className={`vote-option ${selectedVote === 0 ? "vote-option--selected" : ""} ${existingVote === 0 ? "vote-option--voted" : ""}`}>
              <input
                type="radio"
                name="vote"
                checked={selectedVote === 0}
                onChange={() => setSelectedVote(0)}
                disabled={existingVote !== null}
                className="vote-radio"
              />
              <div className="vote-option-body">
                <div className="vote-option-top">
                  <div className="vote-option-marker">A</div>
                  <strong className="vote-option-label">{poll.optionA}</strong>
                  <span className="vote-option-pct">{votePercentA}%</span>
                </div>
                <div className="vote-bar-track">
                  <div className="vote-bar-fill vote-bar-a" style={{ width: `${votePercentA}%` }} />
                </div>
                <span className="vote-count">{poll.votesA} votes</span>
              </div>
              {existingVote === 0 && <span className="voted-chip">Your vote</span>}
            </label>

            <label className={`vote-option ${selectedVote === 1 ? "vote-option--selected" : ""} ${existingVote === 1 ? "vote-option--voted" : ""}`}>
              <input
                type="radio"
                name="vote"
                checked={selectedVote === 1}
                onChange={() => setSelectedVote(1)}
                disabled={existingVote !== null}
                className="vote-radio"
              />
              <div className="vote-option-body">
                <div className="vote-option-top">
                  <div className="vote-option-marker vote-option-marker--b">B</div>
                  <strong className="vote-option-label">{poll.optionB}</strong>
                  <span className="vote-option-pct">{votePercentB}%</span>
                </div>
                <div className="vote-bar-track">
                  <div className="vote-bar-fill vote-bar-b" style={{ width: `${votePercentB}%` }} />
                </div>
                <span className="vote-count">{poll.votesB} votes</span>
              </div>
              {existingVote === 1 && <span className="voted-chip voted-chip--b">Your vote</span>}
            </label>
          </div>

          <div className="poll-meta">
            <div className="poll-meta-item">
              <span className="poll-meta-label">Total votes</span>
              <span className="poll-meta-value">{poll.totalVotes}</span>
            </div>
            <div className="poll-meta-sep" />
            <div className="poll-meta-item">
              <span className="poll-meta-label">Start ledger</span>
              <span className="poll-meta-value mono">{eventStartLedger || "-"}</span>
            </div>
            <div className="poll-meta-sep" />
            <div className="poll-meta-item">
              <span className="poll-meta-label">Network</span>
              <span className="poll-meta-value">Testnet</span>
            </div>
            <div className="poll-meta-sep" />
            <div className="poll-meta-item">
              <span className="poll-meta-label">Refresh</span>
              <span className="poll-meta-value">{isRefreshing ? "Syncing" : "Live"}</span>
            </div>
          </div>

          <button
            className={`btn-primary ${isBusy ? "btn--loading" : ""}`}
            onClick={submitVote}
            disabled={isBusy || isHydrating || existingVote !== null || !isInitialized}
          >
            {existingVote !== null ? (
              "Vote Recorded"
            ) : isBusy ? (
              <>
                <span className="spinner" />
                Submitting...
              </>
            ) : isHydrating ? (
              <>
                <span className="spinner" />
                Loading Poll...
              </>
            ) : (
              "Submit Vote"
            )}
          </button>

          {existingVote !== null && <p className="hint-text">Your wallet has already voted on this poll.</p>}

          <div className={`tx-strip tx-strip--${txStatus}`}>
            <div className="tx-strip-dot" />
            <span className="tx-strip-msg">{txMessage}</span>
          </div>
          {latestTxHash && (
            <p className="hint-text">
              <a
                href={explorerTxUrl(latestTxHash)}
                target="_blank"
                rel="noreferrer"
                className="tx-link"
              >
                View transaction on Stellar Expert
              </a>
            </p>
          )}
        </section>

        <aside className="side-stack">
          <section className="card setup-card">
            <div className="card-header">
              <div>
                <p className="card-eyebrow">Setup</p>
                <h2 className="card-title">Initialize Poll</h2>
              </div>
            </div>

            <div className="field-stack">
              <div className="field-group">
                <label className="field-label">Question</label>
                <input
                  className="field-input"
                  value={formQuestion}
                  onChange={(event) => setFormQuestion(event.target.value)}
                  placeholder="What should we vote on?"
                  disabled={isInitialized}
                />
              </div>

              <div className="field-row">
                <div className="field-group">
                  <label className="field-label">Option A</label>
                  <input
                    className="field-input"
                    value={formOptionA}
                    onChange={(event) => setFormOptionA(event.target.value)}
                    placeholder="Option A"
                    disabled={isInitialized}
                  />
                </div>
                <div className="field-group">
                  <label className="field-label">Option B</label>
                  <input
                    className="field-input"
                    value={formOptionB}
                    onChange={(event) => setFormOptionB(event.target.value)}
                    placeholder="Option B"
                    disabled={isInitialized}
                  />
                </div>
              </div>
            </div>

            <button className="btn-secondary" onClick={submitInit} disabled={isBusy || isHydrating || !wallet?.address || isInitialized}>
              {isInitialized ? "Already Initialized" : isBusy ? "Submitting..." : isHydrating ? "Loading..." : "Initialize On-chain"}
            </button>

            {isInitialized && (
              <p className="hint-text">
                This contract already has a live poll. Deploy a new contract if you want a different question.
              </p>
            )}
          </section>

          <section className="card info-card">
            <p className="card-eyebrow info-eyebrow">Wallet Status</p>

            <div className="info-rows">
              <div className="info-row">
                <span className="info-key">Status</span>
                <span className={`info-val status-chip status-chip--${walletState}`}>{walletState}</span>
              </div>
              <div className="info-row">
                <span className="info-key">Address</span>
                <span className="info-val mono">{wallet ? shortAddress(wallet.address) : "-"}</span>
              </div>
              <div className="info-row">
                <span className="info-key">Balance</span>
                <span className="info-val">
                  {wallet?.balance !== null && wallet?.balance !== undefined ? `${wallet.balance} XLM` : wallet ? "Loading..." : "-"}
                </span>
              </div>
            </div>

            <div className="contract-block">
              <span className="info-key">Contract ID</span>
              <span className="mono contract-id">{CONTRACT_ID || "Add VITE_STELLAR_CONTRACT_ID after deployment"}</span>
            </div>

            {errorMessage && (
              <div className="error-banner">
                <span className="error-icon">!</span>
                {errorMessage}
              </div>
            )}
          </section>
        </aside>
      </main>

      <section className="activity-card">
        <div className="card-header">
          <div className="activity-heading">
            <ActivityIcon />
            <div>
              <p className="card-eyebrow">Realtime</p>
              <h2 className="card-title">Live Contract Activity</h2>
            </div>
          </div>
          <div className="live-badge">
            <span className="live-dot" />
            LIVE
          </div>
        </div>

        <div className="activity-list">
          {events.length === 0 ? (
            <div className="activity-empty">
              <span className="activity-empty-icon">O</span>
              <span>Watching for contract events from Stellar RPC...</span>
            </div>
          ) : (
            events.map((event) => (
              <div className="activity-row" key={event.id}>
                <div className="activity-row-left">
                  <div className={`activity-type-dot ${event.voter ? "dot--vote" : "dot--update"}`} />
                  <div>
                    <strong className="activity-title">{event.voter ? `Vote | ${shortAddress(event.voter)}` : "Poll Update"}</strong>
                    <span className="activity-meta mono">
                      Ledger {event.ledger} | {new Date(event.closedAt).toLocaleTimeString()}
                    </span>
                  </div>
                </div>
                <div className={`activity-choice ${event.choice === 0 ? "choice--a" : event.choice === 1 ? "choice--b" : ""}`}>
                  {event.choice === undefined ? "Refresh" : `Choice ${event.choice + 1}`}
                </div>
              </div>
            ))
          )}
        </div>
      </section>

      {walletMenuOpen && <div className="wallet-backdrop" onClick={() => setWalletMenuOpen(false)} />}
    </div>
  );
}

export default App;
