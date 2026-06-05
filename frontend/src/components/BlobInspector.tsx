import type { DisplayMemory } from "./mockData";
import { getMemoryDisplay } from "./mockData";
import { X, ExternalLink, ShieldCheck, ShieldAlert } from "lucide-react";

interface Props {
  memory: DisplayMemory;
  onClose: () => void;
}

export function BlobInspector({ memory, onClose }: Props) {
  const { color, label } = getMemoryDisplay(memory.memoryType);
  const shortContent = JSON.stringify(memory.content, null, 2);

  return (
    <div style={styles.overlay}>
      <div style={styles.panel} className="blob-inspector-panel">
        <div style={styles.header}>
          <div style={styles.headerLeft}>
            <span style={{ ...styles.headerDot, background: color }} />
            <span style={styles.headerType}>{label}</span>
            <span style={styles.headerId}>{memory.id}</span>
          </div>
          <button onClick={onClose} style={styles.closeBtn} className="close-btn" aria-label="Close inspector">
            <X size={16} color="#8888a0" />
          </button>
        </div>

        <div style={styles.body}>
          <div style={styles.fieldRow}>
            <span style={styles.fieldLabel}>Blob ID</span>
            <span style={styles.fieldValueMono}>{memory.blobId}</span>
          </div>

          <div style={styles.fieldRow}>
            <span style={styles.fieldLabel}>Agent</span>
            <span style={styles.fieldValue}>{memory.agentName}</span>
            <span style={styles.fieldValueMono}>{memory.agentId}</span>
          </div>

          <div style={styles.fieldRow}>
            <span style={styles.fieldLabel}>Timestamp</span>
            <span style={styles.fieldValue}>
              {new Date(memory.timestampMs).toLocaleString()}
            </span>
          </div>

          {memory.txDigest && (
            <div style={styles.fieldRow}>
              <span style={styles.fieldLabel}>Tx Digest</span>
              <span style={styles.fieldValueMono}>{memory.txDigest}</span>
              <ExternalLink size={12} color="#4da6ff" />
            </div>
          )}

          <div style={styles.verificationRow}>
            {memory.verified ? (
              <>
                <ShieldCheck size={14} color="#34d399" />
                <span style={styles.verifiedText}>Walrus Proof Verified</span>
              </>
            ) : (
              <>
                <ShieldAlert size={14} color="#fbbf24" />
                <span style={styles.unverifiedText}>Not Verified</span>
              </>
            )}
          </div>

          {memory.parentIds.length > 0 && (
            <div style={styles.section}>
              <span style={styles.sectionTitle}>Parent Memories</span>
              <div style={styles.parentList}>
                {memory.parentIds.map((pId) => (
                  <span key={pId} style={styles.parentBadge}>
                    {pId}
                  </span>
                ))}
              </div>
            </div>
          )}

          <div style={styles.section}>
            <span style={styles.sectionTitle}>Content</span>
            <pre style={styles.contentBlock}>{shortContent}</pre>
          </div>
        </div>
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  overlay: {
    position: "fixed",
    bottom: 0,
    left: 0,
    right: 0,
    zIndex: 100,
    display: "flex",
    justifyContent: "center",
    pointerEvents: "none",
  },
  panel: {
    pointerEvents: "auto",
    width: "100%",
    maxWidth: "100%",
    maxHeight: "45vh",
    background: "var(--bg-card)",
    borderTop: "2px solid var(--border)",
    display: "flex",
    flexDirection: "column",
    overflow: "hidden",
    animation: "slideUp 0.2s ease-out",
  },
  header: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: "10px 20px",
    borderBottom: "1px solid var(--border)",
  },
  headerLeft: {
    display: "flex",
    alignItems: "center",
    gap: 10,
  },
  headerDot: {
    width: 10,
    height: 10,
    borderRadius: "50%",
  },
  headerType: {
    fontSize: "var(--text-base)",
    fontWeight: 600,
    color: "var(--text-primary)",
    lineHeight: "var(--leading-tight)",
  },
  headerId: {
    fontSize: "var(--text-xs)",
    color: "var(--text-muted)",
    fontFamily: "'JetBrains Mono', monospace",
    fontVariantNumeric: "tabular-nums",
  },
  closeBtn: {
    padding: 12,
    borderRadius: 8,
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    minWidth: 44,
    minHeight: 44,
  },
  body: {
    flex: 1,
    overflowY: "auto",
    padding: "16px 20px",
    display: "flex",
    flexDirection: "column",
    gap: 10,
  },
  fieldRow: {
    display: "flex",
    alignItems: "center",
    gap: 12,
    fontSize: 12,
  },
  fieldLabel: {
    fontSize: "var(--text-xs)",
    color: "var(--text-muted)",
    minWidth: 90,
    fontWeight: 600,
  },
  fieldValue: {
    fontSize: "var(--text-sm)",
    color: "var(--text-primary)",
    fontWeight: 500,
  },
  fieldValueMono: {
    fontSize: "var(--text-xs)",
    color: "var(--text-secondary)",
    fontFamily: "'JetBrains Mono', monospace",
    fontVariantNumeric: "tabular-nums",
  },
  verificationRow: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    padding: "8px 12px",
    background: "rgba(52, 211, 153, 0.08)",
    borderRadius: 6,
    marginTop: 4,
  },
  verifiedText: {
    fontSize: 12,
    fontWeight: 500,
    color: "var(--accent-green)",
  },
  unverifiedText: {
    fontSize: 12,
    fontWeight: 500,
    color: "var(--accent-amber)",
  },
  section: {
    marginTop: 8,
  },
  sectionTitle: {
    fontSize: "var(--text-xs)",
    fontWeight: 600,
    color: "var(--text-muted)",
    textTransform: "uppercase",
    letterSpacing: "var(--tracking-wide)",
    marginBottom: 6,
    display: "block",
  },
  parentList: {
    display: "flex",
    flexWrap: "wrap",
    gap: 6,
  },
  parentBadge: {
    padding: "3px 8px",
    background: "var(--bg-secondary)",
    borderRadius: 4,
    fontSize: 10,
    fontFamily: "'JetBrains Mono', monospace",
    color: "var(--text-muted)",
  },
  contentBlock: {
    background: "var(--bg-secondary)",
    padding: "12px 16px",
    borderRadius: 6,
    fontSize: "var(--text-xs)",
    fontFamily: "'JetBrains Mono', monospace",
    color: "var(--text-secondary)",
    lineHeight: "var(--leading-relaxed)",
    overflowX: "auto",
    whiteSpace: "pre-wrap",
    wordBreak: "break-word",
    margin: 0,
    maxHeight: 180,
    overflowY: "auto",
  },
};
