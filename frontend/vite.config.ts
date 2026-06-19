import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'
import fs from 'fs'

// Custom helper to load environment variables from the trading_poc/ .env file without external dependencies
try {
  const envPath = path.resolve(__dirname, '../trading_poc/.env')
  if (fs.existsSync(envPath)) {
    const lines = fs.readFileSync(envPath, 'utf8').split('\n')
    for (const line of lines) {
      const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/)
      if (match) {
        const key = match[1]
        let value = match[2] || ''
        if (value.startsWith('"') && value.endsWith('"')) {
          value = value.slice(1, -1)
        }
        process.env[key] = value
      }
    }
  }
} catch (e) {
  console.error('Failed to load env file:', e)
}

async function checkAccess(userAddress: string, namespaceId: string): Promise<boolean> {
  try {
    const { SuiJsonRpcClient, getJsonRpcFullnodeUrl } = await import('@mysten/sui/jsonRpc');
    const network = process.env.SUI_NETWORK || 'testnet';
    const rpcUrl = process.env.SUI_RPC_URL || getJsonRpcFullnodeUrl(network as any);

    const rpcClient = new SuiJsonRpcClient({
      url: rpcUrl,
      network: network as any,
    });

    // 1. Fetch Namespace object
    const objRes = await rpcClient.getObject({
      id: namespaceId,
      options: { showContent: true }
    });
    if (!objRes.data || !objRes.data.content) {
      return false;
    }
    const content = objRes.data.content as any;
    // Check type
    if (!content.type || !content.type.includes('::memory::Namespace')) {
      return false;
    }
    const fields = content.fields || {};
    // Check owner
    if (fields.owner === userAddress) {
      return true;
    }

    // 2. Check if user is a registered agent (dynamic field check)
    const dfRes = await rpcClient.getDynamicFieldObject({
      parentId: namespaceId,
      name: {
        type: 'address',
        value: userAddress
      }
    });
    if (dfRes.data && !dfRes.error) {
      return true;
    }
  } catch (e) {
    console.error('Error checking namespace access:', e);
  }
  return false;
}

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) => setTimeout(() => reject(new Error(`Timed out after ${ms}ms`)), ms)),
  ]);
}

function memwalApiPlugin() {
  return {
    name: 'memwal-api',
    configureServer(server: any) {
      server.middlewares.use(async (req: any, res: any, next: any) => {
        if (req.url && req.url.startsWith('/api/memory/')) {
          // Parse URL /api/memory/:namespace/:blobId
          const parts = req.url.split('?')[0].split('/');
          const namespace = parts[3];
          const blobId = parts[4];

          if (!namespace || !blobId) {
            res.statusCode = 400;
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ error: 'Missing namespace or blobId' }));
            return;
          }

          // Parse authentication headers
          const userAddress = req.headers['x-user-address'];
          const signature = req.headers['x-signature'];
          const message = req.headers['x-message'];

          let isAuthorized = false;
          if (userAddress && signature && message) {
            try {
              const expectedMessage = `Decrypt memory blob: ${blobId} for namespace: ${namespace}`;
              if (message === expectedMessage) {
                await withTimeout((async () => {
                  const { verifyPersonalMessageSignature } = await import('@mysten/sui/verify');
                  const messageBytes = new TextEncoder().encode(message);
                  const pk = await verifyPersonalMessageSignature(messageBytes, signature, { address: userAddress });
                  if (pk.toSuiAddress() === userAddress) {
                    isAuthorized = await checkAccess(userAddress, namespace);
                  }
                })(), 15_000);
              }
            } catch (err) {
              console.error('Signature verification failed:', err);
            }
          }

          try {
            const { MemWal } = await import('@mysten-incubation/memwal');
            const memwal = MemWal.create({
              key: process.env.MEMWAL_PRIVATE_KEY || '',
              accountId: process.env.MEMWAL_ACCOUNT_ID || '',
              serverUrl: process.env.MEMWAL_SERVER_URL || 'https://relayer.staging.memwal.ai',
              namespace: namespace,
            });

            const recalled = await withTimeout(
              memwal.recall(blobId, { limit: 1, namespace }),
              15_000,
            );
            const memory = recalled.results[0];
            if (!memory) {
              res.statusCode = 404;
              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify({ error: 'Memory not found in MemWal index' }));
              return;
            }

            if (!userAddress) {
              res.statusCode = 401;
              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify({ error: 'Authentication required: connect wallet and sign to access memory content' }));
              return;
            }

            if (!isAuthorized) {
              res.statusCode = 403;
              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify({ error: 'Access denied: Address is not owner or registered agent of this namespace' }));
              return;
            }

            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ text: memory.text }));
          } catch (err: any) {
            res.statusCode = 500;
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ error: err.message || String(err) }));
          }
          return;
        }
        next();
      });
    }
  };
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), memwalApiPlugin()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port: 5174,
    strictPort: true,
  },
})
