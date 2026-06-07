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
        <h2 className="text-[11px] text-[#484f58] uppercase tracking-widest px-1 py-1 mb-1">Namespace</h2>
        <select 
          className="w-full bg-surface border border-border text-[#c9d1d9] p-1.5 rounded-sm outline-none focus:border-accent text-[12px]"
          value={filters.namespace}
          onChange={(e) => onFilterChange({ ...filters, namespace: e.target.value })}
        >
          <option value="alpha-swarm-7">alpha-swarm-7</option>
          <option value="beta-swarm-1">beta-swarm-1</option>
          <option value="global">global</option>
        </select>
      </div>

      <div className="text-[11px] text-[#484f58] tracking-widest uppercase px-3 py-1 mt-1 border-t border-border">
        Agents
      </div>
      <div className="px-3 pb-3 pt-1 flex flex-col gap-2">
        {availableAgents.map(agent => {
          const enabled = filters.agents.includes(agent);
          const color = '#c9d1d9';
          return (
            <div key={agent} className="flex items-center gap-2 hover:text-accent transition-colors" onClick={() => toggleAgent(agent)}>
              <div 
                style={{
                  width: 12, height: 12,
                  borderRadius: 2,
                  border: `1px solid ${color}`,
                  background: enabled ? color + '33' : 'transparent',
                  cursor: 'pointer',
                  flexShrink: 0,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}
              >
                {enabled && <span style={{color: color, fontSize: 9, lineHeight: '12px', display:'block', textAlign:'center'}}>✓</span>}
              </div>
              <span className="truncate cursor-pointer text-[12px]">{agent}</span>
            </div>
          );
        })}
      </div>

      <div className="text-[11px] text-[#484f58] tracking-widest uppercase px-3 py-1 mt-1 border-t border-border">
        Memory Type
      </div>
      <div className="px-3 pb-3 pt-1 flex flex-col gap-2">
        {(Object.keys(typeColors) as MemoryType[]).map(type => {
          const enabled = filters.types.includes(type);
          const color = typeColors[type];
          return (
            <div key={type} className="flex items-center gap-2 transition-colors" style={{ color }} onClick={() => toggleType(type)}>
              <div 
                style={{
                  width: 12, height: 12,
                  borderRadius: 2,
                  border: `1px solid ${color}`,
                  background: enabled ? color + '33' : 'transparent',
                  cursor: 'pointer',
                  flexShrink: 0,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}
              >
                {enabled && <span style={{color: color, fontSize: 9, lineHeight: '12px', display:'block', textAlign:'center'}}>✓</span>}
              </div>
              <span className="capitalize cursor-pointer text-[12px]">{type}</span>
            </div>
          );
        })}
      </div>

      <div className="text-[11px] text-[#484f58] tracking-widest uppercase px-3 py-1 mt-1 border-t border-border">
        Filters
      </div>
      <div className="px-3 pb-3 pt-1">
        <div className="flex items-center gap-2 hover:text-[#f78166] transition-colors text-[#c9d1d9]" onClick={() => onFilterChange({ ...filters, encryptedOnly: !filters.encryptedOnly })}>
          <div 
            style={{
              width: 12, height: 12,
              borderRadius: 2,
              border: `1px solid #f78166`,
              background: filters.encryptedOnly ? '#f7816633' : 'transparent',
              cursor: 'pointer',
              flexShrink: 0,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
          >
            {filters.encryptedOnly && <span style={{color: '#f78166', fontSize: 9, lineHeight: '12px', display:'block', textAlign:'center'}}>✓</span>}
          </div>
          <span className="cursor-pointer text-[12px]">encrypted only</span>
        </div>
      </div>
    </div>
  );
}
