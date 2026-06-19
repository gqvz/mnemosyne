import { useEffect, useRef, useMemo, useState } from 'react';
import * as d3 from 'd3';
import { getMemoryType } from '../types';
import type { MemoryIndex } from '../types';

interface MemoryGraphProps {
  memories: MemoryIndex[];
  selectedId: string | null;
  highlightedIds: Set<string>;
  replayIds: Set<string>;
  onSelect: (memory: MemoryIndex) => void;
}

const TYPE_COLORS = {
  observation: '#3fb950',
  decision: '#58a6ff',
  artifact: '#f78166',
  reflection: '#d2a8ff',
};

interface NodeDatum extends d3.SimulationNodeDatum {
  id: string;
  depth: number;
  width: number;
  height: number;
  memory: MemoryIndex;
  typeStr: string;
  typeColor: string;
}

interface EdgeDatum extends d3.SimulationLinkDatum<NodeDatum> {
  source: string | NodeDatum;
  target: string | NodeDatum;
}

export default function MemoryGraph({ memories, selectedId, highlightedIds, replayIds, onSelect }: MemoryGraphProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [zoomLevel, setZoomLevel] = useState(1);
  const [hoveredNode, setHoveredNode] = useState<{ x: number; y: number; memory: MemoryIndex } | null>(null);
  const [resizeTick, setResizeTick] = useState(0);

  useEffect(() => {
    const onResize = () => setResizeTick(t => t + 1);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  const { initialNodes, initialLinks } = useMemo(() => {
    // 1. Build basic nodes and links
    const nodes = memories.map(m => {
      const typeStr = getMemoryType(m.memory_type);
      return {
        id: m.blob_id,
        depth: 0,
        width: 100,
        height: 26,
        memory: m,
        typeStr,
        typeColor: TYPE_COLORS[typeStr as keyof typeof TYPE_COLORS]
      } as NodeDatum;
    });

    const links: EdgeDatum[] = [];
    memories.forEach(m => {
      m.parent_memories.forEach(parentId => {
        if (memories.find(pm => pm.blob_id === parentId)) {
          links.push({ source: parentId, target: m.blob_id });
        }
      });
    });

    // 2. Compute depth for layout seeding
    const memo: Record<string, number> = {};
    function computeDepth(node: NodeDatum): number {
      if (memo[node.id] !== undefined) return memo[node.id];
      // Set sentinel before recursing to break cycles
      memo[node.id] = 0;
      const parents = links.filter(e => e.target === node.id);
      const maxParentDepth = parents.length === 0
        ? -1
        : Math.max(...parents.map(e => {
            const parent = nodes.find(n => n.id === e.source);
            return parent ? computeDepth(parent) : -1;
          }));
      memo[node.id] = maxParentDepth + 1;
      return memo[node.id];
    }

    nodes.forEach(n => {
      n.depth = computeDepth(n);
    });

    return { initialNodes: nodes, initialLinks: links };
  }, [memories]);

  useEffect(() => {
    if (!containerRef.current) return;
    const container = containerRef.current;
    
    d3.select(container).select('svg').remove();

    const svgWidth = container.clientWidth;
    const svgHeight = container.clientHeight;

    const svg = d3.select(container)
      .append('svg')
      .attr('width', svgWidth)
      .attr('height', svgHeight)
      .attr('viewBox', `0 0 ${svgWidth} ${svgHeight}`);

    const innerG = svg.append('g').attr('class', 'graph-root');

    // Pan & Zoom
    const zoom = d3.zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.5, 3.0])
      .on('zoom', (event) => {
        innerG.attr('transform', event.transform);
        setZoomLevel(event.transform.k);
      });
    
    svg.call(zoom);

    // Initial transform to center graph slightly
    svg.call(zoom.transform, d3.zoomIdentity.translate(0, 0));

    const defs = svg.append('defs');
    
    defs.selectAll('marker')
      .data(['arrow-graph'])
      .join('marker')
      .attr('id', String)
      .attr('viewBox', '0 -5 10 10')
      .attr('refX', 10)
      .attr('refY', 0)
      .attr('markerWidth', 6)
      .attr('markerHeight', 6)
      .attr('orient', 'auto')
      .append('path')
      .attr('fill', '#6e7681')
      .attr('d', 'M0,-5L10,0L0,5');

    Object.keys(TYPE_COLORS).forEach((type) => {
      const filter = defs.append('filter').attr('id', `glow-${type}`);
      filter.append('feGaussianBlur').attr('stdDeviation', '4').attr('result', 'coloredBlur');
      const feMerge = filter.append('feMerge');
      feMerge.append('feMergeNode').attr('in', 'coloredBlur');
      feMerge.append('feMergeNode').attr('in', 'SourceGraphic');
    });

    // Seed positions based on depth
    const maxDepth = Math.max(...initialNodes.map(n => n.depth), 1);
    const nodes: NodeDatum[] = initialNodes.map(d => ({
      ...d,
      x: (d.depth / maxDepth) * (svgWidth * 0.8) + svgWidth * 0.1,
      y: svgHeight / 2 + (Math.random() - 0.5) * 200,
    }));
    const edges = initialLinks.map(d => ({...d}));

    const edgeSelection = innerG.append('g')
      .selectAll('path')
      .data(edges)
      .join('path')
      .attr('class', 'edge-path')
      .attr('fill', 'none')
      .attr('stroke', '#6e7681')
      .attr('stroke-width', 1.5)
      .attr('marker-end', 'url(#arrow-graph)');

    const nodeG = innerG.append('g')
      .selectAll<SVGGElement, NodeDatum>('.node')
      .data(nodes)
      .join('g')
      .attr('class', 'node')
      .attr('tabindex', 0)
      .attr('id', d => `node-${d.id}`)
      .style('cursor', 'pointer')
      
      .on('keydown', (event, d) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          onSelect(d.memory);
        }
      })
      .on('click', (event, d) => {
        if (event.defaultPrevented) return;
        onSelect(d.memory);
      })
      .on('mouseenter', (event, d) => {
        setHoveredNode({ x: event.clientX, y: event.clientY, memory: d.memory });
      })
      .on('mousemove', (event, d) => {
        setHoveredNode({ x: event.clientX, y: event.clientY, memory: d.memory });
      })
      .on('mouseleave', () => {
        setHoveredNode(null);
      });

    nodeG.append('rect')
      .attr('width', d => d.width)
      .attr('height', d => d.height)
      .attr('x', d => -d.width / 2)
      .attr('y', d => -d.height / 2)
      .attr('rx', 3)
      .attr('ry', 3)
      .attr('fill', '#161b22')
      .attr('stroke', d => d.id === selectedId ? '#ffffff' : d.typeColor)
      .attr('stroke-width', d => d.id === selectedId ? 2.5 : 1)
      .attr('filter', d => d.id === selectedId ? `url(#glow-${d.typeStr})` : null)
      .style('transition', 'stroke 200ms ease, stroke-width 200ms ease, filter 200ms ease');

    nodeG.append('text')
      .text(d => `${d.typeStr.slice(0, 3)}:${d.id.substring(0, 8)}`)
      .attr('text-anchor', 'middle')
      .attr('dominant-baseline', 'middle')
      .attr('fill', d => d.typeColor)
      .attr('font-size', '11px')
      .attr('font-family', 'monospace')
      .style('pointer-events', 'none');

    // Force Simulation (no forceX/Y, relies purely on link tension + body charge)
    const simulation = d3.forceSimulation<NodeDatum>(nodes)
      .force('link', d3.forceLink<NodeDatum, EdgeDatum>(edges)
        .id(d => d.id)
        .distance(140)
        .strength(0.6)
      )
      .force('collide', d3.forceCollide(55))
      .force('charge', d3.forceManyBody().strength(-200))
      .force('center', d3.forceCenter(svgWidth / 2, svgHeight / 2).strength(0.05))
      .alphaDecay(0.015)
      .velocityDecay(0.4)
      .on('tick', () => {
        edgeSelection.attr('d', (e: EdgeDatum) => {
          const s = e.source as NodeDatum;
          const t = e.target as NodeDatum;
          
          const dx = s.x! - t.x!;
          const dy = s.y! - t.y!;
          
          let targetX = t.x!;
          let targetY = t.y!;
          
          if (dx !== 0 || dy !== 0) {
            const w = t.width || 100;
            const h = t.height || 26;
            const scaleX = (w / 2) / Math.abs(dx);
            const scaleY = (h / 2) / Math.abs(dy);
            const scale = Math.min(scaleX, scaleY);
            targetX = t.x! + dx * scale;
            targetY = t.y! + dy * scale;
          }
          
          return `M${s.x},${s.y} L${targetX},${targetY}`;
        });

        nodeG.attr('transform', d => `translate(${d.x},${d.y})`);
      });

    const drag = d3.drag<SVGGElement, NodeDatum>()
      .on('start', (event, d) => {
        event.sourceEvent.stopPropagation();
        if (!event.active) simulation.alphaTarget(0.3).restart();
        d.fx = d.x; 
        d.fy = d.y;
        d3.select(event.sourceEvent.target.closest('g.node')).raise();
      })
      .on('drag', (event, d) => {
        d.fx = event.x; 
        d.fy = event.y;
      })
      .on('end', (event, d) => {
        if (!event.active) simulation.alphaTarget(0);
        d.fx = null; 
        d.fy = null;
      });

    nodeG.call(drag);

    return () => {
      simulation.stop();
    };

  }, [initialNodes, initialLinks, onSelect, resizeTick]);

  useEffect(() => {
    if (!containerRef.current) return;
    const svg = d3.select(containerRef.current).select('svg');
    if (svg.empty()) return;

    const hasSelection = selectedId !== null;

    svg.selectAll<SVGGElement, NodeDatum>('.node')
      .style('opacity', d => {
        if (!hasSelection) return 1;
        return highlightedIds.has(d.id) ? 1 : 0.2;
      });

    svg.selectAll<SVGRectElement, NodeDatum>('.node rect')
      .attr('stroke', d => {
        if (!hasSelection) return d.typeColor;
        if (highlightedIds.has(d.id)) {
          if (replayIds.has(d.id)) {
            return d.id === selectedId ? '#ffffff' : d.typeColor;
          }
          return '#30363d'; // Unrevealed nodes get a dark gray outline
        }
        return d.typeColor;
      })
      .attr('stroke-width', d => {
        if (!hasSelection) return 1;
        if (d.id === selectedId && replayIds.has(d.id)) return 2.5;
        if (highlightedIds.has(d.id)) {
          return replayIds.has(d.id) ? 2.5 : 1.0;
        }
        return 1;
      })
      .attr('filter', d => {
        if (hasSelection && highlightedIds.has(d.id) && replayIds.has(d.id)) {
          return d.id === selectedId ? `url(#glow-${d.typeStr})` : null;
        }
        return null;
      });

    svg.selectAll<SVGPathElement, EdgeDatum>('.edge-path')
      .style('opacity', e => {
        if (!hasSelection) return 1;
        const sourceId = typeof e.source === 'string' ? e.source : (e.source as NodeDatum).id;
        const targetId = typeof e.target === 'string' ? e.target : (e.target as NodeDatum).id;
        return (replayIds.has(sourceId) && replayIds.has(targetId)) ? 1 : 0.15;
      })
      .attr('stroke', e => {
        if (!hasSelection) return '#6e7681';
        const sourceId = typeof e.source === 'string' ? e.source : (e.source as NodeDatum).id;
        const targetId = typeof e.target === 'string' ? e.target : (e.target as NodeDatum).id;
        if (replayIds.has(sourceId) && replayIds.has(targetId)) {
          const targetNode = initialNodes.find(n => n.id === targetId);
          return targetNode?.typeColor || '#6e7681';
        }
        return '#30363d';
      })
      .attr('stroke-width', e => {
        if (!hasSelection) return 1.5;
        const sourceId = typeof e.source === 'string' ? e.source : (e.source as NodeDatum).id;
        const targetId = typeof e.target === 'string' ? e.target : (e.target as NodeDatum).id;
        return (replayIds.has(sourceId) && replayIds.has(targetId)) ? 2.5 : 1.0;
      });

  }, [selectedId, highlightedIds, replayIds, initialNodes]);

  return (
    <div className="w-full h-full bg-bg-center relative overflow-hidden text-[13px]">
      <div ref={containerRef} className="w-full h-full absolute inset-0" />
      
      {/* Zoom Indicator */}
      <div className="absolute top-4 right-4 bg-[#161b22] border border-[#30363d] text-[#6e7681] px-2 py-1 rounded-sm text-[12px] font-mono pointer-events-none select-none">
        ×{zoomLevel.toFixed(1)}
      </div>

      {/* Tooltip */}
      {hoveredNode && (
        <div 
          className="fixed bg-[#161b22] border border-[#30363d] p-3 text-[11px] font-mono rounded-sm pointer-events-none z-[999] shadow-lg flex flex-col gap-1"
          style={{ 
            left: Math.max(8, Math.min(hoveredNode.x - 120, window.innerWidth - 250)),
            top: Math.min(hoveredNode.y + 16, window.innerHeight - 120),
          }}
        >
          <div className="text-accent text-[12px]">{hoveredNode.memory.blob_id}</div>
          <div className="text-[#3fb950] text-[12px]">{hoveredNode.memory.agent_address}</div>
          <div className="text-[#c9d1d9]">{new Date(hoveredNode.memory.timestamp).toISOString()}</div>
          <div 
            className="inline-block mt-1 uppercase tracking-widest text-[11px]"
            style={{ color: TYPE_COLORS[getMemoryType(hoveredNode.memory.memory_type) as keyof typeof TYPE_COLORS] }}
          >
            {getMemoryType(hoveredNode.memory.memory_type)}
          </div>
        </div>
      )}
    </div>
  );
}
