import { useState, useEffect } from 'react';
import { getMemoryType } from '../types';
import type { MemoryIndex } from '../types';

interface BlobInspectorProps {
  selectedBlob: MemoryIndex | null;
  onNavigateToParent: (blobId: string) => void;
}

export default function BlobInspector({ selectedBlob, onNavigateToParent }: BlobInspectorProps) {
  const [parentsExpanded, setParentsExpanded] = useState(false);
  const [blobContent, setBlobContent] = useState<string | null>(null);
  const [loadingContent, setLoadingContent] = useState(false);
  const [contentError, setContentError] = useState<string | null>(null);
  const [isEncrypted, setIsEncrypted] = useState(false);
  const [decrypting, setDecrypting] = useState(false);
  const [decryptedText, setDecryptedText] = useState<string | null>(null);
  const [decryptError, setDecryptError] = useState<string | null>(null);

  const namespaceId = new URLSearchParams(window.location.search).get('namespace') || '';

  useEffect(() => {
    if (!selectedBlob) {
      setBlobContent(null);
      setIsEncrypted(false);
      setDecryptedText(null);
      setDecryptError(null);
      return;
    }
    setLoadingContent(true);
    setContentError(null);
    setBlobContent(null);
    setIsEncrypted(selectedBlob.is_encrypted);
    setDecryptedText(null);
    setDecryptError(null);

    if (selectedBlob.is_encrypted) {
      setLoadingContent(false);
      return;
    }

    fetch(`http://localhost:3001/api/memory/${namespaceId}/${selectedBlob.blob_id}`)
      .then(res => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      })
      .then(data => {
        try {
          const parsed = JSON.parse(data.text);
          setBlobContent(JSON.stringify(parsed.content || parsed, null, 2));
        } catch {
          setBlobContent(data.text);
        }
      })
      .catch(err => {
        setContentError(err.message || String(err));
      })
      .finally(() => {
        setLoadingContent(false);
      });
  }, [selectedBlob, namespaceId]);

  const handleDecrypt = async () => {
    if (!selectedBlob) return;
    setDecrypting(true);
    setDecryptError(null);
    try {
      const res = await fetch(`http://localhost:3001/api/memory/${namespaceId}/${selectedBlob.blob_id}`);
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || `HTTP ${res.status}`);
      }
      const data = await res.json();
      try {
        const parsed = JSON.parse(data.text);
        setDecryptedText(JSON.stringify(parsed.content || parsed, null, 2));
      } catch {
        setDecryptedText(data.text);
      }
    } catch (err: any) {
      setDecryptError(err.message || String(err));
    } finally {
      setDecrypting(false);
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
            <span className={`inline-block px-2 py-0.5 border rounded-sm bg-opacity-10 data font-medium ${isEncrypted ? 'border-[#f78166] text-[#f78166] bg-[#f781661a]' : 'border-[#3fb950] text-[#3fb950] bg-[#3fb9501a]'}`}>
              {isEncrypted ? 'encrypted' : 'plaintext'}
            </span>
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


        <section className="flex flex-col gap-2 mt-4 pt-4 border-t border-[#21262d]">
          <h3 className="label">Memory Content</h3>
          {isEncrypted ? (
            <div className="flex flex-col gap-2">
              <span className="text-[#8b949e] italic" style={{ fontSize: 10 }}>This memory is encrypted with SEAL.</span>
              {decryptedText ? (
                <pre className="bg-[#0d1117] p-2 rounded border border-[#30363d] text-[10px] overflow-x-auto text-[#c9d1d9] max-h-[200px]" style={{ fontFamily: "'JetBrains Mono', monospace" }}>
                  {decryptedText}
                </pre>
              ) : (
                <button
                  onClick={handleDecrypt}
                  disabled={decrypting}
                  className="px-2 py-1 text-white rounded font-mono text-[11px]"
                  style={{
                    backgroundColor: 'var(--color-decision)',
                    border: '1px solid var(--border)',
                    cursor: 'pointer',
                    borderRadius: 3,
                    padding: '4px 8px'
                  }}
                >
                  {decrypting ? 'Decrypting...' : 'Request Decrypt Access'}
                </button>
              )}
              {decryptError && (
                <span className="text-[#f78166] text-[10px] break-all">{decryptError}</span>
              )}
            </div>
          ) : (
            <div>
              {loadingContent ? (
                <span className="text-muted">Loading content...</span>
              ) : contentError ? (
                <span className="text-danger">Error: {contentError}</span>
              ) : (
                <pre className="bg-[#0d1117] p-2 rounded border border-[#30363d] text-[10px] overflow-x-auto text-[#c9d1d9] max-h-[200px]" style={{ fontFamily: "'JetBrains Mono', monospace" }}>
                  {blobContent || 'No content found'}
                </pre>
              )}
            </div>
          )}
        </section>

      </div>
    </div>
  );
}
