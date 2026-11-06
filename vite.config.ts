import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => ({
  publicDir: mode === 'native' ? 'public-native' : 'public',
  plugins: [
    react(),
    ...(mode === 'native'
      ? [
          {
            name: 'openpolis-native-html',
            transformIndexHtml(html: string) {
              return html
                .replace(/<link[^>]+(?:fonts\.googleapis\.com|fonts\.gstatic\.com)[\s\S]*?>/g, '')
                .replace(/<link rel="canonical"[^>]*>/g, '')
                .replace(/<script type="application\/ld\+json">[\s\S]*?<\/script>/g, '')
                .replace(/<meta[^>]+(?:og:|twitter:)[^>]*>/g, '')
                .replace(/<link rel="(?:icon|apple-touch-icon)"[^>]*>/g, '')
                .replace('</head>', '<link rel="icon" href="/favicon.svg"></head>');
            },
          },
        ]
      : []),
  ],
  build: { outDir: mode === 'native' ? 'dist-native' : 'dist' },
  server: {
    // The save server (server/index.ts); `bun run dev` runs both.
    proxy: { '/api': 'http://localhost:8787' },
  },
  test: {
    include: ['tests/**/*.test.ts', 'server/**/*.test.ts'],
  },
}));
