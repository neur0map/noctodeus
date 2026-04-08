import { defineConfig } from "vite";
import { sveltekit } from "@sveltejs/kit/vite";
import tailwindcss from "@tailwindcss/vite";

// @ts-expect-error process is a nodejs global
const host = process.env.TAURI_DEV_HOST;

// https://vite.dev/config/
export default defineConfig(async () => ({
  plugins: [tailwindcss(), sveltekit()],
  // Use esbuild's built-in JSX transform for .tsx files (no @vitejs/plugin-react
  // needed — its Fast Refresh preamble conflicts with SvelteKit's pipeline)
  esbuild: {
    jsx: /** @type {'automatic'} */ ('automatic'),
    jsxImportSource: 'react',
  },
  // Ensure React/BlockNote packages are bundled client-side, not SSR'd
  ssr: {
    noExternal: ['@blocknote/core', '@blocknote/react', '@blocknote/mantine', '@mantine/core'],
  },
  test: {
    environment: 'jsdom',
    include: ['src/**/*.test.ts'],
  },

  // Vite options tailored for Tauri development and only applied in `tauri dev` or `tauri build`
  //
  // 1. prevent Vite from obscuring rust errors
  clearScreen: false,
  // 2. tauri expects a fixed port, fail if that port is not available
  server: {
    port: 1420,
    strictPort: true,
    host: host || false,
    hmr: host
      ? {
          protocol: "ws",
          host,
          port: 1421,
        }
      : undefined,
    watch: {
      // 3. tell Vite to ignore watching `src-tauri`
      ignored: ["**/src-tauri/**"],
    },
  },
}));
