#!/usr/bin/env node

// Start script que maneja el puerto correctamente
const PORT = process.env.PORT || 4321;
const HOST = process.env.HOST || '0.0.0.0';

console.log(`🚀 Starting server on ${HOST}:${PORT}`);

// Configurar variables de entorno antes de importar Astro
process.env.HOST = HOST;
process.env.PORT = PORT;

// Importar y ejecutar el servidor de Astro
import('./dist/server/entry.mjs');
