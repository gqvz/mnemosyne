import type { MemoryType } from '../types';

export interface FilterState {
  namespace: string;
  agents: string[];
  types: MemoryType[];
  encryptedOnly: boolean;
}

interface SidebarProps {
  filters: FilterState;
  onFilterChange: (filters: FilterState) => void;
  availableAgents: string[];
}

export default function Sidebar({ filters, onFilterChange, availableAgents }: SidebarProps) {
  const toggleAgent = (agent: string) => {
    const newAgents = filters.agents.includes(agent)
      ? filters.agents.filter(a => a !== agent)
      : [...filters.agents, agent];
    onFilterChange({ ...filters, agents: newAgents });
  };

  const toggleType = (type: MemoryType) => {
    const newTypes = filters.types.includes(type)
      ? filters.types.filter(t => t !== type)
      : [...filters.types, type];
    onFilterChange({ ...filters, types: newTypes });
  };

  const typeColors: Record<MemoryType, string> = {
    observation: '#3fb950',
    decision: '#58a6ff',
    artifact: '#f78166',
    reflection: '#d2a8ff'
  };

  return (
    <div className="w-[200px] h-full bg-bg-sidebar border-r border-border-heavy flex flex-col font-mono text-[12px] overflow-y-auto">
      <div className="p-3">
        <h2 className="label pb-1 mb-1">Namespace</h2>
        <input 
          type="text"
          placeholder="Enter Namespace ID..."
          className="w-full bg-surface border border-border text-[#c9d1d9] p-1.5 rounded-sm outline-none focus:border-accent text-[12px] font-medium"
          value={filters.namespace}
          onChange={(e) => onFilterChange({ ...filters, namespace: e.target.value })}
        />
      </div>

      <div className="label mt-1 border-t border-border px-3 pt-2 pb-1">Agents</div>
      <div className="px-3 pb-3 pt-1 flex flex-col gap-2" role="list">
        {availableAgents.map(agent => {
          const enabled = filters.agents.includes(agent);
          const color = '#c9d1d9';
          return (
            <div
              key={agent}
              role="listitem"
              tabIndex={0}
              className="flex items-center gap-2 hover:text-accent transition-all duration-150 active:scale-[0.97] select-none interactive-row py-0.5"
              onClick={() => toggleAgent(agent)}
              onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggleAgent(agent); }}}
              aria-pressed={enabled}
            >
              <div 
                style={{
                  width: 12, height: 12,
                  borderRadius: 2,
                  border: `1px solid ${color}`,
                  background: enabled ? color : 'transparent',
                  flexShrink: 0,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}
              >
                {enabled && <span style={{color: '#0d1117', fontSize: 9, lineHeight: '12px', display:'block', textAlign:'center'}}>✓</span>}
              </div>
              <span className="truncate font-medium" title={agent}>
                {agent.length > 20 ? `${agent.slice(0, 8)}...${agent.slice(-4)}` : agent}
              </span>
            </div>
          );
        })}
      </div>

      <div className="label mt-1 border-t border-border px-3 pt-2 pb-1">Memory Type</div>
      <div className="px-3 pb-3 pt-1 flex flex-col gap-2" role="list">
        {(Object.keys(typeColors) as MemoryType[]).map(type => {
          const enabled = filters.types.includes(type);
          const color = typeColors[type];
          return (
            <div
              key={type}
              role="listitem"
              tabIndex={0}
              className="flex items-center gap-2 transition-all duration-150 font-medium active:scale-[0.97] select-none interactive-row py-0.5"
              style={{ color }}
              onClick={() => toggleType(type)}
              onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggleType(type); }}}
              aria-pressed={enabled}
            >
              <div 
                style={{
                  width: 12, height: 12,
                  borderRadius: 2,
                  border: `1px solid ${color}`,
                  background: enabled ? color : 'transparent',
                  flexShrink: 0,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}
              >
                {enabled && <span style={{color: '#0d1117', fontSize: 9, lineHeight: '12px', display:'block', textAlign:'center'}}>✓</span>}
              </div>
              <span className="capitalize">{type}</span>
            </div>
          );
        })}
      </div>

      <div className="label mt-1 border-t border-border px-3 pt-2 pb-1">Filters</div>
      <div className="px-3 pb-3 pt-1">
        <div
          role="switch"
          tabIndex={0}
          className="flex items-center gap-2 hover:text-[#f78166] transition-all duration-150 active:scale-[0.97] select-none interactive-row py-0.5 text-[#c9d1d9] font-medium"
          onClick={() => onFilterChange({ ...filters, encryptedOnly: !filters.encryptedOnly })}
          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onFilterChange({ ...filters, encryptedOnly: !filters.encryptedOnly }); }}}
          aria-checked={filters.encryptedOnly}
        >
          <div 
            style={{
              width: 12, height: 12,
              borderRadius: 2,
              border: `1px solid #f78166`,
              background: filters.encryptedOnly ? '#f78166' : 'transparent',
              flexShrink: 0,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
          >
            {filters.encryptedOnly && <span style={{color: '#0d1117', fontSize: 9, lineHeight: '12px', display:'block', textAlign:'center'}}>✓</span>}
          </div>
          <span>encrypted only</span>
        </div>
      </div>
    </div>
  );
}
