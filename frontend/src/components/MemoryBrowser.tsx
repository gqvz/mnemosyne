import { useState, useMemo, useEffect, useCallback } from 'react';
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
import { useMemories } from './useLiveData';
import type { MemoryType } from '../types';

export default function MemoryBrowser() {
  const [selectedBlobId, setSelectedBlobId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [viewType, setViewType] = useState<ViewType>('causal');
  const [sortOrder, setSortOrder] = useState<SortOrder>('newest');
  const [filters, setFilters] = useState<FilterState>({
    namespace: new URLSearchParams(window.location.search).get('namespace') || '',
    agents: [],
    types: ['observation', 'decision', 'artifact', 'reflection'],
    encryptedOnly: false
  });

  const { data: liveMemories = [], isLoading } = useMemories(filters.namespace);

  const handleSelect = useCallback((m: any) => {
    setSelectedBlobId(m.blob_id);
  }, []);

  useEffect(() => {
    if (liveMemories.length > 0) {
      const uniqueAgents = [...new Set(liveMemories.map(m => m.agent_address))];
      setTimeout(() => {
        setFilters(prev => ({
          ...prev,
          agents: uniqueAgents.length > 0 ? uniqueAgents : prev.agents,
        }));
      }, 0);
    }
  }, [liveMemories]);

  const handleViewChange = useCallback((view: ViewType) => {
    if (!document.startViewTransition) {
      setViewType(view);
      return;
    }
    document.startViewTransition(() => {
      setViewType(view);
    });
  }, []);

  const availableAgents = useMemo(() => {
    return [...new Set(liveMemories.map(m => m.agent_address))];
  }, [liveMemories]);

  const filteredMemories = useMemo(() => {
    return liveMemories.filter(m => {
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
  }, [liveMemories, filters, searchTerm]);

  const selectedBlob = useMemo(() => {
    return liveMemories.find(m => m.blob_id === selectedBlobId) || null;
  }, [liveMemories, selectedBlobId]);

  if (isLoading) {
    return (
      <div className="w-full h-screen bg-bg text-[#c9d1d9] font-mono flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <span className="w-4 h-4 rounded-full border-2 border-muted border-t-accent animate-spin" />
          <span className="text-muted text-sm">Loading memories...</span>
        </div>
      </div>
    );
  }

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
          onViewChange={handleViewChange} 
          sortOrder={sortOrder}
          onSortChange={setSortOrder}
        />
        
        <div className="flex-1 relative bg-bg-center" style={{ viewTransitionName: 'view-switch' }}>
          {!filters.namespace ? (
            <div className="w-full h-full flex flex-col items-center justify-center gap-2 text-center p-6 select-none font-mono">
              <span className="text-accent text-[15px] font-bold tracking-wider mb-1">MNEMOSYNE DEPLOYED</span>
              <span className="text-[#8b949e] text-[12px] max-w-md leading-relaxed">
                Connect your Sui wallet and enter a Namespace object ID in the sidebar to visualize your autonomous agent swarm's causal memories.
              </span>
            </div>
          ) : filteredMemories.length === 0 ? (
            <div className="w-full h-full flex flex-col items-center justify-center gap-2">
              <span className="data text-muted">No matching memories</span>
              <span className="meta text-center leading-relaxed px-4">Adjust filters or search term to see results</span>
            </div>
          ) : (
            <>
              {viewType === 'causal' && (
                <MemoryGraph 
                  memories={filteredMemories} 
                  selectedId={selectedBlobId} 
                  onSelect={handleSelect} 
                />
              )}
              {viewType === 'timeline' && (
                <TimelineView
                  memories={filteredMemories}
                  selectedId={selectedBlobId}
                  onSelect={handleSelect}
                />
              )}
              {viewType === 'grid' && (
                <GridView
                  memories={filteredMemories}
                  selectedId={selectedBlobId}
                  onSelect={handleSelect}
                  sortOrder={sortOrder}
                />
              )}
            </>
          )}
        </div>
        
        <LogStream logs={filteredMemories} />
      </div>

      <BlobInspector 
        key={selectedBlob?.blob_id || 'empty'}
        selectedBlob={selectedBlob} 
        onNavigateToParent={(id) => setSelectedBlobId(id)}
      />
    </div>
  );
}
