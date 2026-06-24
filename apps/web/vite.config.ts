import { defineConfig } from 'vite';
import { svelte } from '@sveltejs/vite-plugin-svelte';

export default defineConfig({
  plugins: [svelte()],

  // Allow the AudioWorklet processor script to be served from /public
  // without being bundled, and make the WASM directory available.
  server: {
    headers: {
      // Required for SharedArrayBuffer (future WASM threads support)
      // and recommended for AudioWorklet module loading.
      'Cross-Origin-Opener-Policy': 'same-origin',
      'Cross-Origin-Embedder-Policy': 'require-corp',
    },
  },

  build: {
    target: 'es2022',
  },
});
