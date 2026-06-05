import { useState } from "react";
import { useWallets, useWalletConnection } from "@mysten/dapp-kit-react";
import { TimelineView } from "./TimelineView";
import { CausalGraph } from "./CausalGraph";
import { BlobInspector } from "./BlobInspector";
import type { DisplayMemory } from "./mockData";
import { useMemories } from "./useLiveData";
import { Waves, Activity, Wallet } from "lucide-react";

export function MemoryBrowser() {
  const [selectedMemory, setSelectedMemory] = useState<DisplayMemory | null>(null);
  const namespace = "defi-swarm";
  const wallets = useWallets();
  const { account, status, wallet } = useWalletConnection();

  const { data: memories = [] } = useMemories();

  return (
    <div style={styles.container}>
      <header style={styles.header}>
        <div style={styles.headerLeft}>
          <Waves size={24} color="#4da6ff" />
          <h1 style={styles.title}>Mnemosyne</h1>
          <span style={styles.subtitle}>Memory Browser</span>
        </div>
        <div style={styles.headerCenter} className="header-center">
          <Activity size={14} color="#8888a0" />
          <span style={styles.namespace}>Namespace: {namespace}</span>
        </div>
        <div style={styles.headerRight}>
          <WalletStatus
            status={status}
            address={account?.address ?? null}
            walletName={wallet?.name ?? null}
            wallets={wallets}
          />
        </div>
      </header>

      <div className="main-grid">
        <div className="left-panel">
          <TimelineView
            memories={memories}
            selectedId={selectedMemory?.id ?? null}
            onSelect={setSelectedMemory}
          />
        </div>
        <div className="right-panel">
          <CausalGraph
            memories={memories}
            selectedId={selectedMemory?.id ?? null}
            onSelect={setSelectedMemory}
          />
        </div>
      </div>

      {selectedMemory && (
        <BlobInspector
          memory={selectedMemory}
          onClose={() => setSelectedMemory(null)}
        />
      )}
    </div>
  );
}

function WalletStatus({
  status,
  address,
  walletName,
}: {
  status: string;
  address: string | null;
  walletName: string | null;
  wallets: ReturnType<typeof useWallets>;
}) {
  if (status === "connected" && address) {
    return (
      <div style={styles.walletConnected}>
        <span style={styles.walletDot} />
        <span style={styles.walletName}>{walletName ?? "Wallet"}</span>
        <span style={styles.walletAddress}>
          {address.slice(0, 6)}...{address.slice(-4)}
        </span>
      </div>
    );
  }

  return (
    <div style={styles.walletDisconnected} className="wallet-disconnected">
      <Wallet size={14} color="#8888a0" />
      <span style={styles.walletLabel}>Connect Wallet</span>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    height: "100vh",
    display: "flex",
    flexDirection: "column",
    background: "var(--bg-primary)",
  },
  header: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: "12px 24px",
    background: "var(--bg-secondary)",
    borderBottom: "1px solid var(--border)",
    height: 56,
  },
  headerLeft: {
    display: "flex",
    alignItems: "center",
    gap: 10,
  },
  title: {
    fontSize: "var(--text-xl)",
    fontWeight: 700,
    letterSpacing: "var(--tracking-tight)",
    color: "var(--text-primary)",
    lineHeight: "var(--leading-tight)",
  },
  subtitle: {
    fontSize: "var(--text-sm)",
    color: "var(--text-muted)",
    fontWeight: 500,
  },
  headerCenter: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    padding: "4px 16px",
    background: "var(--bg-card)",
    borderRadius: 20,
    border: "1px solid var(--border)",
  },
  namespace: {
    fontSize: "var(--text-sm)",
    color: "var(--text-secondary)",
    fontFamily: "'JetBrains Mono', monospace",
    fontVariantNumeric: "tabular-nums",
  },
  headerRight: {
    display: "flex",
    alignItems: "center",
  },
  walletConnected: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    padding: "6px 14px",
    background: "var(--bg-card)",
    borderRadius: 20,
    border: "1px solid var(--border)",
  },
  walletDot: {
    width: 8,
    height: 8,
    borderRadius: "50%",
    background: "var(--accent-green)",
  },
  walletName: {
    fontSize: "var(--text-xs)",
    color: "var(--text-primary)",
    fontWeight: 600,
  },
  walletAddress: {
    fontSize: "var(--text-xs)",
    color: "var(--text-muted)",
    fontFamily: "'JetBrains Mono', monospace",
    fontVariantNumeric: "tabular-nums",
  },
  walletDisconnected: {
    display: "flex",
    alignItems: "center",
    gap: 6,
    padding: "6px 14px",
    background: "var(--bg-card)",
    borderRadius: 20,
    border: "1px solid var(--border)",
    cursor: "pointer",
  },
  walletLabel: {
    fontSize: 12,
    color: "var(--text-muted)",
  },

};
