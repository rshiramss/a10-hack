import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, '../../', '')
  const steerTarget = env.MI_MODAL_CLAIM_ABLATION_ENDPOINT
  if (!steerTarget) {
    console.warn('[vite] MI_MODAL_CLAIM_ABLATION_ENDPOINT not set — /api/steer will 404')
  }
  return {
    plugins: [react()],
    server: {
      port: 5174,
      proxy: steerTarget
        ? {
            '/api/steer': {
              target: steerTarget,
              changeOrigin: true,
              rewrite: () => '',
            },
          }
        : undefined,
    },
  }
})
