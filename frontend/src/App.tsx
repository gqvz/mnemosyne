import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { DAppKitProvider } from "@mysten/dapp-kit-react";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { dAppKit } from "./dapp-kit";
import MemoryBrowser from "./components/MemoryBrowser";
import Landing from "./pages/Landing";
import Docs from "./pages/Docs";
import "./index.css";

const queryClient = new QueryClient();

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <DAppKitProvider dAppKit={dAppKit}>
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<Landing />} />
            <Route path="/docs" element={<Docs />} />
            <Route path="/browser/:namespaceId?" element={<MemoryBrowser />} />
          </Routes>
        </BrowserRouter>
      </DAppKitProvider>
    </QueryClientProvider>
  );
}
