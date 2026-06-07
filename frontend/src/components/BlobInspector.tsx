import { useState, useEffect } from 'react';
import { getMemoryType } from '../types';
import type { MemoryIndex } from '../types';

interface BlobInspectorProps {
  selectedBlob: MemoryIndex | null;
  onNavigateToParent: (blobId: string) => void;
}

export default function BlobInspector({ selectedBlob, onNavigateToParent }: BlobInspectorProps) {
  const [isVerifying, setIsVerifying] = useState(false);
  const [isVerified, setIsVerified] = useState(false);
  const [parentsExpanded, setParentsExpanded] = useState(false);

  useEffect(() => {
    setIsVerified(false);
    setParentsExpanded(false);
  }, [selectedBlob]);

  const handleVerify = async () => {
    if (!selectedBlob) return;
    setIsVerifying(true);
    // Simulate API call to Walrus to verify content hash
    await new Promise(resolve => setTimeout(resolve, 800));
    setIsVerified(true);
    setIsVerifying(false);
  };

  if (!selectedBlob) {
    return (
      <div className="w-[260px] h-full bg-bg-inspector border-l border-border-heavy flex flex-col p-4 text-[12px] text-muted">
        <h2 className="text-[#6e7681] mb-6 uppercase tracking-widest text-[11px] pb-2 border-b border-[#21262d]">Blob Inspector</h2>
        <div className="flex-1 flex items-center justify-center text-center">
          Select a node to inspect its blob metadata
        </div>
      </div>
    );
  }

  const typeName = getMemoryType(selectedBlob.memory_type);

  return (
    <div className="w-[260px] h-full bg-bg-inspector border-l border-border-heavy flex flex-col text-[12px] overflow-y-auto relative">
      <div className="p-4 pb-2 border-b border-border">
        <h2 className="text-[#6e7681] uppercase tracking-widest text-[11px] pb-2 border-b border-[#21262d]">Blob Inspector</h2>
      </div>

      <div className="p-4 flex flex-col gap-3">
        <div>
          <div className="text-muted text-[11px] mb-1">blob_id</div>
          <div className="text-accent break-all text-[12px]">{selectedBlob.blob_id}</div>
        </div>

        <div>
          <div className="text-muted text-[11px] mb-1">type</div>
          <div className="inline-block px-2 py-0.5 border border-border rounded-sm capitalize text-[12px]" style={{
            color: `var(--color-${typeName})`,
            borderColor: `var(--color-${typeName})`
          }}>
            {typeName}
          </div>
        </div>

        <div>
          <div className="text-muted text-[11px] mb-1">agent</div>
          <div className="text-[#3fb950] text-[12px]">{selectedBlob.agent_address}</div>
        </div>

        <div className="border-t border-[#21262d] my-2" />

        <div>
          <div className="text-muted text-[11px] mb-1">timestamp</div>
          <div className="text-[#c9d1d9] text-[12px]">
            {new Date(selectedBlob.timestamp).toISOString().replace('T', ' ').replace(/\.\d+Z$/, 'Z')}
          </div>
        </div>

        <div>
          <div className="text-muted text-[11px] mb-1">content_hash</div>
          <div className="text-[#c9d1d9] break-all text-[12px]">{selectedBlob.content_hash}</div>
        </div>

        <div>
          <div className="text-muted text-[11px] mb-1">parent_count</div>
          <div className="text-[#c9d1d9] text-[12px]">{selectedBlob.parent_memories.length}</div>
        </div>

        <div>
          <div className="text-muted text-[11px] mb-1">encrypted</div>
          {selectedBlob.is_encrypted ? (
            <div className="inline-block px-2 py-0.5 border border-[#f78166] text-[#f78166] rounded-sm bg-[#f781661a] text-[12px]">
              sealed
            </div>
          ) : (
            <div className="inline-block px-2 py-0.5 border border-[#21262d] text-[#6e7681] rounded-sm text-[12px]">
              public
            </div>
          )}
        </div>

        <div className="border-t border-[#21262d] my-2" />

        <div>
          <div className="text-muted text-[11px] mb-1">on-chain idx</div>
          <div className="text-accent text-[12px]">{selectedBlob.id || 'Pending...'}</div>
        </div>

        {selectedBlob.parent_memories.length > 0 && (
          <div>
            <div 
              className="text-muted text-[11px] mb-1 cursor-pointer flex justify-between items-center hover:text-[#c9d1d9] transition-colors"
              onClick={() => setParentsExpanded(!parentsExpanded)}
            >
              <span>parents</span>
              <span>{parentsExpanded ? '▼' : '▶'}</span>
            </div>
            {parentsExpanded && (
              <div className="flex flex-col gap-1 pl-2 border-l border-border mt-1">
                {selectedBlob.parent_memories.map(pid => (
                  <div 
                    key={pid} 
                    className="text-[#c9d1d9] break-all text-[12px] opacity-80 cursor-pointer hover:text-accent hover:underline"
                    onClick={() => onNavigateToParent(pid)}
                  >
                    {pid.substring(0, 10)}...
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        <div className="border-t border-[#21262d] my-2" />

        <div className="mt-2">
          <button
            onClick={handleVerify}
            disabled={isVerifying || isVerified}
            className={`w-full py-2 px-3 flex items-center justify-center gap-2 border rounded-sm transition-colors text-[12px] ${
              isVerified 
                ? 'border-[#3fb950] text-[#3fb950] bg-[#0a1c0e]' 
                : isVerifying
                ? 'border-border text-muted bg-surface cursor-wait'
                : 'border-border text-[#c9d1d9] hover:bg-surface hover:border-muted'
            }`}
          >
            {isVerified && <div className="w-2 h-2 rounded-full bg-[#3fb950] animate-pulse" />}
            {isVerifying ? (
              <>
                <div className="w-3 h-3 rounded-full border-2 border-muted border-t-[#c9d1d9] animate-spin" />
                Verifying...
              </>
            ) : isVerified ? 'Hash Verified' : 'Verify Content Hash'}
          </button>
        </div>
      </div>
    </div>
  );
}
