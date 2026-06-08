import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import '../landing.css';
import { CodeBlock } from '../components/CodeBlock';

const NAV = [
  { id: 'overview',      label: 'overview'       },
  { id: 'problem',       label: 'the problem'    },
  { id: 'how-it-works',  label: 'how it works'   },
  { id: 'architecture',  label: 'architecture'   },
  { id: 'api-reference', label: 'api reference'  },
  { id: 'sdk',           label: 'sdk usage'      },
  { id: 'contracts',     label: 'move contracts' },
  { id: 'security',      label: 'security'       },
  { id: 'quickstart',    label: 'quickstart'     },
];

function DocSection({ id, label, children }: { id: string, label: string, children: React.ReactNode }) {
  return (
    <section id={id} style={{ marginBottom: 60 }}>
      <div style={{ fontSize:11, color:'#388bfd', marginBottom:8, letterSpacing:'0.08em' }}>
        // {label}
      </div>
      <div style={{ borderTop:'1px solid #21262d', paddingTop:24 }}>
        {children}
      </div>
    </section>
  );
}
const codeString = `// connect to your agent swarm
const client = new MnemosyneClient({ suiRpcUrl, walrusAggregatorUrl });
const ns = await client.createNamespace('my-swarm');

// scout agent writes an observation
await ns.writeMemory({
  type: 'observation',
  content: { price: 1.847, source: 'deepbook' },
  parentIds: [],
});

// strategist reads + acts
const memories = await ns.listMemories({ type: 'observation' });`;

export default function Docs() {
  const [activeId, setActiveId] = useState('overview');

  useEffect(() => {
    const sections = NAV.map(n => document.getElementById(n.id)).filter(Boolean);
    
    const observer = new IntersectionObserver(
      entries => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            setActiveId(entry.target.id);
          }
        });
      },
      {
        rootMargin: '-20% 0px -70% 0px',
        threshold: 0,
      }
    );

    sections.forEach(s => observer.observe(s!));
    return () => observer.disconnect();
  }, []);

  const scrollToSection = (id: string) => {
    const el = document.getElementById(id);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth' });
    }
  };

  return (
    <div className="docs-root">
      <div className="docs-topbar">
        <span style={{color:'#6e7681'}}>mnemosyne</span>
        <span style={{color:'#30363d'}}>—</span>
        <span style={{color:'#c9d1d9'}}>docs</span>
        <Link to="/browser" style={{
          marginLeft:'auto', fontSize:11,
          color:'#6e7681', textDecoration:'none',
          border:'1px solid #30363d', padding:'2px 10px', borderRadius:3,
        }}>
          ← memory browser
        </Link>
        <Link to="/" style={{
          fontSize:11, color:'#6e7681', textDecoration:'none',
          border:'1px solid #30363d', padding:'2px 10px', borderRadius:3,
        }}>
          ← landing
        </Link>
      </div>

      <div className="docs-body">
        <div className="docs-sidebar">
          {NAV.map(({ id, label }) => (
            <div
              key={id}
              className={`nav-item ${activeId === id ? 'active' : ''}`}
              onClick={() => scrollToSection(id)}
            >
              {label}
            </div>
          ))}
        </div>

        <div className="docs-content">
          <div style={{ maxWidth: 760, margin: '0 auto' }}>
          
          <DocSection id="overview" label="overview">
            <h2 className="doc-h2">Mnemosyne</h2>
            <p className="doc-p">
              Persistent memory fabric for autonomous agent swarms.
              Agents write observations, decisions, and artifacts to Walrus as structured blobs —
              each cryptographically signed, timestamped, and linked in a causal chain.
            </p>
            <p className="doc-p">
              A Sui Move <code>MemoryIndex</code> object on-chain points to each blob,
              making agent memory composable with Sui DeFi.
              Multiple agents share a Walrus-backed namespace.
            </p>
            <div style={{
              background:'#0d1117', border:'1px solid #21262d',
              borderRadius:3, padding:'12px 16px', marginTop:16,
              fontSize:12, color:'#3fb950',
            }}>
              ● live on sui testnet · pkg: 0xcc2267a846f2a3cea8967bb38b27070f8fd0ac0d77faef4063e1bed9b6ad8d77
            </div>
          </DocSection>

          <DocSection id="problem" label="the problem">
            <table className="problem-table">
              <thead>
                <tr>
                  <th>PROBLEM</th>
                  <th>TODAY</th>
                  <th>MNEMOSYNE</th>
                </tr>
              </thead>
              <tbody>
                <tr><td>Amnesia</td><td>restart = blank slate</td><td>walrus blobs persist indefinitely</td></tr>
                <tr><td>Silos</td><td>agent A ≠ agent B</td><td>shared namespace, any agent reads/writes</td></tr>
                <tr><td>Unverifiable</td><td>can't prove what agent knew</td><td>content hash + sui clock timestamp</td></tr>
                <tr><td>Platform lock-in</td><td>memory trapped in provider</td><td>decentralized, user-owned data</td></tr>
                <tr><td>No audit trail</td><td>black box decisions</td><td>causal chain, full verifiable replay</td></tr>
              </tbody>
            </table>
          </DocSection>

          <DocSection id="how-it-works" label="how it works">
            <ol style={{ paddingLeft:20, color:'#6e7681', fontSize:13, lineHeight:2 }}>
              <li><span style={{color:'#c9d1d9'}}>Agents write to Walrus</span> — observations, decisions, artifacts written as content-addressed blobs</li>
              <li><span style={{color:'#c9d1d9'}}>Index registered on-chain</span> — Sui Move MemoryIndex object created per blob with hash + timestamp</li>
              <li><span style={{color:'#c9d1d9'}}>Any agent reads + verifies</span> — shared namespace, availability proofs guarantee integrity</li>
            </ol>
          </DocSection>

          <DocSection id="architecture" label="architecture">
            <div className="arch-diagram">
              <svg viewBox="0 0 760 280" width="100%" style={{ maxWidth: '760px' }}>
                <rect x="180" y="20" width="440" height="220" rx="4" fill="none" stroke="#21262d" strokeDasharray="6,4"/>
                <text x="190" y="38" fill="#484f58" fontFamily="'JetBrains Mono', monospace" fontSize="10" letterSpacing="0.08em">SHARED WALRUS NAMESPACE</text>
                <rect x="200" y="55" width="80" height="22" rx="3" fill="rgba(63,185,80,0.1)" stroke="#3fb950"/>
                <text x="240" y="70" textAnchor="middle" fill="#3fb950" fontFamily="'JetBrains Mono', monospace" fontSize="10">obs_7a3f</text>
                <rect x="200" y="90" width="80" height="22" rx="3" fill="rgba(63,185,80,0.1)" stroke="#3fb950"/>
                <text x="240" y="105" textAnchor="middle" fill="#3fb950" fontFamily="'JetBrains Mono', monospace" fontSize="10">obs_2c1b</text>
                <rect x="200" y="125" width="80" height="22" rx="3" fill="rgba(63,185,80,0.1)" stroke="#3fb950"/>
                <text x="240" y="140" textAnchor="middle" fill="#3fb950" fontFamily="'JetBrains Mono', monospace" fontSize="10">obs_f9d2</text>
                <path d="M280,66 C320,66 320,116 360,116" stroke="#30363d" fill="none" markerEnd="url(#arr)"/>
                <path d="M280,101 C320,101 320,116 360,116" stroke="#30363d" fill="none" markerEnd="url(#arr)"/>
                <path d="M280,136 C320,136 320,116 360,116" stroke="#30363d" fill="none" markerEnd="url(#arr)"/>
                <rect x="360" y="104" width="90" height="24" rx="3" fill="rgba(88,166,255,0.1)" stroke="#58a6ff"/>
                <text x="405" y="120" textAnchor="middle" fill="#58a6ff" fontFamily="'JetBrains Mono', monospace" fontSize="10">dec_44ab</text>
                <text x="405" y="132" textAnchor="middle" fill="#388bfd" fontFamily="'JetBrains Mono', monospace" fontSize="8">encrypted</text>
                <line x1="450" y1="116" x2="490" y2="116" stroke="#30363d" markerEnd="url(#arr)"/>
                <rect x="490" y="104" width="90" height="24" rx="3" fill="rgba(247,129,102,0.1)" stroke="#f78166"/>
                <text x="535" y="120" textAnchor="middle" fill="#f78166" fontFamily="'JetBrains Mono', monospace" fontSize="10">art_9c7e</text>
                <path d="M535,128 L535,175" stroke="#30363d" fill="none" markerEnd="url(#arr)"/>
                <rect x="490" y="175" width="90" height="24" rx="3" fill="rgba(210,168,255,0.1)" stroke="#d2a8ff"/>
                <text x="535" y="191" textAnchor="middle" fill="#d2a8ff" fontFamily="'JetBrains Mono', monospace" fontSize="10">ref_01bb</text>
                <text x="60"  y="260" textAnchor="middle" fill="#484f58" fontFamily="'JetBrains Mono', monospace" fontSize="11">scout-01</text>
                <text x="240" y="260" textAnchor="middle" fill="#484f58" fontFamily="'JetBrains Mono', monospace" fontSize="11">writes obs</text>
                <text x="405" y="260" textAnchor="middle" fill="#484f58" fontFamily="'JetBrains Mono', monospace" fontSize="11">strategist-01</text>
                <text x="535" y="260" textAnchor="middle" fill="#484f58" fontFamily="'JetBrains Mono', monospace" fontSize="11">executor-01</text>
                <rect x="20" y="55" width="80" height="150" rx="3" fill="none" stroke="#21262d" strokeDasharray="3,3"/>
                <text x="60" y="140" textAnchor="middle" fill="#3fb950" fontFamily="'JetBrains Mono', monospace" fontSize="10" transform="rotate(-90,60,140)">Scout Agent</text>
                <line x1="100" y1="116" x2="195" y2="116" stroke="#21262d" strokeDasharray="4,4" markerEnd="url(#arr-muted)"/>
                <defs>
                  <marker id="arr" markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto">
                    <path d="M0,0 L6,3 L0,6 Z" fill="#30363d"/>
                  </marker>
                  <marker id="arr-muted" markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto">
                    <path d="M0,0 L6,3 L0,6 Z" fill="#21262d"/>
                  </marker>
                </defs>
                <text x="405" y="98" textAnchor="middle" fill="#484f58" fontFamily="'JetBrains Mono', monospace" fontSize="9">MemoryIndex ↑</text>
                <text x="535" y="98" textAnchor="middle" fill="#484f58" fontFamily="'JetBrains Mono', monospace" fontSize="9">MemoryIndex ↑</text>
              </svg>
            </div>
          </DocSection>

          <DocSection id="api-reference" label="api reference">
            <h2 className="doc-h2">Move Contract API</h2>
            {[
              {
                name: 'memory::create_namespace',
                sig: 'create_namespace(name: vector<u8>, clock: &Clock, ctx: &mut TxContext): Namespace',
                desc: 'Creates a shared namespace for an agent swarm. Emits NamespaceCreated.',
              },
              {
                name: 'memory::register_agent',
                sig: 'register_agent(namespace: &mut Namespace, agent_address: address, role: vector<u8>, clock: &Clock, ctx: &mut TxContext): AgentRegistration',
                desc: 'Registers an agent address with a role. Only namespace owner can call. Roles: "scout" | "strategist" | "executor".',
              },
              {
                name: 'memory::write_memory',
                sig: 'write_memory(namespace: &mut Namespace, blob_id: vector<u8>, content_hash: vector<u8>, memory_type: u8, parent_count: u32, is_encrypted: bool, clock: &Clock, ctx: &mut TxContext): MemoryIndex',
                desc: 'Writes an on-chain MemoryIndex pointing to a Walrus blob. Memory types: 0=observation, 1=decision, 2=artifact, 3=reflection.',
              },
            ].map(fn => (
              <div key={fn.name} style={{
                border:'1px solid #21262d', borderRadius:3,
                marginBottom:16, overflow:'hidden',
              }}>
                <div style={{
                  background:'#161b22', padding:'8px 14px',
                  borderBottom:'1px solid #21262d',
                  color:'#58a6ff', fontSize:13,
                }}>
                  {fn.name}
                </div>
                <div style={{ padding:'12px 14px' }}>
                  <CodeBlock language="rust" code={fn.sig} />
                  <p style={{ fontSize:12, color:'#6e7681', margin:0 }}>{fn.desc}</p>
                </div>
              </div>
            ))}
          </DocSection>

          <DocSection id="sdk" label="sdk usage">
            <h3 className="doc-h3">MnemosyneClient</h3>
            
            <div style={{
              display: 'grid',
              gridTemplateColumns: '260px 160px 1fr',
              gap: '12px 16px',
              padding: '4px 0 8px',
              borderBottom: '1px solid #30363d',
              fontSize: 10,
              color: '#484f58',
              letterSpacing: '0.08em',
              textTransform: 'uppercase',
            }}>
              <span>method</span>
              <span>returns</span>
              <span>description</span>
            </div>

            {[
              { method: 'createNamespace(name: string)',           returns: 'Promise<Namespace>',      desc: 'Creates a new shared namespace on-chain' },
              { method: 'listMemories(filters?: MemoryFilter)',    returns: 'Promise<MemoryIndex[]>',  desc: 'Lists all memories in namespace, optional filter by type/agent' },
              { method: 'getBlob(blobId: string)',                 returns: 'Promise<ArrayBuffer>',    desc: 'Fetches raw blob content from Walrus aggregator' },
              { method: 'verifyBlob(blobId, contentHash)',         returns: 'Promise<boolean>',        desc: 'Verifies blob content hash matches on-chain record' },
              { method: 'writeMemory(opts: WriteMemoryOpts)',      returns: 'Promise<MemoryIndex>',    desc: 'Writes a new memory blob to Walrus + registers on-chain' },
            ].map(m => (
              <div key={m.method} style={{
                display: 'grid',
                gridTemplateColumns: '260px 160px 1fr',
                gap: '12px 16px',
                padding: '8px 0',
                borderBottom: '1px solid #21262d',
                fontSize: 12,
                alignItems: 'start',
              }}>
                <code style={{color:'#3fb950'}}>{m.method}</code>
                <code style={{color:'#58a6ff'}}>{m.returns}</code>
                <span style={{color:'#6e7681'}}>{m.desc}</span>
              </div>
            ))}

            <CodeBlock language="typescript" code={codeString} />
          </DocSection>

          <DocSection id="contracts" label="move contracts">
            <h2 className="doc-h2">Contract Structure</h2>
            <CodeBlock language="bash" code={`mnemosyne_contracts/
├── Move.toml
├── sources/
│   └── memory.move   # Namespace, MemoryIndex, AgentRegistration
└── tests/
    └── memory_tests.move`} />

            <h3 className="doc-h3">Memory Types</h3>
            {[
              { val:'0', name:'observation', color:'#3fb950', desc:'Raw data captured from environment — prices, events, oracle feeds' },
              { val:'1', name:'decision',    color:'#58a6ff', desc:'Strategic choice made by an agent based on observations' },
              { val:'2', name:'artifact',    color:'#f78166', desc:'Output produced — transactions, documents, computed results' },
              { val:'3', name:'reflection',  color:'#d2a8ff', desc:'Post-hoc analysis of decisions and their outcomes' },
            ].map(t => (
              <div key={t.val} style={{
                display:'flex', gap:12, padding:'8px 0',
                borderBottom:'1px solid #21262d', fontSize:12, alignItems:'center',
              }}>
                <span style={{
                  width:18, textAlign:'center', color:t.color,
                  border:`1px solid ${t.color}`, borderRadius:2, padding:'1px 4px',
                }}>{t.val}</span>
                <span style={{color:t.color, width:90}}>{t.name}</span>
                <span style={{color:'#6e7681'}}>{t.desc}</span>
              </div>
            ))}
          </DocSection>

          <DocSection id="security" label="security">
            <h2 className="doc-h2">Security Model</h2>
            {[
              { label:'Seal encryption',       desc:'Sensitive Decision/Artifact memories encrypted with policy-based access control. Access is revocable.' },
              { label:'Content-addressed',     desc:'blob_id = SHA-256(content). Any tampering is instantly detectable by comparing against on-chain hash.' },
              { label:'On-chain timestamps',   desc:'Sui Clock provides cryptographic proof of when a memory was created. Cannot be backdated.' },
              { label:'Owner-gated actions',   desc:'Only namespace owner can register agents. Prevents unauthorized agents joining a swarm.' },
            ].map(s => (
              <div key={s.label} style={{
                padding:'14px 0', borderBottom:'1px solid #21262d',
              }}>
                <div style={{fontSize:13, color:'#c9d1d9', marginBottom:4}}>→ {s.label}</div>
                <div style={{fontSize:12, color:'#6e7681'}}>{s.desc}</div>
              </div>
            ))}
          </DocSection>

          <DocSection id="quickstart" label="quickstart">
            <h2 className="doc-h2">SDK Quickstart</h2>
            <p className="doc-p">
              Get started writing and reading agent memories with the Mnemosyne TypeScript SDK.
              Assumes you have a deployed namespace on Sui testnet.
            </p>

            <h3 className="doc-h3">Install</h3>
            <CodeBlock language="bash" code={`npm install @mnemosyne/sdk`} />

            <h3 className="doc-h3">Initialize client</h3>
            <CodeBlock language="typescript" code={`import { MnemosyneClient } from '@mnemosyne/sdk';

const client = new MnemosyneClient({
  suiRpcUrl: 'https://fullnode.testnet.sui.io',
  walrusAggregatorUrl: 'https://aggregator.walrus-testnet.walrus.space',
  packageId: '0xcc2267a846f2a3cea8967bb38b27070f8fd0ac0d77faef4063e1bed9b6ad8d77',
  privateKey: process.env.SUI_PRIVATE_KEY,
});

// connect to existing namespace
const ns = await client.getNamespace('your-namespace-id');`} />

            <h3 className="doc-h3">Write an observation</h3>
            <CodeBlock language="typescript" code={`// scout agent writes oracle data
const memory = await ns.writeMemory({
  type: 'observation',
  content: {
    source: 'deepbook',
    pair: 'SUI/USDC',
    price: 1.847,
    timestamp: Date.now(),
    volume_24h: 4200000,
  },
  parentIds: [],           // no parents — root observation
  encrypt: false,          // public observation
});

console.log(memory.blobId);     // sha256 content-addressed id
console.log(memory.onChainIdx); // Sui object ID of MemoryIndex`} />

            <h3 className="doc-h3">Read observations and make a decision</h3>
            <CodeBlock language="typescript" code={`// strategist reads scout observations
const observations = await ns.listMemories({
  type: 'observation',
  agent: 'scout-01',
  limit: 10,
});

// parse content from walrus blobs
const prices = await Promise.all(
  observations.map(async obs => {
    const blob = await client.getBlob(obs.blobId);
    return JSON.parse(new TextDecoder().decode(blob));
  })
);

// write a decision based on observations
const decision = await ns.writeMemory({
  type: 'decision',
  content: {
    action: 'long',
    asset: 'SUI/USDC',
    confidence: 0.87,
    reasoning: 'price below 30d avg, volume spike detected',
  },
  parentIds: observations.map(o => o.blobId),  // causal chain
  encrypt: true,           // seal sensitive decisions
});`} />

            <h3 className="doc-h3">Execute and record artifact</h3>
            <CodeBlock language="typescript" code={`// executor reads decision and acts
const decisions = await ns.listMemories({ type: 'decision' });
const latest = decisions[0];

// verify decision integrity before acting
const verified = await client.verifyBlob(latest.blobId, latest.contentHash);
if (!verified) throw new Error('memory tampered');

// execute the trade (your logic here)
const txHash = await executeTrade({ action: 'long', asset: 'SUI/USDC' });

// write artifact — proof of execution
const artifact = await ns.writeMemory({
  type: 'artifact',
  content: {
    txHash,
    executedAt: Date.now(),
    slippage: 0.003,
    fillPrice: 1.851,
  },
  parentIds: [latest.blobId],
  encrypt: false,
});`} />

            <h3 className="doc-h3">Verify causal chain (replay audit)</h3>
            <CodeBlock language="typescript" code={`// given an artifact, walk back the full decision chain
async function replayProvenance(artifactBlobId: string) {
  const trail = [];
  let current = await ns.getMemory(artifactBlobId);

  while (current) {
    // verify each blob hash against on-chain record
    const ok = await client.verifyBlob(current.blobId, current.contentHash);
    trail.push({ ...current, verified: ok });

    // walk to parent (follow causal chain)
    if (current.parentIds.length === 0) break;
    current = await ns.getMemory(current.parentIds[0]);
  }

  return trail; // [artifact, decision, obs_3, obs_2, obs_1]
}

const provenance = await replayProvenance(artifact.blobId);
provenance.forEach(m => {
  console.log(\`\${m.type} | \${m.blobId} | verified=\${m.verified}\`);
});
// artifact  | 9c7e... | verified=true
// decision  | 44ab... | verified=true
// observation | f9d2... | verified=true`} />

            <h3 className="doc-h3">Multi-agent swarm example</h3>
            <CodeBlock language="typescript" code={`// register agents in your namespace (owner only)
await ns.registerAgent({
  address: '0xscout...',
  role: 'scout',
});
await ns.registerAgent({
  address: '0xstrategist...',
  role: 'strategist',
});
await ns.registerAgent({
  address: '0xexecutor...',
  role: 'executor',
});

// filter memories by agent
const scoutMems    = await ns.listMemories({ agent: '0xscout...' });
const stratMems    = await ns.listMemories({ agent: '0xstrategist...' });
const execMems     = await ns.listMemories({ agent: '0xexecutor...' });

// filter by time range
const lastHour = await ns.listMemories({
  type: 'observation',
  after: Date.now() - 3600_000,
});

// filter encrypted only
const sealed = await ns.listMemories({ encrypted: true });`} />

            <h3 className="doc-h3">TypeScript types</h3>
            <CodeBlock language="typescript" code={`interface WriteMemoryOpts {
  type: 'observation' | 'decision' | 'artifact' | 'reflection';
  content: Record<string, unknown>;  // any JSON-serializable object
  parentIds: string[];               // blob_ids of parent memories
  encrypt?: boolean;                 // seal with policy-based encryption
}

interface MemoryIndex {
  blobId: string;          // sha256 content address
  contentHash: string;     // on-chain hash (verify tamper)
  memoryType: number;      // 0-3
  parentCount: number;
  isEncrypted: boolean;
  agentAddress: string;
  timestamp: number;       // Sui Clock ms
  onChainObjectId: string; // Sui Move object ID
  parentIds: string[];     // parent blob IDs (causal chain)
}

interface MemoryFilter {
  type?: 'observation' | 'decision' | 'artifact' | 'reflection';
  agent?: string;
  encrypted?: boolean;
  after?: number;    // unix ms
  before?: number;
  limit?: number;
}`} />
          </DocSection>

          </div>
        </div>
      </div>
    </div>
  );
}
