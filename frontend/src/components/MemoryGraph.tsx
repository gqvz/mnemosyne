import { useEffect, useRef, useMemo, useState } from 'react';
import * as d3 from 'd3';
import dagre from 'dagre';
import { getMemoryType } from '../types';
import type { MemoryIndex } from '../types';

interface MemoryGraphProps {
  memories: MemoryIndex[];
  selectedId: string | null;
  onSelect: (memory: MemoryIndex) => void;
}

const TYPE_COLORS = {
  observation: '#3fb950',
  decision: '#58a6ff',
  artifact: '#f78166',
  reflection: '#d2a8ff',
};

const TYPE_RANK_Y: Record<string, number> = {
  observation: 100,
  decision: 200, 
  artifact: 300,
  reflection: 380,
};

interface NodeDatum extends d3.SimulationNodeDatum {
  id: string;
  dagre_x: number;
  dagre_y: number;
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

export default function MemoryGraph({ memories, selectedId, onSelect }: MemoryGraphProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [zoomLevel, setZoomLevel] = useState(1);
  const [hoveredNode, setHoveredNode] = useState<{ x: number; y: number; memory: MemoryIndex } | null>(null);

  const { initialNodes, initialLinks, graphBBox } = useMemo(() => {
    const g = new dagre.graphlib.Graph();
    g.setGraph({ rankdir: 'LR', ranksep: 80, nodesep: 40 });
    g.setDefaultEdgeLabel(() => ({}));

    memories.forEach(m => {
      g.setNode(m.blob_id, { width: 90, height: 26, memory: m });
    });

    memories.forEach(m => {
      m.parent_memories.forEach(parentId => {
        if (memories.find(pm => pm.blob_id === parentId)) {
          g.setEdge(parentId, m.blob_id);
        }
      });
    });

    dagre.layout(g);

    const outNodes: NodeDatum[] = g.nodes().map(v => {
      const node = g.node(v) as any;
      const typeStr = getMemoryType((node.memory as MemoryIndex).memory_type);
      return {
        id: v,
        x: node.x,
        y: node.y,
        dagre_x: node.x,
        dagre_y: TYPE_RANK_Y[typeStr] || node.y,
        width: 90,
        height: 26,
        memory: node.memory as MemoryIndex,
        typeStr,
        typeColor: TYPE_COLORS[typeStr as keyof typeof TYPE_COLORS]
      };
    });

    const outLinks: EdgeDatum[] = g.edges().map(e => ({
      source: e.v,
      target: e.w
    }));

    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    outNodes.forEach(n => {
      if (n.dagre_x - n.width/2 < minX) minX = n.dagre_x - n.width/2;
      if (n.dagre_x + n.width/2 > maxX) maxX = n.dagre_x + n.width/2;
      if (n.dagre_y - n.height/2 < minY) minY = n.dagre_y - n.height/2;
      if (n.dagre_y + n.height/2 > maxY) maxY = n.dagre_y + n.height/2;
    });

    if (minX === Infinity) {
      minX = 0; minY = 0; maxX = 800; maxY = 600;
    }

    return { 
      initialNodes: outNodes, 
      initialLinks: outLinks, 
      graphBBox: { x: minX, y: minY, width: maxX - minX, height: maxY - minY } 
    };
  }, [memories]);

  useEffect(() => {
    if (!containerRef.current) return;
    const container = containerRef.current;
    
    d3.select(container).select('svg').remove();

    const width = container.clientWidth;
    const height = container.clientHeight;

    const svg = d3.select(container)
      .append('svg')
      .attr('width', width)
      .attr('height', height)
      .attr('viewBox', `0 0 ${width} ${height}`);

    const innerG = svg.append('g').attr('class', 'graph-root');

    // Pan & Zoom
    const zoom = d3.zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.5, 3.0])
      .on('zoom', (event) => {
        innerG.attr('transform', event.transform);
        setZoomLevel(event.transform.k);
      });
    
    svg.call(zoom);

    const padding = 60;
    const scale = Math.min(
      (width - padding * 2) / (graphBBox.width || 1),
      (height - padding * 2) / (graphBBox.height || 1),
      1
    );
    const tx = (width - graphBBox.width * scale) / 2 - graphBBox.x * scale;
    const ty = (height - graphBBox.height * scale) / 2 - graphBBox.y * scale;
    
    svg.call(zoom.transform, d3.zoomIdentity.translate(tx, ty).scale(scale));

    const defs = svg.append('defs');
    
    defs.selectAll('marker')
      .data(['arrow'])
      .join('marker')
      .attr('id', String)
      .attr('viewBox', '0 -5 10 10')
      .attr('refX', 53) // offset for NODE_W/2 = 45 + marker + stroke = ~53
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

    const nodes = initialNodes.map(d => ({...d}));
    const edges = initialLinks.map(d => ({...d}));

    const edgeSelection = innerG.append('g')
      .selectAll('path')
      .data(edges)
      .join('path')
      .attr('fill', 'none')
      .attr('stroke', '#6e7681')
      .attr('stroke-width', 1.5)
      .attr('marker-end', 'url(#arrow)');

    const nodeG = innerG.append('g')
      .selectAll<SVGGElement, NodeDatum>('.node')
      .data(nodes)
      .join('g')
      .attr('class', 'node')
      .attr('id', d => `node-${d.id}`)
      .style('cursor', 'pointer')
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
      .style('transition', 'stroke 0.2s, stroke-width 0.2s');

    nodeG.append('text')
      .text(d => d.id.substring(0, 10))
      .attr('text-anchor', 'middle')
      .attr('dominant-baseline', 'middle')
      .attr('fill', d => d.typeColor)
      .attr('font-size', '11px')
      .attr('font-family', 'monospace')
      .style('pointer-events', 'none');

    // Force Simulation
    const simulation = d3.forceSimulation<NodeDatum>(nodes)
      .force('link', d3.forceLink<NodeDatum, EdgeDatum>(edges)
        .id(d => d.id)
        .distance(120)
        .strength(0.8)
      )
      .force('collide', d3.forceCollide(60))
      .force('x', d3.forceX<NodeDatum>(d => d.dagre_x).strength(0.4))
      .force('y', d3.forceY<NodeDatum>(d => d.dagre_y).strength(0.4))
      .alpha(0.6)
      .alphaDecay(0.02)
      .on('tick', () => {
        edgeSelection.attr('d', (e: any) => {
          const s = e.source as NodeDatum;
          const t = e.target as NodeDatum;
          const mx = (s.x! + t.x!) / 2;
          return `M${s.x},${s.y} C${mx},${s.y} ${mx},${t.y} ${t.x},${t.y}`;
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

  }, [initialNodes, initialLinks, graphBBox, selectedId, onSelect]);

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
            left: hoveredNode.x, 
            top: hoveredNode.y + 16,
            transform: 'translateX(-50%)'
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
