import { useEffect, useRef, useState } from 'react';
import type { UIEvent } from 'react';
import { getMemoryType } from '../types';
import type { MemoryIndex } from '../types';

interface LogStreamProps {
  logs: MemoryIndex[];
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
      setUnreadCount(0);
    } else if (logs.length > lastLogCount.current) {
      setUnreadCount(prev => prev + (logs.length - lastLogCount.current));
    }
    
    lastLogCount.current = logs.length;
  }, [logs, isAutoScrollPaused]);

  const handleScroll = (e: UIEvent<HTMLDivElement>) => {
    const target = e.target as HTMLDivElement;
    // Check if we scrolled up significantly
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
          fontSize: 9, color: '#3fb950', letterSpacing: '0.1em',
          display: 'flex', alignItems: 'center', gap: 4,
          fontFamily: '"JetBrains Mono", monospace'
        }}>
          <span style={{
            width: 5, height: 5, borderRadius: '50%',
            background: '#3fb950', display: 'inline-block',
          }} className="animate-pulse" />
          LIVE
        </span>
      </div>

      <div 
        className="w-full h-full overflow-y-auto font-mono text-[12px] px-[10px] pb-[6px]" 
        ref={containerRef}
        onScroll={handleScroll}
      >
        <div className="flex flex-col gap-1.5 pb-2">
          {logs.map((log) => {
            const timeMatch = new Date(log.timestamp).toISOString().match(/T(.*?)Z/);
            const time = timeMatch ? timeMatch[1] : '';
            const typeStr = getMemoryType(log.memory_type);
            const agentColor = getAgentColor(log.agent_address);
            
            return (
              <div key={log.blob_id} className="flex gap-3 hover:bg-surface py-0.5 px-1 -mx-1 rounded-sm transition-colors">
                <span className="text-muted shrink-0">[{time}]</span>
                <span style={{ color: agentColor }} className="shrink-0">
                  [{log.agent_address.length > 12 ? log.agent_address.substring(0, 10) : log.agent_address}]
                </span>
                <span className="text-[#c9d1d9] truncate">
                  write · blob_id=<span className="text-accent">{log.blob_id.substring(0, 10)}</span>... · type={typeStr}
                  {log.is_encrypted ? ' · (encrypted)' : ''}
                </span>
              </div>
            );
          })}
          {logs.length === 0 && (
            <div className="text-muted italic">Waiting for events...</div>
          )}
        </div>
      </div>

      {isAutoScrollPaused && unreadCount > 0 && (
        <button 
          onClick={resumeScroll}
          className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-accent text-[#0d1117] font-bold text-xs px-3 py-1 rounded-sm shadow-md hover:bg-accent/90 transition-colors animate-pulse"
        >
          ↓ {unreadCount} new event{unreadCount !== 1 ? 's' : ''}
        </button>
      )}
    </div>
  );
}
