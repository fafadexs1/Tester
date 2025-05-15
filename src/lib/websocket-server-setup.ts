
// src/lib/websocket-server-setup.ts
import { WebSocketServer, WebSocket } from 'ws';
import type { IncomingMessage } from 'http';
import type { Duplex } from 'stream';

// This is a very basic in-memory store for active WebSocket connections.
// In a real application, you might want something more robust.
const clients = new Set<WebSocket>();

// Store the WebSocketServer instance globally.
// IMPORTANT: This approach is primarily for local development with Next.js.
// In serverless environments, managing a persistent WebSocket server like this is not straightforward.
declare global {
  // eslint-disable-next-line no-var
  var __websocketServer: WebSocketServer | undefined;
}

export function getWebSocketServer(httpServer?: any): WebSocketServer {
  if (global.__websocketServer) {
    // console.log('[WebSocket Server] Reusing existing instance.');
    return global.__websocketServer;
  }

  console.log('[WebSocket Server] Initializing new instance...');
  // When 'noServer: true', the WebSocketServer doesn't start its own HTTP server.
  // We need to manually handle the upgrade from an existing HTTP server.
  const wss = new WebSocketServer({ noServer: true });

  wss.on('connection', (ws: WebSocket, request: IncomingMessage) => {
    const clientIp = request.socket.remoteAddress || request.headers['x-forwarded-for'];
    console.log(`[WebSocket Server] Client connected: ${clientIp}. Total clients: ${wss.clients.size}`);
    clients.add(ws);

    ws.on('message', (message: Buffer) => {
      // For this example, we'll assume messages are strings.
      const messageString = message.toString();
      console.log('[WebSocket Server] Received message:', messageString);
      
      // Here, you would typically parse the message and decide what to do with it.
      // For example, if it's from Evolution API, you might try to find a Flowise Lite flow
      // to trigger or continue. This part is the "flow engine" logic.

      // For now, let's just echo it back to the client or broadcast to all for demonstration.
      // ws.send(`Echo: ${messageString}`);
      
      // Or broadcast to all connected clients (careful with this in a real app)
      // clients.forEach(client => {
      //   if (client !== ws && client.readyState === WebSocket.OPEN) {
      //     client.send(`Broadcast from server: ${messageString}`);
      //   }
      // });
    });

    ws.on('close', () => {
      clients.delete(ws);
      console.log(`[WebSocket Server] Client disconnected. Total clients: ${wss.clients.size}`);
    });

    ws.on('error', (error: Error) => {
      console.error('[WebSocket Server] Error on client connection:', error);
    });

    ws.send('Welcome to the Flowise Lite WebSocket server (Dev Mode)!');
  });
  
  wss.on('error', (error) => {
    console.error('[WebSocket Server] Server error:', error);
  });

  console.log('[WebSocket Server] Instance created. Waiting for HTTP server upgrade event.');
  global.__websocketServer = wss;
  return wss;
}

// This function would be called by the HTTP server when it receives an upgrade request.
export function handleUpgrade(request: IncomingMessage, socket: Duplex, head: Buffer) {
  const wss = getWebSocketServer(); // Ensure it's initialized
  
  // Define the path for WebSocket connections, e.g., '/api/evolution/ws'
  const pathname = request.url;

  if (pathname === '/api/evolution/ws') {
    console.log(`[WebSocket Server] Handling upgrade request for path: ${pathname}`);
    wss.handleUpgrade(request, socket, head, (ws) => {
      wss.emit('connection', ws, request);
    });
  } else {
    console.log(`[WebSocket Server] Upgrade request for unknown path: ${pathname}. Destroying socket.`);
    socket.destroy();
  }
}

// Note: To make this truly work with Next.js dev server, you'd typically need to
// attach `handleUpgrade` to the `upgrade` event of the HTTP server instance
// that Next.js uses. This is done in a custom server.js file.
//
// Example (conceptual, for a custom server.js):
// const { createServer } = require('http')
// const { parse } = require('url')
// const next = require('next')
// const { handleUpgrade } = require('./lib/websocket-server-setup') // Adjust path
//
// const dev = process.env.NODE_ENV !== 'production'
// const app = next({ dev })
// const handle = app.getRequestHandler()
//
// app.prepare().then(() => {
//   const server = createServer((req, res) => {
//     const parsedUrl = parse(req.url, true)
//     handle(req, res, parsedUrl)
//   })
//
//   server.on('upgrade', (request, socket, head) => {
//     handleUpgrade(request, socket, head);
//   });
//
//   server.listen(3000, (err) => {
//     if (err) throw err
//     console.log('> Ready on http://localhost:3000')
//   })
// })
//
// Without a custom server.js, this file primarily sets up the wss instance globally.
// The /api/evolution/ws/route.ts will attempt to ensure this is called,
// but the actual 'upgrade' handling is tricky without direct server access.
