import { getMemoryType } from '../types';
import type { MemoryIndex } from '../types';

export type SortOrder = 'newest' | 'oldest' | 'by_agent';

interface GridViewProps {
  memories: MemoryIndex[];
  selectedId: string | null;
  onSelect: (memory: MemoryIndex) => void;
  sortOrder: SortOrder;
}

const TYPE_COLORS = {
  observation: '#3fb950',
  decision: '#58a6ff',
  artifact: '#f78166',
  reflection: '#d2a8ff',
};

export default function GridView({ memories, selectedId, onSelect, sortOrder }: GridViewProps) {
  const sortedMemories = [...memories].sort((a, b) => {
    if (sortOrder === 'newest') return b.timestamp - a.timestamp;
    if (sortOrder === 'oldest') return a.timestamp - b.timestamp;
    if (sortOrder === 'by_agent') return a.agent_address.localeCompare(b.agent_address);
    return 0;
  });

  return (
    <div className="w-full h-full overflow-y-auto bg-bg-center p-4">
      <div className="grid gap-3" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))' }} role="list">
        {sortedMemories.map(m => {
          const isSelected = m.blob_id === selectedId;
          const typeStr = getMemoryType(m.memory_type);
          const typeColor = TYPE_COLORS[typeStr];
          
          return (
            <div
              key={m.blob_id}
              role="listitem"
              tabIndex={0}
              onClick={() => onSelect(m)}
              onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onSelect(m); }}}
              className="flex flex-col rounded-sm cursor-pointer transition-all duration-200 active:scale-[0.98] border"
              style={{
                backgroundColor: isSelected ? '#161b22' : '#0d1117',
                border: `1px solid ${isSelected ? typeColor : typeColor + '66'}`,
              }}
              onMouseEnter={(e) => {
                if (!isSelected) {
                  e.currentTarget.style.backgroundColor = '#0f1419';
                  e.currentTarget.style.borderColor = typeColor;
                }
              }}
              onMouseLeave={(e) => {
                if (!isSelected) {
                  e.currentTarget.style.backgroundColor = '#0d1117';
                  e.currentTarget.style.borderColor = typeColor + '66';
                }
              }}
            >
              <div className="p-3 pb-2 flex flex-col gap-1.5">
                <div className="flex justify-between items-center">
                  <div 
                    className="label px-1.5 py-0.5 rounded-sm"
                    style={{ color: typeColor, backgroundColor: typeColor + '1a' }}
                  >
                    {typeStr}
                  </div>
                  <div 
                    className="w-2 h-2 rounded-full"
                    style={{ backgroundColor: typeColor }}
                    title={m.agent_address}
                  />
                </div>
                
                <div className="text-[#c9d1d9] font-semibold text-sm mt-1 truncate">
                  {m.blob_id}
                </div>
                <div style={{ color: typeColor, fontSize: 11, marginTop: 2 }}>
                  {m.agent_address}
                </div>
              </div>

              <div className="border-t" style={{ borderColor: typeColor + '33' }} />

              <div className="p-3 pt-2 flex flex-col gap-1.5">
                <div className="meta truncate" title={m.content_hash}>
                  {m.content_hash}
                </div>
                <div className="meta tabular-nums">
                  {new Date(m.timestamp).toISOString().replace('T', ' ').replace(/\.\d+Z$/, 'Z')}
                </div>
                
                <div className="flex justify-between items-center mt-2 data">
                  <span className="tabular-nums">parents: {m.parent_memories.length}</span>
                  <span className={m.is_encrypted ? "text-[#f78166] font-medium" : "text-muted"}>
                    {m.is_encrypted ? 'sealed' : 'public'}
                  </span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
