import { useState, useMemo, useEffect } from 'react';
import Sidebar from './Sidebar';
import type { FilterState } from './Sidebar';
import TopBar from './TopBar';
import type { ViewType } from './TopBar';
import MemoryGraph from './MemoryGraph';
import TimelineView from './TimelineView';
import GridView from './GridView';
import type { SortOrder } from './GridView';
import LogStream from './LogStream';
import BlobInspector from './BlobInspector';
import type { MemoryIndex, MemoryType } from '../types';

// Mock Data Generator
const generateMockMemories = (): MemoryIndex[] => {

  const now = Date.now();
  
  return [
    {
      blob_id: '7a3f_c291',
      content_hash: 'sha256:abcd...',
      memory_type: 0,
      parent_memories: [],
      is_encrypted: false,
      agent_address: 'scout-01',
      timestamp: now - 10000,
      id: '0x123...abc'
    },
    {
      blob_id: '2c1b_f03a',
      content_hash: 'sha256:ef01...',
      memory_type: 0,
      parent_memories: [],
      is_encrypted: false,
      agent_address: 'scout-01',
      timestamp: now - 8000,
      id: '0x456...def'
    },
    {
      blob_id: 'f9d2_88d1',
      content_hash: 'sha256:2345...',
      memory_type: 0,
      parent_memories: [],
      is_encrypted: false,
      agent_address: 'scout-01',
      timestamp: now - 6000,
      id: '0x789...ghi'
    },
    {
      blob_id: 'dec_44ab',
      content_hash: 'sha256:e3b0c4_f855ad',
      memory_type: 1,
      parent_memories: ['7a3f_c291', '2c1b_f03a', 'f9d2_88d1'],
      is_encrypted: true,
      agent_address: 'strategist-01',
      timestamp: now - 4000,
      id: '0xcc22_8d77'
    },
    {
      blob_id: 'art_9c7e',
      content_hash: 'sha256:9999...',
      memory_type: 2,
      parent_memories: ['dec_44ab'],
      is_encrypted: false,
      agent_address: 'executor-01',
      timestamp: now - 2000,
      id: '0xddd...eee'
    },
    {
      blob_id: 'ref_01bb',
      content_hash: 'sha256:1111...',
      memory_type: 3,
      parent_memories: ['art_9c7e'],
      is_encrypted: false,
      agent_address: 'strategist-01',
      timestamp: now,
      id: '0xfff...000'
    }
  ];
};

export default function MemoryBrowser() {
  const [memories, setMemories] = useState<MemoryIndex[]>([]);
  const [selectedBlobId, setSelectedBlobId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [viewType, setViewType] = useState<ViewType>('causal');
  const [sortOrder, setSortOrder] = useState<SortOrder>('newest');
  const [filters, setFilters] = useState<FilterState>({
    namespace: 'alpha-swarm-7',
    agents: ['scout-01', 'strategist-01', 'executor-01'],
    types: ['observation', 'decision', 'artifact', 'reflection'],
    encryptedOnly: false
  });

  useEffect(() => {
    setMemories(generateMockMemories());
    // In a real app, this is where we would call MnemosyneClient
    // client.listMemories(filters.namespace).then(setMemories)
  }, []);

  const availableAgents = ['scout-01', 'strategist-01', 'executor-01'];

  const filteredMemories = useMemo(() => {
    return memories.filter(m => {
      const typeStr = ['observation', 'decision', 'artifact', 'reflection'][m.memory_type] as MemoryType;
      
      if (!filters.agents.includes(m.agent_address)) return false;
      if (!filters.types.includes(typeStr)) return false;
      if (filters.encryptedOnly && !m.is_encrypted) return false;
      
      if (searchTerm) {
        const term = searchTerm.toLowerCase();
        if (!m.blob_id.toLowerCase().includes(term) && !m.agent_address.toLowerCase().includes(term)) {
          return false;
        }
      }
      return true;
    });
  }, [memories, filters, searchTerm]);

  const selectedBlob = useMemo(() => {
    return memories.find(m => m.blob_id === selectedBlobId) || null;
  }, [memories, selectedBlobId]);

  return (
    <div className="w-full h-screen bg-bg text-[#c9d1d9] font-mono flex overflow-hidden">
      <Sidebar 
        filters={filters} 
        onFilterChange={setFilters} 
        availableAgents={availableAgents} 
      />
      
      <div className="flex-1 flex flex-col min-w-0">
        <TopBar 
          searchTerm={searchTerm} 
          onSearchChange={setSearchTerm} 
          viewType={viewType} 
          onViewChange={setViewType} 
          sortOrder={sortOrder}
          onSortChange={setSortOrder}
        />
        
        <div className="flex-1 relative bg-bg-center">
          {viewType === 'causal' && (
            <MemoryGraph 
              memories={filteredMemories} 
              selectedId={selectedBlobId} 
              onSelect={(m) => setSelectedBlobId(m.blob_id)} 
            />
          )}
          {viewType === 'timeline' && (
            <TimelineView
              memories={filteredMemories}
              selectedId={selectedBlobId}
              onSelect={(m) => setSelectedBlobId(m.blob_id)}
            />
          )}
          {viewType === 'grid' && (
            <GridView
              memories={filteredMemories}
              selectedId={selectedBlobId}
              onSelect={(m) => setSelectedBlobId(m.blob_id)}
              sortOrder={sortOrder}
            />
          )}
        </div>
        
        <LogStream logs={filteredMemories} />
      </div>

      <BlobInspector 
        selectedBlob={selectedBlob} 
        onNavigateToParent={(id) => setSelectedBlobId(id)}
      />
    </div>
  );
}
