// Configura o Vite e habilita a integração com React.
import { env } from 'node:process'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  base: env.GITHUB_ACTIONS === 'true' ? '/radardosprecos/' : '/',
  plugins: [react()],
})
