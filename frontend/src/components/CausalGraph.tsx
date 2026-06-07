import { useMemo, useRef } from "react";
import type { DisplayMemory } from "./mockData";
import { getMemoryDisplay } from "./mockData";

interface Props {
  memories: DisplayMemory[];
  selectedId: string | null;
  onSelect: (m: DisplayMemory) => void;
}

interface PositionedNode {
  id: string;
  blobId: string;
  memoryType: string;
  color: string;
  x: number;
  y: number;
}

interface LinkDef {
  source: string;
  target: string;
}

function layout(memories: DisplayMemory[], w: number, h: number): { nodes: PositionedNode[]; links: LinkDef[] } {
  const nodes: PositionedNode[] = [];
  const links: LinkDef[] = [];
  const ids = new Set<string>();

  for (const m of memories) {
    if (ids.has(m.id)) continue;
    ids.add(m.id);
    nodes.push({ id: m.id, blobId: m.blobId, memoryType: m.memoryType, color: getMemoryDisplay(m.memoryType).color, x: 0, y: 0 });
  }

  for (const m of memories) {
    for (const pid of m.parentIds) {
      if (memories.some((n) => n.id === pid)) {
        links.push({ source: pid, target: m.id });
      }
    }
  }

  const layers = new Map<string, number>();
  const indeg = new Map<string, number>();
  for (const n of nodes) { indeg.set(n.id, 0); layers.set(n.id, 0); }
  for (const l of links) { indeg.set(l.target, (indeg.get(l.target) ?? 0) + 1); }

  const queue: string[] = [];
  for (const n of nodes) { if ((indeg.get(n.id) ?? 0) === 0) { queue.push(n.id); } }

  const layerMap = new Map<number, string[]>();
  while (queue.length > 0) {
    const cur = queue.shift()!;
    const layer = layers.get(cur) ?? 0;
    if (!layerMap.has(layer)) layerMap.set(layer, []);
    layerMap.get(layer)!.push(cur);
    for (const l of links) {
      if (l.source === cur) {
        const nl = Math.max(layer + 1, layers.get(l.target) ?? 0);
        layers.set(l.target, nl);
        indeg.set(l.target, (indeg.get(l.target) ?? 1) - 1);
        if ((indeg.get(l.target) ?? 0) === 0) queue.push(l.target);
      }
    }
  }

  const maxL = Math.max(...Array.from(layerMap.keys()), 0) || 0;
  const startX = 80;
  const startY = 50;

  for (const [layer, idArr] of layerMap) {
    const x = startX + layer * Math.max(180, (w - 120) / (maxL + 1));
    for (let i = 0; i < idArr.length; i++) {
      const node = nodes.find((n) => n.id === idArr[i]);
      if (node) {
        node.x = x;
        node.y = Math.max(startY, (h - idArr.length * 100) / 2 + i * 100);
      }
    }
  }

  return { nodes, links };
}

const R = 34;

export function CausalGraph({ memories, selectedId, onSelect }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const w = containerRef.current?.clientWidth ?? 800;
  const h = containerRef.current?.clientHeight ?? 500;

  const { nodes, links } = useMemo(() => layout(memories, w, h), [memories, w, h]);

  if (memories.length === 0) {
    return (
      <div style={styles.container}>
        <div style={styles.header}>
          <span style={styles.headerText} className="font-mono text-glow-purple">CAUSAL_GRAPH</span>
        </div>
        <div className="empty-state" style={{ flex: 1 }}>
          <div style={{ fontSize: 24, marginBottom: 8, filter: "drop-shadow(0 0 10px rgba(176,80,255,0.4))" }}>&#10022;</div>
          <div className="font-mono" style={{ fontSize: "var(--text-sm)", color: "var(--accent-purple)" }}>NO TOPOLOGY</div>
          <div style={{ fontSize: "var(--text-xs)", marginTop: 8, opacity: 0.6 }}>
            The causal graph will synthesize as memories interlink.
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <span style={styles.headerText} className="font-mono text-glow-purple">CAUSAL_GRAPH</span>
        <span style={styles.legend}>
          {(["observation", "decision", "artifact"] as const).map((t) => {
            const { color, label } = getMemoryDisplay(t);
            return (
              <span key={t} style={styles.legendItem} className="font-mono">
                <span style={{ ...styles.legendDot, background: color, boxShadow: `0 0 8px ${color}` }} />
                {label}
              </span>
            );
          })}
        </span>
      </div>
      <div ref={containerRef} style={styles.graphArea} className="graph-canvas">
        <svg style={{ width: "100%", height: "100%" }}>
          <defs>
            <marker id="arrow" markerWidth="8" markerHeight="6" refX="28" refY="3" orient="auto">
              <polygon points="0 0, 8 3, 0 6" fill="rgba(0, 229, 255, 0.4)" />
            </marker>
            <filter id="glow">
              <feGaussianBlur stdDeviation="6" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
            <filter id="linkGlow">
              <feGaussianBlur stdDeviation="2" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>

          {links.map((l, i) => {
            const s = nodes.find((n) => n.id === l.source);
            const t = nodes.find((n) => n.id === l.target);
            if (!s || !t) return null;
            return (
              <line
                key={`link-${i}`}
                x1={s.x} y1={s.y} x2={t.x} y2={t.y}
                stroke="rgba(0, 229, 255, 0.2)" strokeWidth={1.5}
                markerEnd="url(#arrow)"
                style={{ filter: "url(#linkGlow)" }}
              />
            );
          })}

          {nodes.map((n) => {
            const sel = n.id === selectedId;
            return (
              <g
                key={n.id}
                onClick={() => { const m = memories.find((x) => x.id === n.id); if (m) onSelect(m); }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    const m = memories.find((x) => x.id === n.id);
                    if (m) onSelect(m);
                  }
                }}
                tabIndex={0}
                role="button"
                aria-label={`Select ${n.memoryType} memory ${n.blobId}`}
                className="graph-node"
                style={{ cursor: "pointer" }}
                filter={sel ? "url(#glow)" : undefined}
              >
                <circle 
                  cx={n.x} 
                  cy={n.y} 
                  r={R} 
                  fill={sel ? "rgba(20,20,30,0.8)" : "rgba(10,10,15,0.6)"} 
                  stroke={n.color} 
                  strokeWidth={sel ? 2.5 : 1.5}
                  style={{ backdropFilter: "blur(4px)" }}
                />
                <text x={n.x} y={n.y - 4} textAnchor="middle" fill="var(--text-primary)" fontSize={11} fontWeight={700} className="font-mono" style={{ letterSpacing: "0.1em" }}>
                  {n.memoryType.slice(0, 3).toUpperCase()}
                </text>
                <text x={n.x} y={n.y + 14} textAnchor="middle" fill="var(--text-muted)" fontSize={9} className="font-mono">
                  {n.blobId.slice(0, 8)}
                </text>
              </g>
            );
          })}
        </svg>
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: { height: "100%", display: "flex", flexDirection: "column" },
  header: { 
    display: "flex", 
    alignItems: "center", 
    justifyContent: "space-between",
    padding: "16px 20px", 
    borderBottom: "1px solid var(--border)",
    background: "rgba(2, 2, 4, 0.4)",
  },
  headerText: { 
    fontSize: "var(--text-xs)", 
    fontWeight: 700, 
    color: "var(--text-primary)", 
    letterSpacing: "0.15em",
  },
  legend: { display: "flex", gap: 16, alignItems: "center" },
  legendItem: { display: "flex", alignItems: "center", gap: 6, fontSize: "9px", color: "var(--text-secondary)", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase" },
  legendDot: { width: 6, height: 6, borderRadius: "50%" },
  graphArea: { flex: 1, overflow: "auto", position: "relative" },
};
