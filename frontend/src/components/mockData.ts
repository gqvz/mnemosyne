export interface DisplayMemory {
  id: string;
  blobId: string;
  agentId: string;
  agentName: string;
  memoryType: "observation" | "decision" | "artifact" | "reflection";
  content: Record<string, unknown>;
  parentIds: string[];
  timestampMs: number;
  verified: boolean;
  txDigest?: string;
}

const MOCK_MEMORIES: DisplayMemory[] = [
  {
    id: "mem-1",
    blobId: "0xabc111...",
    agentId: "0xSCOUT01",
    agentName: "Scout Agent",
    memoryType: "observation",
    content: {
      oracle: "BTC-SVI",
      svi_params: { a: 0.04, b: 0.5, rho: -0.2, m: 0.01, sigma: 0.3 },
      implied_vol: 45,
      source_tx: "0xff123...",
    },
    parentIds: [],
    timestampMs: Date.now() - 360000,
    verified: true,
    txDigest: "0xff123...",
  },
  {
    id: "mem-2",
    blobId: "0xdef222...",
    agentId: "0xSCOUT01",
    agentName: "Scout Agent",
    memoryType: "observation",
    content: {
      oracle: "BTC-PM",
      market: "BTC-up-60k",
      polymarket_price: 72,
      equiv_iv: 38,
    },
    parentIds: [],
    timestampMs: Date.now() - 330000,
    verified: true,
    txDigest: "0xff456...",
  },
  {
    id: "mem-3",
    blobId: "0xghi333...",
    agentId: "0xSTRAT01",
    agentName: "Strategist Agent",
    memoryType: "decision",
    content: {
      action: "mint_predict",
      strike: 68000,
      size: 100,
      confidence: 0.85,
      rationale: "Vol spread 7% exceeds threshold of 3%. MINT on Predict.",
    },
    parentIds: ["mem-1", "mem-2"],
    timestampMs: Date.now() - 300000,
    verified: true,
    txDigest: "0xff789...",
  },
  {
    id: "mem-4",
    blobId: "0xjkl444...",
    agentId: "0xEXEC01",
    agentName: "Executor Agent",
    memoryType: "artifact",
    content: {
      tx_digest: "0xtx-exec-01",
      action: "Mint 100 BTC binaries",
      outcome: "SUCCESS",
      pnl: 0,
      gas_cost: 0.003,
    },
    parentIds: ["mem-3"],
    timestampMs: Date.now() - 270000,
    verified: true,
    txDigest: "0xtx-exec-01",
  },
  {
    id: "mem-5",
    blobId: "0xmno555...",
    agentId: "0xSCOUT01",
    agentName: "Scout Agent",
    memoryType: "observation",
    content: {
      oracle: "BTC-SVI",
      svi_params: { a: 0.035, b: 0.48, rho: -0.18, m: 0.01, sigma: 0.28 },
      implied_vol: 42,
    },
    parentIds: [],
    timestampMs: Date.now() - 180000,
    verified: true,
    txDigest: "0xff999...",
  },
  {
    id: "mem-6",
    blobId: "0xpqr666...",
    agentId: "0xSTRAT01",
    agentName: "Strategist Agent",
    memoryType: "decision",
    content: {
      action: "skip",
      confidence: 0.45,
      rationale: "Spread narrowed to 1%. Hold position.",
    },
    parentIds: ["mem-5"],
    timestampMs: Date.now() - 150000,
    verified: true,
    txDigest: "0xffbbb...",
  },
];

export function getMockMemories(): DisplayMemory[] {
  return MOCK_MEMORIES;
}

export const MEMORY_TYPE_COLORS: Record<string, string> = {
  observation: "#fbbf24",
  decision: "#4da6ff",
  artifact: "#34d399",
  reflection: "#a855f7",
};

export const MEMORY_TYPE_LABELS: Record<string, string> = {
  observation: "Observation",
  decision: "Decision",
  artifact: "Artifact",
  reflection: "Reflection",
};

export function getMemoryDisplay(memoryType: string): { color: string; label: string } {
  return {
    color: MEMORY_TYPE_COLORS[memoryType] || "#8888a0",
    label: MEMORY_TYPE_LABELS[memoryType] || memoryType,
  };
}
