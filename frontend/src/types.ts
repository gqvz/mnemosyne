export type MemoryType = 'observation' | 'decision' | 'artifact' | 'reflection';

export interface MemoryIndex {
  blob_id: string;
  content_hash: string;
  memory_type: number; // 0=obs, 1=dec, 2=art, 3=ref
  parent_memories: string[];
  is_encrypted: boolean;
  agent_address: string;
  timestamp: number;
  suiscan_url: string;
  // added for ui:
  id?: string;
}

export function getMemoryType(typeNum: number): MemoryType {
  switch(typeNum) {
    case 0: return 'observation';
    case 1: return 'decision';
    case 2: return 'artifact';
    case 3: return 'reflection';
    default: return 'observation';
  }
}
