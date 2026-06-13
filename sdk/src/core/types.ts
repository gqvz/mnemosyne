import { z } from "zod";

export const MemorySchema = z.object({
  blob_id: z.string(),
  agent_id: z.string(),
  namespace_id: z.string(),
  memory_type: z.enum(["observation", "decision", "artifact", "reflection"]),
  content: z.any(),
  content_hash: z.string(),
  parent_memories: z.array(z.string()),
  depth: z.number(),
  timestamp_ms: z.number(),
  signature: z.string().optional(),
  sui_object_id: z.string().optional(),
  encrypted: z.boolean().default(false),
  seal_policy_id: z.string().optional(),
  verified: z.boolean().optional(),
  max_uses: z.number().default(0).optional(),
  use_count: z.number().default(0).optional(),
});

export type Memory = z.infer<typeof MemorySchema>;

export const MemoryTypeU8: Record<Memory["memory_type"], number> = {
  observation: 0,
  decision: 1,
  artifact: 2,
  reflection: 3,
};

export const NamespaceConfigSchema = z.object({
  namespaceId: z.string(),
  ownerAddress: z.string(),
  name: z.string(),
  suiNetwork: z.enum(["testnet", "mainnet"]).default("testnet"),
  grpcUrl: z.string().optional(),
  packageId: z.string().optional(),
});

export type NamespaceConfig = z.infer<typeof NamespaceConfigSchema>;

export const AgentConfigSchema = z.object({
  agentId: z.string(),
  privateKey: z.string(),
  role: z.enum(["scout", "strategist", "executor"]),
  namespace: NamespaceConfigSchema,
  memwalKey: z.string().optional(),
  memwalAccountId: z.string().optional(),
  memwalServerUrl: z.string().default("https://relayer.memwal.ai"),
});

export type AgentConfig = z.infer<typeof AgentConfigSchema>;

export const ObservationPayloadSchema = z.object({
  oracle: z.string(),
  svi_params: z.any(),
  implied_vol: z.number().optional(),
  source_tx: z.string().optional(),
  notes: z.string().optional(),
});

export type ObservationPayload = z.infer<typeof ObservationPayloadSchema>;

export const DecisionPayloadSchema = z.object({
  action: z.enum(["mint_predict", "skip", "supply", "redeem"]),
  strike: z.number().optional(),
  size: z.number().optional(),
  confidence: z.number(),
  rationale: z.string(),
  parent_observations: z.array(z.string()),
  target_market: z.string().optional(),
});

export type DecisionPayload = z.infer<typeof DecisionPayloadSchema>;

export const ArtifactPayloadSchema = z.object({
  tx_digest: z.string(),
  action: z.string(),
  outcome: z.string(),
  pnl: z.number().optional(),
  gas_cost: z.number().optional(),
  notes: z.string().optional(),
});

export type ArtifactPayload = z.infer<typeof ArtifactPayloadSchema>;

export const ReflectionPayloadSchema = z.object({
  summary: z.string(),
  key_learnings: z.array(z.string()),
  performance_score: z.number().min(0).max(1).optional(),
  referenced_memories: z.array(z.string()),
  notes: z.string().optional(),
});

export type ReflectionPayload = z.infer<typeof ReflectionPayloadSchema>;

export interface VerificationNode {
  memory: Memory;
  verified: boolean;
  children: VerificationNode[];
}

export interface MemoryEvent {
  memory_id: string;
  blob_id: string;
  agent_id: string;
  namespace_id: string;
  memory_type: number;
  timestamp_ms: string | number;
  max_uses?: number;
  is_shared?: boolean;
  parent_memories?: number[][];
}

export interface MemoryClaimedEvent {
  memory_id: string;
  ticket_id: string;
  claimer: string;
  use_count: number;
  max_uses: number;
  claimed_at_ms: string | number;
}
