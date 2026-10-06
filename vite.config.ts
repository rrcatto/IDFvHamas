import { defineConfig } from 'vite';
export default defineConfig({
  base: './',
  build: {
    chunkSizeWarningLimit: 2600,
    rollupOptions: {
      output: {
        entryFileNames: 'assets/js/[name]-[hash].js',
        chunkFileNames: 'assets/js/[name]-[hash].js',
        assetFileNames: (asset) => {
          const name = asset.names[0] ?? '';
          const extension = name.slice(name.lastIndexOf('.') + 1).toLowerCase();
          const directories: Record<string, string> = {
            css: 'css', wasm: 'wasm',
            wav: 'audio', mp3: 'audio', ogg: 'audio', m4a: 'audio',
            svg: 'images', png: 'images', jpg: 'images', jpeg: 'images',
            webp: 'images', avif: 'images', gif: 'images', ico: 'images',
            woff: 'fonts', woff2: 'fonts', ttf: 'fonts', otf: 'fonts',
            glb: 'models', gltf: 'models', bin: 'models',
          };
          return `assets/${directories[extension] ?? 'other'}/[name]-[hash][extname]`;
        },
      },
    },
  },
  server: { port: 5173, strictPort: true },
  preview: { port: 4173, strictPort: true },
});
