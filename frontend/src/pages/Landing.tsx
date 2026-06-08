import { Link } from 'react-router-dom';
import '../landing.css';

const STYLE = `
@keyframes f0{0%,100%{transform:translate(0,0)}50%{transform:translate(0,-8px)}}
@keyframes f1{0%,100%{transform:translate(0,0)}50%{transform:translate(0,-6px)}}
@keyframes f2{0%,100%{transform:translate(0,0)}50%{transform:translate(0,-10px)}}
@keyframes f3{0%,100%{transform:translate(0,0)}50%{transform:translate(0,-5px)}}
@keyframes f4{0%,100%{transform:translate(0,0)}50%{transform:translate(0,-9px)}}
@keyframes f5{0%,100%{transform:translate(0,0)}50%{transform:translate(0,-7px)}}
@keyframes f6{0%,100%{transform:translate(0,0)}50%{transform:translate(0,-11px)}}
@keyframes f7{0%,100%{transform:translate(0,0)}50%{transform:translate(0,-6px)}}
@keyframes dash{to{stroke-dashoffset:-16}}
`;

const NODES = [
  { id:'obs_a', type:'observation', x:60,  y:80  },
  { id:'obs_b', type:'observation', x:55,  y:180 },
  { id:'obs_c', type:'observation', x:65,  y:280 },
  { id:'obs_d', type:'observation', x:40,  y:130 },
  { id:'dec_a', type:'decision',    x:210, y:170 },
  { id:'dec_b', type:'decision',    x:200, y:80  },
  { id:'art_a', type:'artifact',    x:330, y:140 },
  { id:'ref_a', type:'reflection',  x:390, y:270 },
] as const;

const EDGES = [
  [0,4],[1,4],[2,4],[3,5],[4,6],[5,6],[6,7]
];

const C: Record<string, string> = {
  observation:'#3fb950', decision:'#58a6ff',
  artifact:'#f78166',   reflection:'#d2a8ff',
};
const BG: Record<string, string> = {
  observation:'rgba(63,185,80,0.08)',  decision:'rgba(88,166,255,0.08)',
  artifact:'rgba(247,129,102,0.08)',   reflection:'rgba(210,168,255,0.08)',
};

function HeroGraph() {
  return (
    <svg viewBox="0 0 460 380" width="100%" height="100%" style={{display:'block'}}>
      <style>{STYLE}</style>
      {/* Edges */}
      {EDGES.map(([si,ti],i) => {
        const s=NODES[si], t=NODES[ti];
        return <path key={i}
          d={`M${s.x},${s.y} Q${(s.x+t.x)/2},${(s.y+t.y)/2} ${t.x},${t.y}`}
          stroke="#30363d" strokeWidth="1" fill="none"
          strokeDasharray="4,4"
          style={{animation:`dash 2s linear infinite`, animationDelay:`${i*0.15}s`}}
        />;
      })}
      {/* Nodes */}
      {NODES.map((n,i) => (
        <g key={n.id} style={{animation:`f${i} ${3+i*0.25}s ease-in-out infinite`, animationDelay:`${i*0.35}s`}}>
          <rect x={n.x-39} y={n.y-11} width={78} height={22} rx={3}
            fill={BG[n.type]} stroke={C[n.type]} strokeWidth={1}/>
          <text x={n.x} y={n.y} textAnchor="middle" dominantBaseline="middle"
            fontSize={10} fontFamily="'JetBrains Mono',monospace" fill={C[n.type]}>
            {n.id}
          </text>
        </g>
      ))}
    </svg>
  );
}

export default function Landing() {
  return (
    <div className="landing-root">
      
      {/* HERO */}
      <section className="hero">
        <div style={{ position: 'relative', zIndex: 1 }}>
          <div style={{ fontSize: 13, color: '#3fb950', marginBottom: 16, letterSpacing: '0.05em' }}>
            {'>'} mnemosyne_
            <span style={{ animation: 'blink 1s step-end infinite' }}>_</span>
          </div>

          <h1 style={{
            fontSize: 42,
            fontFamily: "'JetBrains Mono', monospace",
            fontWeight: 400,
            color: '#c9d1d9',
            lineHeight: 1.3,
            margin: '0 0 16px',
            maxWidth: 560,
            wordBreak: 'keep-all',
          }}>
            persistent memory fabric<br/>
            for autonomous agent swarms.
          </h1>

          <p style={{
            fontSize: 16,
            color: '#6e7681',
            margin: '0 0 36px',
            fontFamily: "'JetBrains Mono', monospace",
          }}>
            agents forget. mnemosyne doesn't.
          </p>

          <div style={{ display: 'flex', gap: 12, marginBottom: 48 }}>
            <Link to="/browser" className="cta-primary">[ Launch Memory Browser → ]</Link>
            <Link to="/docs" className="cta-secondary">[ Read the Docs → ]</Link>
          </div>

          <div style={{ display: 'flex', gap: 20, alignItems: 'center' }}>
            <span style={{ display:'flex', alignItems:'center', gap:6, fontSize:12, color:'#3fb950' }}>
              <span style={{
                width:6, height:6, borderRadius:'50%', background:'#3fb950', display:'inline-block',
                animation:'pulse 1.5s infinite'
              }}/>
              live on sui testnet
            </span>
            <span style={{ fontSize:12, color:'#484f58', fontFamily:"'JetBrains Mono', monospace" }}>
              pkg: 0xcc22...8d77
            </span>
          </div>
        </div>

        <div style={{ position: 'relative', zIndex: 1, height: '400px' }}>
          <HeroGraph />
        </div>
      </section>

      <style>{`
        @keyframes blink { 0%,100%{opacity:1} 50%{opacity:0} }
        @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.3} }
      `}</style>

      {/* FOOTER */}
      <footer className="footer">
        <div className="footer-inner">
          <span className="footer-brand">mnemosyne</span>
          <span className="footer-sep">·</span>
          <span className="footer-sub">sui overflow 2026 · walrus track</span>
          <div className="footer-links">
            <a href="https://github.com/" target="_blank" rel="noreferrer">github</a>
            <Link to="/browser">launch app</Link>
            <a href="#" style={{ color: '#484f58', cursor: 'default' }}>pkg: 0xcc22...8d77</a>
          </div>
          <span className="footer-sub">MIT License</span>
        </div>
      </footer>

    </div>
  );
}
