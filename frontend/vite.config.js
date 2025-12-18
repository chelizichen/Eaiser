import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { copyFileSync } from 'fs'
import { join } from 'path'

export default defineConfig({
  plugins: [
    react(),
    {
      name: 'copy-pdf-worker',
      closeBundle() {
        // 复制 PDF.js worker 文件到 dist 目录
        try {
          const workerSrc = join(process.cwd(), 'node_modules/pdfjs-dist/build/pdf.worker.min.mjs')
          const workerDest = join(process.cwd(), 'dist/pdf.worker.min.mjs')
          copyFileSync(workerSrc, workerDest)
          console.log('PDF.js worker copied to dist')
        } catch (e) {
          console.warn('Failed to copy PDF.js worker:', e)
        }
      }
    }
  ],
  build: { outDir: 'dist',sourcemap: true }
})

