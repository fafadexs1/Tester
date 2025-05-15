
// src/app/api/evolution/ws/route.ts
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { getWebSocketServer, handleUpgrade } from '@/lib/websocket-server-setup'; // DEV-ONLY
import type { IncomingMessage } from 'http';
import type { Duplex } from 'stream';

// IMPORTANT: This setup is for LOCAL DEVELOPMENT ONLY with Next.js.
// It will likely NOT WORK in typical serverless deployment environments (e.g., Vercel, Netlify)
// because they don't support long-running WebSocket server processes in the same way.
// For production, you'd typically use a dedicated WebSocket service or a custom server setup.

// This HTTP GET handler doesn't directly manage WebSocket connections.
// Its main purpose in this dev setup is to:
// 1. Ensure the global WebSocket server instance is attempted to be initialized.
// 2. Provide an HTTP endpoint that Evolution API might initially ping or that confirms the path exists.
// The actual WebSocket connection upgrade is intended to be handled by the global WebSocket server
// listening on the main HTTP server used by Next.js (which is tricky without a custom server.js).

export async function GET(request: NextRequest) {
  // Ensure the WebSocket server is initialized (this is a dev-mode hack)
  // In a proper setup with a custom server.js, the server is initialized once.
  try {
    getWebSocketServer(); // Attempt to initialize if not already
  } catch (e) {
    console.error("Error ensuring WebSocket server is initialized via GET request:", e);
  }
  
  const host = request.nextUrl.host;
  const protocol = request.nextUrl.protocol === 'https:' ? 'wss:' : 'ws:';

  // This response is for HTTP GET requests to this path, NOT for WebSocket clients.
  return NextResponse.json(
    { 
      message: "Flowise Lite WebSocket Endpoint (DEV MODE)",
      status: "A WebSocket server has been (conceptually) initialized for local development. Configure your Evolution API to connect to the WebSocket URL.",
      webSocketUrl: `${protocol}//${host}/api/evolution/ws`,
      importantNote: "This setup is for local development only and may not work in production serverless environments. Received WebSocket messages will be logged to the Next.js server console.",
    },
    { status: 200 }
  );
}


// The following is a conceptual way to handle upgrades if we could directly access
// the raw Node.js request and socket from the Next.js dev server's 'upgrade' event.
// Next.js App Router's NextRequest doesn't expose these directly for API routes
// in a way that `ws.handleUpgrade` can consume out-of-the-box.
// This part is more illustrative of what a custom server.js would do.

// This function would theoretically be called by the server's 'upgrade' event.
// We cannot directly hook into this from a standard API route file for all requests.
// So, this specific `handleUpgradeRequest` is more for demonstration of the pattern.
// The `handleUpgrade` function from `websocket-server-setup.ts` is what you'd use
// if you had a custom `server.js`.

// export async function handleUpgradeRequest(rawReq: IncomingMessage, socket: Duplex, head: Buffer) {
//   console.log('[API Route ws] Attempting to handle WebSocket upgrade...');
//   handleUpgrade(rawReq, socket, head); // Delegate to the shared handler
// }

// If you were running a custom server (server.js), you would do something like:
// server.on('upgrade', (req, socket, head) => {
//   const pathname = new URL(req.url, `http://${req.headers.host}`).pathname;
//   if (pathname === '/api/evolution/ws') {
//     handleUpgradeRequest(req, socket, head); // or call handleUpgrade directly
//   } else {
//     socket.destroy();
//   }
// });

// For now, the `getWebSocketServer()` call in `GET` and the global nature of `__websocketServer`
// is a simplified attempt to make the `ws.Server` instance available.
// The Evolution API should attempt to connect to `ws://localhost:PORT/api/evolution/ws`.
// The default Next.js dev server might handle the upgrade and our `wss.on('connection')` might fire.
