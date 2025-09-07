import { createServer } from 'http';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PORT = process.env.PORT || 4321;
const HOST = process.env.HOST || '0.0.0.0';

// Importar el handler de Astro
const { handler } = await import('./dist/server/entry.mjs');

const server = createServer((req, res) => {
  handler(req, res);
});

server.listen(PORT, HOST, () => {
  console.log(`🚀 Server ready at http://${HOST}:${PORT}`);
});
