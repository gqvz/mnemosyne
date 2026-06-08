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
      <div className="flex items-center gap-4 text-[#8b949e] flex-shrink-0">
        <span className="font-semibold tracking-tight">mnemosyne</span>
        <span className="font-light text-[#484f58]">—</span>
        <span className="font-medium">browser</span>
      </div>

      <div className="flex items-center gap-4 flex-1 justify-end">
        
        {viewType === 'grid' && (
          <select 
            className="bg-[#0d1117] border border-[#30363d] rounded text-[#c9d1d9] text-[12px] px-2 py-1 outline-none focus:border-accent transition-colors"
            value={sortOrder}
            onChange={(e) => onSortChange(e.target.value as SortOrder)}
            aria-label="Sort order"
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
            className="w-full bg-[#0d1117] border border-[#30363d] rounded text-[#c9d1d9] text-[12px] placeholder-muted px-2.5 py-1 pr-7 outline-none focus:border-accent transition-colors"
            value={searchTerm}
            onChange={(e) => onSearchChange(e.target.value)}
            aria-label="Search memories"
          />
          {searchTerm && (
            <button
              onClick={() => onSearchChange('')}
              className="absolute right-1.5 top-1/2 -translate-y-1/2 text-muted hover:text-[#c9d1d9] transition-colors text-[14px] leading-none w-4 h-4 flex items-center justify-center"
              aria-label="Clear search"
            >
              ×
            </button>
          )}
        </div>

        <div className="flex border border-[#30363d] rounded overflow-hidden flex-shrink-0" role="group" aria-label="View mode">
          {views.map(view => (
            <button
              key={view}
              onClick={() => onViewChange(view)}
              className={`px-3 py-1 text-[12px] font-mono font-medium capitalize transition-all duration-100 active:scale-[0.97] ${
                viewType === view 
                  ? 'bg-accent text-white shadow-sm' 
                  : 'bg-transparent text-muted hover:text-[#c9d1d9] hover:bg-[#1a1f2b]'
              } border-r border-[#30363d] last:border-r-0`}
              aria-pressed={viewType === view}
            >
              {view}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
