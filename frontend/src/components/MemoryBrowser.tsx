import { useState, useMemo, useEffect, useCallback } from 'react';
import { Play, Pause, ChevronLeft, ChevronRight, RotateCcw } from 'lucide-react';
import { useParams, useNavigate } from 'react-router-dom';
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

type HighlightMode = 'parents' | 'children' | 'both';

function getHighlightedNodes(memories: any[], selectedId: string | null, mode: HighlightMode = 'both'): Set<string> {
  const highlighted = new Set<string>();
  if (!selectedId) return highlighted;

  highlighted.add(selectedId);

  // Map to find parents quickly: memory.blob_id -> parent_memories[]
  const parentMap = new Map<string, string[]>();
  // Map to find children quickly: parent_blob_id -> child_blob_ids[]
  const childrenMap = new Map<string, string[]>();

  for (const m of memories) {
    parentMap.set(m.blob_id, m.parent_memories || []);
    for (const pid of m.parent_memories || []) {
      if (!childrenMap.has(pid)) {
        childrenMap.set(pid, []);
      }
      childrenMap.get(pid)!.push(m.blob_id);
    }
  }

  // Helper to recursively add parents (ancestors)
  const addParents = (id: string) => {
    const parents = parentMap.get(id) || [];
    for (const pid of parents) {
      if (!highlighted.has(pid)) {
        highlighted.add(pid);
        addParents(pid);
      }
    }
  };

  // Helper to recursively add children (descendants)
  const addChildren = (id: string) => {
    const children = childrenMap.get(id) || [];
    for (const cid of children) {
      if (!highlighted.has(cid)) {
        highlighted.add(cid);
        addChildren(cid);
      }
    }
  };

  if (mode === 'parents' || mode === 'both') addParents(selectedId);
  if (mode === 'children' || mode === 'both') addChildren(selectedId);

  return highlighted;
}

export default function MemoryBrowser() {
  const { namespaceId } = useParams();
  const navigate = useNavigate();
  const [selectedBlobId, setSelectedBlobId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [viewType, setViewType] = useState<ViewType>('causal');
  const [sortOrder, setSortOrder] = useState<SortOrder>('newest');
  const [filters, setFilters] = useState<FilterState>({
    namespace: namespaceId || '',
    agents: [],
    types: ['observation', 'decision', 'artifact', 'reflection'],
    encryptedOnly: false
  });

  // Sync namespace changes to the URL
  useEffect(() => {
    if (filters.namespace && filters.namespace !== namespaceId) {
      navigate(`/browser/${filters.namespace}`, { replace: true });
    } else if (!filters.namespace && namespaceId) {
      navigate('/browser', { replace: true });
    }
  }, [filters.namespace, namespaceId, navigate]);

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

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setSelectedBlobId(null);
        setCurrentReplayIndex(-1);
        setIsPlaying(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

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

  const [currentReplayIndex, setCurrentReplayIndex] = useState<number>(-1);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [highlightParents, setHighlightParents] = useState(true);
  const [highlightChildren, setHighlightChildren] = useState(true);

  const highlightMode: HighlightMode =
    highlightParents && highlightChildren ? 'both' :
    highlightParents ? 'parents' : 'children';

  const highlightedIds = useMemo(() => {
    return getHighlightedNodes(liveMemories, selectedBlobId, highlightMode);
  }, [liveMemories, selectedBlobId, highlightMode]);

  const sortedHighlightedNodes = useMemo(() => {
    if (!selectedBlobId) return [];
    const highlighted = getHighlightedNodes(liveMemories, selectedBlobId, highlightMode);
    return Array.from(highlighted)
      .map(id => liveMemories.find(m => m.blob_id === id))
      .filter((n): n is NonNullable<typeof n> => !!n)
      .sort((a, b) => a.timestamp - b.timestamp);
  }, [selectedBlobId, liveMemories, highlightMode]);

  const replayIds = useMemo(() => {
    if (currentReplayIndex === -1 || sortedHighlightedNodes.length === 0) {
      return new Set<string>();
    }
    return new Set(
      sortedHighlightedNodes.slice(0, currentReplayIndex + 1).map(n => n.blob_id)
    );
  }, [currentReplayIndex, sortedHighlightedNodes]);

  useEffect(() => {
    if (!isPlaying) return;
    if (currentReplayIndex >= sortedHighlightedNodes.length - 1) {
      setIsPlaying(false);
      return;
    }

    const interval = setInterval(() => {
      setCurrentReplayIndex(prev => {
        if (prev >= sortedHighlightedNodes.length - 1) {
          setIsPlaying(false);
          return prev;
        }
        return prev + 1;
      });
    }, 600);

    return () => clearInterval(interval);
  }, [isPlaying, currentReplayIndex, sortedHighlightedNodes.length]);

  useEffect(() => {
    if (selectedBlobId && sortedHighlightedNodes.length > 0) {
      setCurrentReplayIndex(sortedHighlightedNodes.length - 1);
      setIsPlaying(false);
    } else {
      setCurrentReplayIndex(-1);
      setIsPlaying(false);
    }
  }, [selectedBlobId, sortedHighlightedNodes.length]);

  const handlePlayPause = useCallback(() => {
    if (isPlaying) {
      setIsPlaying(false);
    } else {
      if (currentReplayIndex >= sortedHighlightedNodes.length - 1) {
        setCurrentReplayIndex(0);
      }
      setIsPlaying(true);
    }
  }, [isPlaying, currentReplayIndex, sortedHighlightedNodes.length]);

  const handlePrev = useCallback(() => {
    setIsPlaying(false);
    setCurrentReplayIndex(prev => Math.max(0, prev - 1));
  }, []);

  const handleNext = useCallback(() => {
    setIsPlaying(false);
    setCurrentReplayIndex(prev => Math.min(sortedHighlightedNodes.length - 1, prev + 1));
  }, [sortedHighlightedNodes.length]);

  const handleRestart = useCallback(() => {
    setIsPlaying(false);
    setCurrentReplayIndex(0);
  }, []);

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
        
        <div className="flex-1 min-h-0 relative bg-bg-center" style={{ viewTransitionName: 'view-switch' }}>
          {selectedBlobId && sortedHighlightedNodes.length > 0 && (
            <div className="absolute top-4 left-1/2 -translate-x-1/2 z-[50] flex flex-col items-center bg-[#0d1117]/90 backdrop-blur-md border border-[#30363d] rounded-full shadow-2xl text-[12px] font-mono select-none overflow-hidden" style={{
              animation: 'reveal-in 0.25s cubic-bezier(0.16, 1, 0.3, 1) both',
              boxShadow: '0 8px 32px 0 rgba(0, 0, 0, 0.5), 0 0 0 1px rgba(255, 255, 255, 0.05)'
            }}>
              <div className="flex items-center gap-3 px-4 py-1.5">
                <span className="text-[#8b949e] font-semibold tracking-wider text-[9px] uppercase mr-1">Replay</span>
                
                <button 
                  onClick={handleRestart}
                  className="text-[#c9d1d9] hover:text-white transition-colors cursor-pointer flex items-center justify-center p-1.5 hover:bg-[#21262d] rounded-full active:scale-90 duration-100"
                  title="Restart (Go to Step 1)"
                  aria-label="Restart replay"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                </button>

                <button 
                  onClick={handlePrev}
                  disabled={currentReplayIndex <= 0}
                  className="text-[#c9d1d9] hover:text-white disabled:text-[#484f58] transition-colors cursor-pointer flex items-center justify-center p-1.5 hover:bg-[#21262d] rounded-full active:scale-90 duration-100 disabled:hover:bg-transparent disabled:opacity-50"
                  title="Step Backward"
                  aria-label="Previous step"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>

                <button 
                  onClick={handlePlayPause}
                  className={`flex items-center justify-center w-8 h-8 rounded-full transition-all cursor-pointer active:scale-95 duration-100 shadow-sm ${
                    isPlaying 
                      ? 'bg-[#2ea043] hover:bg-[#3fb950] text-white animate-pulse' 
                      : 'bg-accent hover:bg-opacity-90 text-white'
                  }`}
                  title={isPlaying ? 'Pause Autoplay' : 'Play Autoplay'}
                  aria-label={isPlaying ? 'Pause' : 'Play'}
                >
                  {isPlaying ? <Pause className="w-4 h-4 fill-white" /> : <Play className="w-4 h-4 fill-white ml-0.5" />}
                </button>

                <button 
                  onClick={handleNext}
                  disabled={currentReplayIndex >= sortedHighlightedNodes.length - 1}
                  className="text-[#c9d1d9] hover:text-white disabled:text-[#484f58] transition-colors cursor-pointer flex items-center justify-center p-1.5 hover:bg-[#21262d] rounded-full active:scale-90 duration-100 disabled:hover:bg-transparent disabled:opacity-50"
                  title="Step Forward"
                  aria-label="Next step"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>

                <span className="text-[#8b949e] tabular-nums pl-2.5 border-l border-[#30363d] ml-1 select-none font-medium">
                  {currentReplayIndex + 1} / {sortedHighlightedNodes.length}
                </span>

                <span className="w-px h-4 bg-[#30363d] mx-1" />

                <button
                  onClick={() => setHighlightParents(p => !p)}
                  className={`text-[10px] px-2 py-0.5 rounded-sm font-semibold tracking-wider transition-colors cursor-pointer ${
                    highlightParents ? 'text-[#58a6ff] bg-[#58a6ff]/10' : 'text-[#484f58] hover:text-[#8b949e]'
                  }`}
                  title="Toggle ancestor highlighting"
                >
                  PARENTS
                </button>
                <button
                  onClick={() => setHighlightChildren(c => !c)}
                  className={`text-[10px] px-2 py-0.5 rounded-sm font-semibold tracking-wider transition-colors cursor-pointer ${
                    highlightChildren ? 'text-[#f78166] bg-[#f78166]/10' : 'text-[#484f58] hover:text-[#8b949e]'
                  }`}
                  title="Toggle descendant highlighting"
                >
                  CHILDREN
                </button>
              </div>
              
              {/* Progress Line */}
              <div className="w-full h-[2px] bg-[#21262d] relative overflow-hidden">
                <div 
                  className="bg-accent h-full transition-all duration-300 ease-out shadow-[0_0_8px_var(--color-accent)]"
                  style={{ 
                    width: `${((currentReplayIndex + 1) / sortedHighlightedNodes.length) * 100}%` 
                  }}
                />
              </div>
            </div>
          )}
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
                  highlightedIds={highlightedIds}
                  replayIds={replayIds}
                  onSelect={handleSelect} 
                />
              )}
              {viewType === 'timeline' && (
                <TimelineView
                  memories={filteredMemories}
                  selectedId={selectedBlobId}
                  highlightedIds={highlightedIds}
                  replayIds={replayIds}
                  onSelect={handleSelect}
                />
              )}
              {viewType === 'grid' && (
                <GridView
                  memories={filteredMemories}
                  selectedId={selectedBlobId}
                  highlightedIds={highlightedIds}
                  replayIds={replayIds}
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
        namespaceId={filters.namespace}
      />
    </div>
  );
}
