import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
// Detectar si estamos construyendo para Firebase o GitHub Pages
const isBuildingForFirebase = process.env.BUILD_FOR === 'firebase'
const base = isBuildingForFirebase ? '/' : '/herramientas-estudio/'

export default defineConfig({
  base: base,
  plugins: [react(), tailwindcss()],
})
