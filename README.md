# mnemosyne
<img width="688" height="360" alt="readme" src="https://github.com/user-attachments/assets/7bba0fab-84f6-4586-9bc4-e82e4243bd41" />

built for sui overflow 2026. persistent memory layer for agent swarms on sui.

agents write observations, decisions, artifacts to walrus. each blob has a sha256 content hash, a sui clock timestamp, and links back to parent memories. a move `MemoryIndex` object on-chain points to each blob. any agent in the namespace can read, verify, and build on top of past work.

no more blank slates on restart. no more siloed agent state. full verifiable audit trail from artifact back to root observation.

## what it does

- agents write structured blobs to walrus (content-addressed storage)
- memory index registered on sui testnet - hash, timestamp, type
- agents read each other's memories from shared namespace
- verify blob integrity: recompute sha256, compare against on-chain hash
- replay causal chain: walk parent links from artifact back to observation

## why

- agent restart = memory wipe. walrus blobs persist.
- agent a can't read agent b's state. shared namespace fixes it.
- no proof of what agent knew. content hash + clock timestamp = cryptographic proof.
- memory trapped in provider. decentralized, user-owned.

## how

```
┌─────────────────────────────┐
│   shared walrus namespace   │
│  obs → dec → art → ref     │
│  (content-addressed blobs)  │
└──────────┬──────────────────┘
           │ write/read
┌──────────▼──────────────────┐
│  sui move memoryindex       │
│  - sha256(content_hash)     │
│  - sui clock timestamp      │
│  - parent_memories chain    │
│  - agent_id                 │
│  - memory_type              │
│  - is_encrypted             │
└─────────────────────────────┘
```

## build

```bash
# install deps
cd sdk && npm install
cd ../frontend && npm install
cd ../mnemosyne_contracts && sui move build

# deploy contracts
sui client publish --gas-budget 100000000

# set env vars
export MEMWAL_PRIVATE_KEY=...
export MEMWAL_ACCOUNT_ID=...
export SUI_NETWORK=testnet

# run
cd frontend && npm run dev
```

## run

```bash
cd frontend
cp ../trading_poc/.env.example ../trading_poc/.env  # fill in keys
npm run dev
# opens on http://localhost:5174
```

enter a namespace id in the sidebar. nodes appear. click one to inspect, verify, replay.

## structure

```
mnemosyne/
├── frontend/              # react app (memory browser)
│   ├── src/
│   │   ├── components/    # graph, timeline, grid, inspector
│   │   └── pages/         # landing, docs
│   └── vite.config.ts     # dev server + api middleware
├── sdk/                   # typescript sdk
│   └── src/
│       ├── agents/        # scout, strategist, executor
│       ├── core/          # client, memory, walrus, types, replay
│       └── e2e.ts         # end-to-end test
├── mnemosyne_contracts/   # sui move contracts
│   └── sources/
│       └── memory.move    # namespace, memoryindex, registration
└── trading_poc/           # poc: trading agent swarm
    └── src/
        └── index.ts       # multi-agent demo
```

## contracts

deployed on sui testnet. package id:

```
0x0c3727c0cded915935aa978cc3435b5d5a57f7015153ba4d3b75044ca4277fde
```

| function | description |
|----------|-------------|
| `create_namespace` | create shared namespace for agent swarm |
| `register_agent` | register agent address with role |
| `write_memory` | write memoryindex pointing to walrus blob |
| `write_memory_shared` | write shared (anyone can read) memoryindex |

## security

- content hash on-chain. tamper detectable.
- sui clock timestamp. can't backdate.
- seal encryption for sensitive decisions.
- namespace owner gates agent registration.

## license

mit
