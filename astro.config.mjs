// @ts-check
import { defineConfig } from 'astro/config';
import react from '@astrojs/react';
import tailwindcss from '@tailwindcss/vite';
import node from '@astrojs/node';

export default defineConfig({
  output: 'server',          // ⬅️ hace todo el sitio SSR
  adapter: node({
    mode: 'standalone'       // ⬅️ Para Railway
  }),
  server: {
    port: process.env.PORT ? parseInt(process.env.PORT) : 4321,
    host: '0.0.0.0'
  },
  integrations: [react()],
  vite: { plugins: [tailwindcss()] },
});
