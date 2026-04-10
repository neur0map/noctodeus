import { defineConfig } from "vite";
import { sveltekit } from "@sveltejs/kit/vite";
import tailwindcss from "@tailwindcss/vite";

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

  // Force Vite to pre-bundle the @blocknote/xl-* exporters AND
  // @react-pdf/renderer so their prebuilt `import { jsx } from "react/jsx-runtime"`
  // references resolve correctly. Without this, Vite tries to serve
  // these packages as raw ESM and the jsx named export is missing
  // (we're not using @vitejs/plugin-react due to a SvelteKit conflict),
  // which produces: "Importing binding name 'jsx' is not found".
  //
  // Pre-bundling them lets esbuild convert the jsx runtime imports into
  // proper ESM with the correct named exports. It also bundles in the
  // co-located font data-URL chunks that the exporters lazy-load.
  optimizeDeps: {
    include: [
      '@blocknote/xl-pdf-exporter',
      '@blocknote/xl-docx-exporter',
      '@blocknote/xl-odt-exporter',
      '@react-pdf/renderer',
      'react/jsx-runtime',
      'react/jsx-dev-runtime',
    ],
  },
  test: {
    environment: 'jsdom',
    include: ['src/**/*.test.ts'],
    passWithNoTests: true,
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
