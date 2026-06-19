import { useEffect, useRef, useMemo, useState } from 'react';
import * as d3 from 'd3';
import { getMemoryType } from '../types';
import type { MemoryIndex } from '../types';

interface TimelineViewProps {
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

const TL_W = 80;
const TL_H = 24;


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

export default function TimelineView({ memories, selectedId, highlightedIds, replayIds, onSelect }: TimelineViewProps) {
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
    const minTime = times.length > 0 ? Math.min(...times) : 1717800000000;
    const maxTime = times.length > 0 ? Math.max(...times) : 1717800010000;

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

    const g = svg.append('g');

    // Panning on the whole SVG — margin is baked into the initial zoom identity
    const zoom = d3.zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.5, 3.0])
      .on('zoom', (event) => {
        g.attr('transform', event.transform);
      });
    svg.call(zoom);
    
    // Bake the margin into the initial zoom identity so zoom/pan are relative to it
    svg.call(zoom.transform, d3.zoomIdentity.translate(margin.left, margin.top));

    const xScale = d3.scaleTime()
      .domain(timeExtent)
      .range([0, innerWidth]);

    const swimlaneY: Record<string, number> = {};
    swimlanes.forEach((agent, i) => {
      swimlaneY[agent] = 100 + i * 130;
    });

    const nodes: NodeDatum[] = nodesData.map(n => ({
      id: n.id,
      x: xScale(n.memory.timestamp),
      y: swimlaneY[n.memory.agent_address] || 100,
      typeColor: n.typeColor,
      memory: n.memory
    }));

    const nodeMap = new Map<string, NodeDatum>();
    nodes.forEach(n => nodeMap.set(n.id, n));

    swimlanes.forEach(agent => {
      const midY = swimlaneY[agent] || 100;

      g.append('line')
        .attr('x1', 0)
        .attr('x2', innerWidth)
        .attr('y1', midY)
        .attr('y2', midY)
        .attr('stroke', '#21262d')
        .attr('stroke-dasharray', '4,4');

      g.append('text')
        .attr('x', -20)
        .attr('y', midY)
        .attr('text-anchor', 'end')
        .attr('dominant-baseline', 'middle')
        .attr('font-size', 11)
        .attr('font-family', "'JetBrains Mono', monospace")
        .attr('fill', '#484f58')
        .text(agent);
    });

    const xAxis = d3.axisBottom(xScale)
      .ticks(5)
      .tickFormat(d => d3.timeFormat('%H:%M:%S')(d as Date));

    const gX = svg.append('g')
      .attr('transform', `translate(${margin.left}, ${height - 30})`)
      .call(xAxis);
      
    gX.selectAll('text')
      .attr('fill', '#484f58')
      .attr('font-family', "'JetBrains Mono', monospace")
      .attr('font-size', 10);
      
    gX.selectAll('.domain, .tick line').attr('stroke', '#21262d');

    svg.append('defs').selectAll('marker')
      .data(['arrow-timeline'])
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

    const filter = svg.select('defs').append('filter').attr('id', 'glow-timeline');
    filter.append('feGaussianBlur').attr('stdDeviation', '4').attr('result', 'coloredBlur');
    const feMerge = filter.append('feMerge');
    feMerge.append('feMergeNode').attr('in', 'coloredBlur');
    feMerge.append('feMergeNode').attr('in', 'SourceGraphic');

    function getEdgePath(e: EdgeDatum) {
      const s = nodeMap.get(e.source);
      const t = nodeMap.get(e.target);
      if (!s || !t) return '';
      
      const sourceX = s.x + TL_W / 2;
      const sourceY = s.y;
      const targetX = t.x - TL_W / 2;
      const targetY = t.y;
      
      const mx = (sourceX + targetX) / 2;
      return `M${sourceX},${sourceY} C${mx},${sourceY} ${mx},${targetY} ${targetX},${targetY}`;
    }

    g.append('g')
      .selectAll('path')
      .data(linksData)
      .join('path')
      .attr('class', 'edge-path')
      .attr('d', getEdgePath)
      .attr('fill', 'none')
      .attr('stroke', '#6e7681')
      .attr('stroke-opacity', 0.6)
      .attr('stroke-width', 1.5)
      .attr('marker-end', 'url(#arrow-timeline)');

    const nodeG = g.append('g')
      .selectAll('.node')
      .data(nodes)
      .join('g')
      .attr('class', 'node')
      .attr('tabindex', 0)
      .attr('id', d => `node-tl-${d.id}`)
      .attr('transform', d => `translate(${d.x},${d.y})`)
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
      .attr('x', -TL_W/2).attr('y', -TL_H/2)
      .attr('width', TL_W).attr('height', TL_H)
      .attr('rx', 3)
      .attr('fill', '#161b22')
      .attr('stroke', d => d.id === selectedId ? '#ffffff' : d.typeColor)
      .attr('stroke-width', d => d.id === selectedId ? 2.5 : 1)
      .attr('filter', d => d.id === selectedId ? 'url(#glow-timeline)' : null)
      .style('transition', 'stroke 0.2s, stroke-width 0.2s');

    nodeG.append('text')
      .attr('text-anchor', 'middle')
      .attr('dominant-baseline', 'middle')
      .attr('font-size', 11)
      .attr('font-family', "'JetBrains Mono', monospace")
      .attr('fill', d => d.typeColor)
      .text(d => `${getMemoryType(d.memory.memory_type).slice(0, 3)}:${d.id.substring(0, 8)}`);

  }, [nodesData, linksData, swimlanes, timeExtent, onSelect]);

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
        if (hasSelection && highlightedIds.has(d.id) && replayIds.has(d.id) && d.id === selectedId) {
          return 'url(#glow-timeline)';
        }
        return null;
      });

    svg.selectAll<SVGPathElement, EdgeDatum>('.edge-path')
      .style('stroke-opacity', e => {
        if (!hasSelection) return 0.6;
        return (replayIds.has(e.source) && replayIds.has(e.target)) ? 1 : 0.15;
      })
      .attr('stroke', e => {
        if (!hasSelection) return '#6e7681';
        if (replayIds.has(e.source) && replayIds.has(e.target)) {
          const targetNode = nodesData.find(n => n.id === e.target);
          return targetNode?.typeColor || '#6e7681';
        }
        return '#30363d';
      })
      .attr('stroke-width', e => {
        if (!hasSelection) return 1.5;
        return (replayIds.has(e.source) && replayIds.has(e.target)) ? 2.5 : 1.0;
      });

  }, [selectedId, highlightedIds, replayIds, nodesData]);

  return (
    <div className="w-full h-full bg-bg-center relative text-[13px]">
      <div className="w-full h-full overflow-hidden" ref={containerRef} />
      
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
