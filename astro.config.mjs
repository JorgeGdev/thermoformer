// @ts-check
import { defineConfig } from 'astro/config';
import react from '@astrojs/react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  output: 'server',          // ⬅️ hace todo el sitio SSR
  integrations: [react()],
  vite: { plugins: [tailwindcss()] },
});
