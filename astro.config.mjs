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
  integrations: [react()],
  vite: { plugins: [tailwindcss()] },
});
