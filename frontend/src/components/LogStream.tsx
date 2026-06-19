import { useEffect, useRef, useState } from 'react';
import type { UIEvent } from 'react';
import { getMemoryType } from '../types';
import type { MemoryIndex } from '../types';

interface LogStreamProps {
  logs: MemoryIndex[];
}

function fmtLogTime(isoString: string | number): string {
  const d = new Date(isoString);
  const h = String(d.getHours()).padStart(2, '0');
  const m = String(d.getMinutes()).padStart(2, '0');
  const s = String(d.getSeconds()).padStart(2, '0');
  const ms = String(d.getMilliseconds()).padStart(3, '0');
  return `[${h}:${m}:${s}.${ms}]`;
}

export default function LogStream({ logs }: LogStreamProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [isAutoScrollPaused, setIsAutoScrollPaused] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const lastLogCount = useRef(logs.length);

  useEffect(() => {
    if (!containerRef.current) return;
    
    if (!isAutoScrollPaused) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight;
      setTimeout(() => setUnreadCount(0), 0);
    } else if (logs.length > lastLogCount.current) {
      const diff = logs.length - lastLogCount.current;
      setTimeout(() => {
        setUnreadCount(prev => prev + diff);
      }, 0);
    }
    
    lastLogCount.current = logs.length;
  }, [logs, isAutoScrollPaused]);

  const handleScroll = (e: UIEvent<HTMLDivElement>) => {
    const target = e.target as HTMLDivElement;
    const isAtBottom = target.scrollHeight - target.scrollTop - target.clientHeight < 50;
    
    if (isAtBottom && isAutoScrollPaused) {
      setIsAutoScrollPaused(false);
      setUnreadCount(0);
    } else if (!isAtBottom && !isAutoScrollPaused) {
      setIsAutoScrollPaused(true);
    }
  };

  const resumeScroll = () => {
    if (containerRef.current) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight;
      setIsAutoScrollPaused(false);
      setUnreadCount(0);
    }
  };

  const getAgentColor = (agentId: string) => {
    const lower = agentId.toLowerCase();
    if (lower.includes('scout')) return '#3fb950';
    if (lower.includes('strategist')) return '#58a6ff';
    if (lower.includes('executor')) return '#f78166';
    return '#c9d1d9';
  };

  return (
    <div className="h-[150px] border-t border-border-heavy bg-bg-log relative flex flex-col">
      <div style={{
        position: 'sticky', top: 0,
        display: 'flex', justifyContent: 'flex-end',
        padding: '6px 10px 4px',
        zIndex: 10
      }}>
        <span style={{
          fontSize: 10, fontWeight: 600, color: '#3fb950', letterSpacing: '0.12em',
          display: 'flex', alignItems: 'center', gap: 6,
          fontFamily: '"JetBrains Mono", monospace', textTransform: 'uppercase'
        }}>
          <span style={{
            width: 5, height: 5, borderRadius: '50%',
            background: '#3fb950', display: 'inline-block',
          }} className="animate-pulse" />
          LIVE
        </span>
      </div>

      <div className="w-full h-full overflow-y-auto font-mono text-[12px] px-[10px] pb-[6px]" 
        ref={containerRef}
        onScroll={handleScroll}
      >
        <div className="flex flex-col gap-1.5 pb-2">
          {[...logs].reverse().map((log) => {
            const typeStr = getMemoryType(log.memory_type);
            const agentColor = getAgentColor(log.agent_address);
            
            return (
              <div key={log.blob_id} className="flex gap-3 hover:bg-surface py-0.5 px-1 -mx-1 rounded-sm transition-colors items-baseline">
                <span className="text-muted shrink-0 tabular-nums">{fmtLogTime(log.timestamp)}</span>
                <span style={{ color: agentColor }} className="shrink-0 font-semibold">
                  [{log.agent_address.length > 16 ? `${log.agent_address.slice(0, 8)}...${log.agent_address.slice(-4)}` : log.agent_address}]
                </span>
                <span className="text-[#c9d1d9] truncate">
                  write · blob_id=<span className="text-accent font-medium">{log.blob_id.substring(0, 10)}</span>... · type=<span className="font-medium">{typeStr}</span>
                  {log.is_encrypted ? ' · (encrypted)' : ''}
                </span>
              </div>
            );
          })}
          {logs.length === 0 && (
            <div className="flex flex-col items-center justify-center py-8 gap-2">
              <span className="data text-muted">No events yet</span>
              <span className="meta text-center leading-relaxed">Memory write events from agents will appear here in real time</span>
            </div>
          )}
        </div>
      </div>

      {isAutoScrollPaused && unreadCount > 0 && (
        <button 
          onClick={resumeScroll}
          className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-accent text-[#0d1117] font-bold text-xs px-3 py-1 rounded-sm shadow-md hover:bg-accent/90 transition-all duration-150 active:scale-[0.97] animate-pulse"
        >
          ↓ {unreadCount} new event{unreadCount !== 1 ? 's' : ''}
        </button>
      )}
    </div>
  );
}
