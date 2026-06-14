/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath, URL } from 'node:url';

// 前端开发服务器；/api 与 /ws 代理到后端（默认 8787）。
export default defineConfig({
  plugins: [react()],
  define: {
    __BUNDLED_DEV__: false,
  },
  resolve: {
    alias: {
      '@shared': fileURLToPath(new URL('../shared', import.meta.url)),
    },
  },
  // transformers.js 体积大且自带 wasm，按需动态加载，跳过预打包避免 esbuild 卡顿。
  optimizeDeps: {
    exclude: ['@huggingface/transformers'],
  },
  server: {
    port: 5173,
    // 允许从项目根读取 ../shared 下的共享类型
    fs: { allow: ['..'] },
    proxy: {
      '/api': 'http://localhost:8787',
      '/ws': { target: 'ws://localhost:8787', ws: true },
    },
  },
  test: {
    environment: 'node',
    globals: true,
  },
});
