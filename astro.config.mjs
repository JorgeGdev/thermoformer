// @ts-check
import { defineConfig } from 'astro/config';
import react from '@astrojs/react';
import tailwindcss from '@tailwindcss/vite';
import vercel from '@astrojs/vercel/serverless';

export default defineConfig({
  output: 'server',          // ⬅️ hace todo el sitio SSR
  adapter: vercel({          // ⬅️ Para Vercel
    webAnalytics: {
      enabled: true,
    }
  }),
  integrations: [react()],
  vite: { plugins: [tailwindcss()] },
});
