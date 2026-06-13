import { useState } from 'react';
import { getMemoryType } from '../types';
import type { MemoryIndex } from '../types';

interface BlobInspectorProps {
  selectedBlob: MemoryIndex | null;
  onNavigateToParent: (blobId: string) => void;
}

export default function BlobInspector({ selectedBlob, onNavigateToParent }: BlobInspectorProps) {
  const [isVerifying, setIsVerifying] = useState(false);
  const [isVerified, setIsVerified] = useState(false);
  const [verifyError, setVerifyError] = useState<string | null>(null);
  const [parentsExpanded, setParentsExpanded] = useState(false);



  const handleVerify = async () => {
    if (!selectedBlob) return;
    setIsVerifying(true);
    setIsVerified(false);
    setVerifyError(null);
    try {
      if (selectedBlob.is_encrypted) {
        // Skip verification for encrypted blobs because the frontend cannot decrypt SEAL 
        // to compute the original plaintext content hash without the delegate key.
        return;
      }
      
      const response = await fetch(
        `https://aggregator.walrus-testnet.walrus.space/v1/blobs/${selectedBlob.blob_id}`,
      );
      if (!response.ok) {
        setVerifyError("Blob not publicly available on Walrus (may be in private MemWal storage)");
        return;
      }
      const text = await response.text();
      const memObj = JSON.parse(text);
      const contentJson = JSON.stringify(memObj.content);
      const encoder = new TextEncoder();
      const hashBuffer = await crypto.subtle.digest("SHA-256", encoder.encode(contentJson));
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      const computedHash = hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
      setIsVerified(computedHash === selectedBlob.content_hash);
    } catch (err) {
      console.error("Blob verification failed:", err);
      setVerifyError("Verification failed: could not fetch or parse blob");
      setIsVerified(false);
    } finally {
      setIsVerifying(false);
    }
  };

  if (!selectedBlob) {
    return (
      <div className="w-[260px] h-full bg-bg-inspector border-l border-border-heavy flex flex-col p-4 text-[12px]">
        <h2 className="label pb-2 mb-4 border-b border-[#21262d]">Blob Inspector</h2>
        <div className="flex-1 flex items-center justify-center text-center">
          <span className="meta text-center leading-relaxed">Select a node to inspect its blob metadata</span>
        </div>
      </div>
    );
  }

  const typeName = getMemoryType(selectedBlob.memory_type);

  return (
    <div className="w-[260px] h-full bg-bg-inspector border-l border-border-heavy flex flex-col text-[12px] overflow-y-auto relative">
      <div className="p-4 pb-2 border-b border-border">
        <h2 className="label pb-2 border-b border-[#21262d]">Blob Inspector</h2>
      </div>

      <div className="p-4 flex flex-col gap-4">
        <section className="flex flex-col gap-2.5">
          <h3 className="label">Identity</h3>
          <div>
            <div className="meta mb-0.5">blob_id</div>
            <div className="text-accent break-all data">{selectedBlob.blob_id}</div>
          </div>
          <div className="flex items-center gap-2">
            <span className="meta">type</span>
            <span className="inline-block px-2 py-0.5 rounded-sm data capitalize" style={{
              color: `var(--color-${typeName})`,
              border: `1px solid var(--color-${typeName})`,
              backgroundColor: `color-mix(in srgb, var(--color-${typeName}) 12%, transparent)`
            }}>
              {typeName}
            </span>
          </div>
          <div>
            <div className="meta mb-0.5">agent</div>
            <div className="text-[#3fb950] data font-semibold">{selectedBlob.agent_address}</div>
          </div>
        </section>

        <section className="flex flex-col gap-2.5">
          <h3 className="label">Storage</h3>
          <div>
            <div className="meta mb-0.5">content_hash</div>
            <div className="data break-all leading-relaxed">{selectedBlob.content_hash}</div>
          </div>
          <div>
            <div className="meta mb-0.5">encrypted</div>
            {selectedBlob.is_encrypted ? (
              <span className="inline-block px-2 py-0.5 border border-[#f78166] text-[#f78166] rounded-sm bg-[#f781661a] data font-medium">
                sealed
              </span>
            ) : (
              <span className="inline-block px-2 py-0.5 border border-[#21262d] text-[#6e7681] rounded-sm data">
                public
              </span>
            )}
          </div>
          <div>
            <div className="meta mb-0.5">timestamp</div>
            <div className="data tabular-nums">
              {new Date(selectedBlob.timestamp).toISOString().replace('T', ' ').replace(/\.\d+Z$/, 'Z')}
            </div>
          </div>
        </section>

        <section className="flex flex-col gap-2.5">
          <h3 className="label">Chain</h3>
          <div>
            <div className="meta mb-0.5">on-chain idx</div>
            <div className="text-accent data">{selectedBlob.blob_id.slice(0, 16)}...</div>
          </div>
          <div>
            <div className="meta mb-0.5">parent count</div>
            <div className="data tabular-nums">{selectedBlob.parent_memories.length}</div>
          </div>
        </section>

        {selectedBlob.parent_memories.length > 0 && (
          <div>
            <div 
              role="button"
              tabIndex={0}
              className="meta mb-0.5 cursor-pointer flex justify-between items-center hover:text-[#c9d1d9] transition-colors"
              onClick={() => setParentsExpanded(!parentsExpanded)}
              onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setParentsExpanded(!parentsExpanded); }}}
              aria-expanded={parentsExpanded}
            >
              <span className="meta">parents</span>
              <span className="tabular-nums">{parentsExpanded ? '▼' : '▶'}</span>
            </div>
            {parentsExpanded && (
              <div className="pl-2 border-l border-border mt-1 overflow-hidden" style={{
                animation: 'parent-expand-in var(--duration-reveal) var(--ease-out-expo) both'
              }}>
                <div className="flex flex-col gap-1" role="list">
                  {selectedBlob.parent_memories.map(pid => (
                  <div 
                    key={pid}
                    role="listitem"
                    tabIndex={0}
                    className="cursor-pointer hover:underline transition-colors"
                    style={{ 
                      color: '#388bfd', fontSize: 11,
                      padding: '2px 0',
                      fontFamily: "'JetBrains Mono', monospace"
                    }}
                    onClick={() => onNavigateToParent(pid)}
                    onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onNavigateToParent(pid); }}}
                  >
                    → {pid.substring(0, 10)}...
                  </div>
                ))}
                </div>
              </div>
            )}
          </div>
        )}

        <div className="border-t border-[#21262d] my-2" />

        <div className="mt-2">
          <button
            onClick={handleVerify}
            disabled={isVerifying || isVerified || selectedBlob.is_encrypted}
            className={`w-full py-2 px-3 flex items-center justify-center gap-2 border rounded-sm transition-all duration-150 active:scale-[0.97] text-[12px] font-medium ${
              selectedBlob.is_encrypted
                ? 'border-[#f78166] text-[#f78166] bg-[#0f0a09] cursor-not-allowed'
                : isVerified 
                ? 'border-[#3fb950] text-[#3fb950] bg-[#0a1c0e]' 
                : isVerifying
                ? 'border-border text-muted bg-surface cursor-wait'
                : 'border-border text-[#c9d1d9] hover:bg-surface hover:border-muted'
            }`}
          >
            {isVerified && !selectedBlob.is_encrypted && <span className="w-2 h-2 rounded-full bg-[#3fb950] animate-pulse" />}
            {isVerifying ? (
              <>
                <span className="w-3 h-3 rounded-full border-2 border-muted border-t-[#c9d1d9] animate-spin" />
                Verifying...
              </>
            ) : selectedBlob.is_encrypted ? 'SEAL Encrypted (No Key)' : isVerified ? 'Hash Verified' : 'Verify Content Hash'}
          </button>
          {verifyError && (
            <p className="mt-1.5 text-[11px] text-[#f78166] leading-snug opacity-80">
              {verifyError}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
