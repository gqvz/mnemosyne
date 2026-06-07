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
      <div className="grid grid-cols-3 gap-3">
        {sortedMemories.map(m => {
          const isSelected = m.blob_id === selectedId;
          const typeStr = getMemoryType(m.memory_type);
          const typeColor = TYPE_COLORS[typeStr];
          
          return (
            <div
              key={m.blob_id}
              onClick={() => onSelect(m)}
              className="flex flex-col rounded-sm cursor-pointer transition-all border"
              style={{
                backgroundColor: isSelected ? '#161b22' : '#0d1117',
                borderColor: typeColor,
                opacity: 1, // wrapper opacity 1
                border: `1px solid ${isSelected ? typeColor : typeColor + '66'}`, // 66 hex is ~40%, cc is ~80%
              }}
              onMouseEnter={(e) => {
                if (!isSelected) {
                  e.currentTarget.style.backgroundColor = '#0f1419';
                  e.currentTarget.style.border = `1px solid ${typeColor + 'b3'}`; // 70% opacity
                }
              }}
              onMouseLeave={(e) => {
                if (!isSelected) {
                  e.currentTarget.style.backgroundColor = '#0d1117';
                  e.currentTarget.style.border = `1px solid ${typeColor + '66'}`;
                }
              }}
            >
              <div className="p-3 pb-2 flex flex-col gap-1.5">
                <div className="flex justify-between items-center">
                  <div 
                    className="text-[10px] uppercase tracking-widest px-1.5 py-0.5 rounded-sm"
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
                
                <div className="text-[#c9d1d9] font-bold text-sm mt-1 truncate">
                  {m.blob_id}
                </div>
              </div>

              <div className="border-t" style={{ borderColor: typeColor + '33' }} />

              <div className="p-3 pt-2 flex flex-col gap-1.5">
                <div className="text-muted text-[11px] truncate" title={m.content_hash}>
                  {m.content_hash}
                </div>
                <div className="text-muted text-[11px]">
                  {new Date(m.timestamp).toISOString().replace('T', ' ').replace(/\.\d+Z$/, 'Z')}
                </div>
                
                <div className="flex justify-between items-center mt-2 text-[11px]">
                  <div className="text-[#c9d1d9]">
                    parents: {m.parent_memories.length}
                  </div>
                  <div className={m.is_encrypted ? "text-[#f78166]" : "text-muted"}>
                    {m.is_encrypted ? '🔒 sealed' : '🔓 public'}
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
