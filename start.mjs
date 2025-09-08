#!/usr/bin/env node
import { handler, startServer } from './dist/server/entry.mjs';

const PORT = process.env.PORT || 4321;
const HOST = process.env.HOST || '0.0.0.0';

console.log(`🚀 Starting server on ${HOST}:${PORT}`);

// Configurar el servidor correctamente
if (startServer) {
  // Si Astro provee startServer, usarlo
  startServer({ port: PORT, host: HOST });
} else {
  // Fallback: crear servidor HTTP manualmente
  const { createServer } = await import('http');
  
  const server = createServer(handler);
  
  server.listen(PORT, HOST, () => {
    console.log(`✅ Server running at http://${HOST}:${PORT}`);
  });
}
