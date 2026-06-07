import type { SortOrder } from './GridView';

export type ViewType = 'causal' | 'timeline' | 'grid';

interface TopBarProps {
  searchTerm: string;
  onSearchChange: (term: string) => void;
  viewType: ViewType;
  onViewChange: (view: ViewType) => void;
  sortOrder: SortOrder;
  onSortChange: (sort: SortOrder) => void;
}

export default function TopBar({ searchTerm, onSearchChange, viewType, onViewChange, sortOrder, onSortChange }: TopBarProps) {
  const views: ViewType[] = ['causal', 'timeline', 'grid'];

  return (
    <div className="bg-bg-topbar border-b border-border-heavy px-3 h-[36px] flex items-center justify-between font-mono text-sm gap-2.5">
      <div className="flex items-center gap-4 text-muted flex-shrink-0">
        <span>mnemosyne</span>
        <span>—</span>
        <span>browser</span>
      </div>

      <div className="flex items-center gap-4 flex-1 justify-end">
        
        {viewType === 'grid' && (
          <select 
            className="bg-[#0d1117] border border-[#30363d] rounded text-[#c9d1d9] text-[12px] px-2 py-1 outline-none focus:border-accent transition-colors"
            value={sortOrder}
            onChange={(e) => onSortChange(e.target.value as SortOrder)}
          >
            <option value="newest">newest</option>
            <option value="oldest">oldest</option>
            <option value="by_agent">by agent</option>
          </select>
        )}

        <div className="relative flex-1 max-w-sm">
          <input 
            type="text" 
            placeholder="Search blob_id or agent..."
            className="w-full bg-[#0d1117] border border-[#30363d] rounded text-[#c9d1d9] text-[12px] placeholder-muted px-2.5 py-1 outline-none focus:border-accent transition-colors"
            value={searchTerm}
            onChange={(e) => onSearchChange(e.target.value)}
          />
        </div>

        <div className="flex border border-[#30363d] rounded overflow-hidden flex-shrink-0">
          {views.map(view => (
            <button
              key={view}
              onClick={() => onViewChange(view)}
              className={`px-3 py-1 text-[12px] font-mono capitalize transition-colors ${
                viewType === view 
                  ? 'bg-[#1c2d45] text-[#58a6ff]' 
                  : 'bg-transparent text-muted hover:text-[#c9d1d9]'
              } border-r border-[#30363d] last:border-r-0`}
            >
              {view}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
