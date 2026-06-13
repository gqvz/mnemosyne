# Mnemosyne Trading PoC

> Thread-safe multi-agent trading simulation on Sui + Walrus.

This example demonstrates the full Mnemosyne agent pipeline:

```
Scout (writes shared observations)
  └─► Strategist (claims observations, writes decisions)
        └─► Executor (claims decisions, writes artifacts)
```

Every hand-off is **atomically enforced on-chain** using `claim_memory`. The Sui sequencer guarantees that competing agents cannot exceed the `max_uses` slot limit — no race conditions, no double-execution.

## Quick Start

```bash
# 1. Copy env template and fill in your keys
cp .env.example .env

# 2. Install dependencies
npm install

# 3. Run the PoC
npm run dev
```

## What it Demonstrates

| Feature | How |
|---|---|
| **Unique agent keys** | `Ed25519Keypair.generate()` per agent |
| **Batch funding** | Single PTB splits & transfers SUI to all agents |
| **Thread-safe claims** | `claim_memory` on a shared `MemoryIndex`; `EMemoryExhausted` on overflow |
| **Content dedup** | `write_memory_deduped` — duplicate hashes abort atomically |
| **SEAL encryption** | All blobs encrypted by MemWal relayer before Walrus storage |
| **Causal graph** | `parent_observations` / `parent_decisions` link memory objects |
| **On-chain audit** | `MemoryClaimed` events logged on Sui for full replay |

## Environment Variables

See [`.env.example`](.env.example) for the full list.

| Variable | Required | Description |
|---|---|---|
| `SUI_PRIVATE_KEY` | ✓ | Master wallet private key |
| `MNEMOSYNE_PACKAGE_ID` | ✓ | Deployed contract package ID |
| `MEMWAL_ACCOUNT_ID` | ✓ | MemWal account ID |
| `MEMWAL_PRIVATE_KEY` | ✓ | MemWal private key |
| `SUI_NETWORK` | — | `testnet` (default) or `mainnet` |
| `SUI_RPC_URL` | — | Custom Sui RPC endpoint |
| `MEMWAL_SERVER_URL` | — | Custom MemWal relayer URL |

## Output Example

```
=========================================================
   Mnemosyne Thread-Safe Multi-Agent Trading Simulation
=========================================================

[Master] Address: 0xabc...
[Master] Balance: 1.5 SUI
[Namespace] Created: 0xdef...

--- 5. Triggering Scout Observation (max_uses: 2) ---
  1 shared observation with 2 claim slots — 4 strategists competing.

=========================================================
         ON-CHAIN THREAD-SAFETY AUDIT REPORT
=========================================================
MemoryClaimed events found: 2

Memory: 0x123...
  max_uses: 2
  Claims:   2
    [1] claimer=0xstrat1...  slot=1/2
    [2] claimer=0xstrat2...  slot=2/2
  [✓] ENFORCED — Sui sequencer prevented over-claiming.
```
