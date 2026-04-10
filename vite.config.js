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
    noExternal: [
      '@blocknote/core',
      '@blocknote/react',
      '@blocknote/mantine',
      '@blocknote/xl-ai',
      '@blocknote/xl-multi-column',
      '@blocknote/xl-pdf-exporter',
      '@blocknote/xl-docx-exporter',
      '@blocknote/xl-odt-exporter',
      '@mantine/core',
      '@react-pdf/renderer',
    ],
  },

  // Keep Vite's dep pre-bundler OUT of the xl exporters — they ship
  // prebuilt ES modules with deep dynamic imports of co-located font
  // chunks (Inter_*.js, GeistMono-*.js) which Vite's pre-bundler loses
  // silently, leaving Font.register with empty data and making glyph
  // advance widths Infinity at render time ("unsupported number:
  // Infinity" from @react-pdf/render).
  optimizeDeps: {
    exclude: [
      '@blocknote/xl-ai',
      '@blocknote/xl-multi-column',
      '@blocknote/xl-pdf-exporter',
      '@blocknote/xl-docx-exporter',
      '@blocknote/xl-odt-exporter',
      '@react-pdf/renderer',
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
