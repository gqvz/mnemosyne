import { useEffect, useRef, useMemo, useState } from 'react';
import * as d3 from 'd3';
import { getMemoryType } from '../types';
import type { MemoryIndex } from '../types';

interface TimelineViewProps {
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

interface NodeDatum {
  id: string;
  x: number;
  y: number;
  typeColor: string;
  memory: MemoryIndex;
}

interface EdgeDatum {
  source: string;
  target: string;
}

export default function TimelineView({ memories, selectedId, onSelect }: TimelineViewProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [hoveredNode, setHoveredNode] = useState<{ x: number; y: number; memory: MemoryIndex } | null>(null);

  const { nodesData, linksData, swimlanes, timeExtent } = useMemo(() => {
    const sorted = [...memories].sort((a, b) => a.timestamp - b.timestamp);
    const swimlanesMap = new Map<string, number>();
    const uniqueAgents = Array.from(new Set(memories.map(m => m.agent_address)));
    
    uniqueAgents.sort((a, b) => {
      const getOrder = (agent: string) => {
        const lower = agent.toLowerCase();
        if (lower.includes('scout')) return 0;
        if (lower.includes('strategist')) return 1;
        if (lower.includes('executor')) return 2;
        return 3;
      };
      return getOrder(a) - getOrder(b);
    });

    uniqueAgents.forEach((agent, i) => swimlanesMap.set(agent, i));

    const nodesData = sorted.map(m => {
      return {
        id: m.blob_id,
        memory: m,
        swimlaneIndex: swimlanesMap.get(m.agent_address) || 0,
        typeColor: TYPE_COLORS[getMemoryType(m.memory_type) as keyof typeof TYPE_COLORS]
      };
    });

    const linksData: EdgeDatum[] = [];
    nodesData.forEach(n => {
      n.memory.parent_memories.forEach(pid => {
        const parent = nodesData.find(pn => pn.id === pid);
        if (parent) {
          linksData.push({ source: parent.id, target: n.id });
        }
      });
    });

    const times = nodesData.map(n => n.memory.timestamp);
    const minTime = times.length > 0 ? Math.min(...times) : Date.now() - 10000;
    const maxTime = times.length > 0 ? Math.max(...times) : Date.now();

    return { 
      nodesData, 
      linksData, 
      swimlanes: uniqueAgents, 
      timeExtent: [minTime, maxTime] as [number, number] 
    };
  }, [memories]);

  useEffect(() => {
    if (!containerRef.current || nodesData.length === 0) return;
    const container = containerRef.current;
    
    container.innerHTML = '';
    
    const timeSpan = timeExtent[1] - timeExtent[0];
    const width = Math.max(container.clientWidth, 800 + (timeSpan / 1000) * 10);
    const height = container.clientHeight;
    
    const svg = d3.select(container)
      .append('svg')
      .attr('width', width)
      .attr('height', height)
      .style('display', 'block');

    const margin = { top: 40, right: 100, bottom: 40, left: 150 };
    const innerWidth = width - margin.left - margin.right;
    const innerHeight = height - margin.top - margin.bottom;

    const g = svg.append('g')
      .attr('transform', `translate(${margin.left},${margin.top})`);

    // Panning on the whole SVG
    const zoom = d3.zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.5, 3.0])
      .on('zoom', (event) => {
        g.attr('transform', event.transform);
      });
    svg.call(zoom);
    
    // reset g transform for zoom to pick up correctly from margin
    g.attr('transform', `translate(${margin.left},${margin.top})`);
    svg.call(zoom.transform, d3.zoomIdentity.translate(margin.left, margin.top));

    const xScale = d3.scaleTime()
      .domain(timeExtent)
      .range([0, innerWidth]);

    const yScale = d3.scaleBand()
      .domain(swimlanes)
      .range([0, innerHeight])
      .padding(0.1);

    const nodes: NodeDatum[] = nodesData.map(n => ({
      id: n.id,
      x: xScale(n.memory.timestamp),
      y: yScale(n.memory.agent_address)! + yScale.bandwidth() / 2,
      typeColor: n.typeColor,
      memory: n.memory
    }));

    const nodeMap = new Map<string, NodeDatum>();
    nodes.forEach(n => nodeMap.set(n.id, n));

    swimlanes.forEach(agent => {
      const y = yScale(agent)!;
      const bandHeight = yScale.bandwidth();
      const midY = y + bandHeight / 2;

      g.append('line')
        .attr('x1', 0)
        .attr('x2', innerWidth)
        .attr('y1', midY)
        .attr('y2', midY)
        .attr('stroke', '#21262d')
        .attr('stroke-dasharray', '4,4');

      g.append('text')
        .attr('x', -10)
        .attr('y', midY)
        .attr('text-anchor', 'end')
        .attr('dominant-baseline', 'middle')
        .attr('fill', '#c9d1d9')
        .attr('font-family', 'monospace')
        .attr('font-size', '12px')
        .text(agent);
    });

    svg.append('defs').selectAll('marker')
      .data(['arrow'])
      .join('marker')
      .attr('id', String)
      .attr('viewBox', '0 -5 10 10')
      .attr('refX', 8)
      .attr('refY', 0)
      .attr('markerWidth', 6)
      .attr('markerHeight', 6)
      .attr('orient', 'auto')
      .append('path')
      .attr('fill', '#6e7681')
      .attr('d', 'M0,-5L10,0L0,5');

    const filter = svg.select('defs').append('filter').attr('id', 'glow-timeline');
    filter.append('feGaussianBlur').attr('stdDeviation', '4').attr('result', 'coloredBlur');
    const feMerge = filter.append('feMerge');
    feMerge.append('feMergeNode').attr('in', 'coloredBlur');
    feMerge.append('feMergeNode').attr('in', 'SourceGraphic');

    function getEdgePath(e: EdgeDatum) {
      const s = nodeMap.get(e.source);
      const t = nodeMap.get(e.target);
      if (!s || !t) return '';
      const mx = (s.x + t.x) / 2;
      return `M${s.x},${s.y} C${mx},${s.y} ${mx},${t.y} ${t.x},${t.y}`;
    }

    g.append('g')
      .selectAll('path')
      .data(linksData)
      .join('path')
      .attr('d', getEdgePath)
      .attr('fill', 'none')
      .attr('stroke', '#6e7681')
      .attr('stroke-opacity', 0.6)
      .attr('stroke-width', 1.5)
      .attr('marker-end', 'url(#arrow)');

    const nodeG = g.append('g')
      .selectAll('.node')
      .data(nodes)
      .join('g')
      .attr('class', 'node')
      .attr('id', d => `node-tl-${d.id}`)
      .attr('transform', d => `translate(${d.x},${d.y})`)
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
      .attr('width', 16)
      .attr('height', 16)
      .attr('x', -8)
      .attr('y', -8)
      .attr('rx', 3)
      .attr('ry', 3)
      .attr('fill', '#161b22')
      .attr('stroke', d => d.id === selectedId ? '#ffffff' : d.typeColor)
      .attr('stroke-width', d => d.id === selectedId ? 2.5 : 1)
      .attr('filter', d => d.id === selectedId ? 'url(#glow-timeline)' : null)
      .style('transition', 'stroke 0.2s, stroke-width 0.2s');

  }, [nodesData, linksData, swimlanes, timeExtent, selectedId, onSelect]);

  return (
    <div className="w-full h-full bg-bg-center relative text-[13px]">
      <div className="w-full h-full overflow-hidden" ref={containerRef} />
      
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
