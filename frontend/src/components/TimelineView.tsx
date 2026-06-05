import type { DisplayMemory } from "./mockData";
import { getMemoryDisplay } from "./mockData";

interface Props {
  memories: DisplayMemory[];
  selectedId: string | null;
  onSelect: (m: DisplayMemory) => void;
}

export function TimelineView({ memories, selectedId, onSelect }: Props) {
  const sorted = [...memories].sort((a, b) => b.timestampMs - a.timestampMs);

  if (memories.length === 0) {
    return (
      <div style={styles.container}>
        <div style={styles.header}>
          <span style={styles.headerIcon}>&#128197;</span>
          <span style={styles.headerText}>Timeline</span>
          <span style={styles.count}>0 events</span>
        </div>
        <div className="empty-state">
          <div style={{ fontSize: 24, marginBottom: 8 }}>&#128269;</div>
          <div style={{ fontSize: "var(--text-sm)", fontWeight: 500 }}>No memories found</div>
          <div style={{ fontSize: "var(--text-xs)", marginTop: 4 }}>
            Memories will appear here as agents make observations and decisions.
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <span style={styles.headerIcon}>&#128197;</span>
        <span style={styles.headerText}>Timeline</span>
        <span style={styles.count}>{memories.length} events</span>
      </div>
      <div style={styles.list}>
        {sorted.map((mem) => {
          const { color, label } = getMemoryDisplay(mem.memoryType);
          const isSelected = mem.id === selectedId;
          const time = new Date(mem.timestampMs).toLocaleTimeString([], {
            hour: "2-digit",
            minute: "2-digit",
          });

          return (
            <div
              key={mem.id}
              onClick={() => onSelect(mem)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  onSelect(mem);
                }
              }}
              tabIndex={0}
              role="button"
              aria-label={`Select ${label} memory by ${mem.agentName}`}
              className={`timeline-item ${isSelected ? 'selected' : ''}`}
              style={{
                ...styles.item,
                borderLeftColor: isSelected ? color : "transparent",
              }}
              title={mem.content?.rationale as string || ""}
            >
              <div style={styles.itemHeader}>
                <div
                  style={{
                    ...styles.dot,
                    background: color,
                  }}
                />
                <span style={styles.itemType}>{label}</span>
                <span style={styles.itemTime}>{time}</span>
              </div>
              <div style={styles.itemAgent}>{mem.agentName}</div>
              <div style={styles.itemSummary}>
                {getSummary(mem)}
              </div>
              {mem.verified && (
                <span style={styles.verified}>&#10003;</span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function getSummary(mem: DisplayMemory): string {
  const c = mem.content;
  if (mem.memoryType === "observation") {
    return (c.oracle as string) || (c.market as string) || "Observation";
  }
  if (mem.memoryType === "decision") {
    return `${c.action || "?"} (${Math.floor((c.confidence as number || 0) * 100)}% confidence)`;
  }
  if (mem.memoryType === "artifact") {
    return `${c.outcome || "?"} | PnL: ${c.pnl || 0}`;
  }
  if (mem.memoryType === "reflection") {
    return (c.summary as string)?.slice(0, 60) || "Reflection";
  }
  return "Memory";
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    height: "100%",
    display: "flex",
    flexDirection: "column",
  },
  header: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    padding: "12px 16px",
    borderBottom: "1px solid var(--border)",
  },
  headerIcon: {
    fontSize: 14,
  },
  headerText: {
    fontSize: "var(--text-sm)",
    fontWeight: 600,
    color: "var(--text-primary)",
    flex: 1,
  },
  count: {
    fontSize: "var(--text-xs)",
    color: "var(--text-muted)",
    fontWeight: 500,
  },
  list: {
    flex: 1,
    overflowY: "auto",
    padding: "8px 12px",
    display: "flex",
    flexDirection: "column",
    gap: 6,
  },
  item: {
    padding: "12px 16px",
    borderRadius: 8,
    cursor: "pointer",
    borderLeft: "3px solid transparent",
    transition: "all 0.15s",
    position: "relative",
    minHeight: 44,
    display: "flex",
    flexDirection: "column",
    justifyContent: "center",
  },
  itemHeader: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    marginBottom: 4,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: "50%",
    flexShrink: 0,
  },
  itemType: {
    fontSize: "var(--text-xs)",
    fontWeight: 600,
    color: "var(--text-muted)",
    textTransform: "uppercase",
    letterSpacing: "var(--tracking-wide)",
  },
  itemTime: {
    fontSize: "var(--text-xs)",
    color: "var(--text-muted)",
    marginLeft: "auto",
    fontFamily: "'JetBrains Mono', monospace",
    fontVariantNumeric: "tabular-nums",
  },
  itemAgent: {
    fontSize: "var(--text-xs)",
    color: "var(--text-secondary)",
    fontWeight: 500,
    marginBottom: 2,
    paddingLeft: 16,
  },
  itemSummary: {
    fontSize: "var(--text-sm)",
    color: "var(--text-primary)",
    paddingLeft: 16,
    lineHeight: "var(--leading-normal)",
  },
  verified: {
    position: "absolute",
    top: 8,
    right: 10,
    fontSize: 12,
    color: "var(--accent-green)",
  },
};
