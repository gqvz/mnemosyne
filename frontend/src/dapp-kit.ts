import { createDAppKit } from "@mysten/dapp-kit-react";
import { SuiGrpcClient } from "@mysten/sui/grpc";

const GRPC_URLS: Record<string, string> = {
  testnet: "https://fullnode.testnet.sui.io:443",
  mainnet: "https://fullnode.mainnet.sui.io:443",
};

const defaultNetwork = (import.meta.env.VITE_SUI_NETWORK as "testnet" | "mainnet") || "testnet";
const customGrpcUrl = import.meta.env.VITE_SUI_GRPC_URL;

export const dAppKit = createDAppKit({
  networks: ["testnet", "mainnet"] as const,
  defaultNetwork,
  createClient: (network) =>
    new SuiGrpcClient({
      network,
      baseUrl: network === defaultNetwork && customGrpcUrl ? customGrpcUrl : GRPC_URLS[network],
    }),
});

declare module "@mysten/dapp-kit-react" {
  interface Register {
    dAppKit: typeof dAppKit;
  }
}
