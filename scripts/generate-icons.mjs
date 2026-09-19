import fs from 'node:fs'
import path from 'node:path'
import { execFileSync } from 'node:child_process'

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'

function getSvg({ maskable = false, width = 512, height = 512 } = {}) {
  // Safe zone for maskable icon is within the center 80% (radius 204px inside 512x512)
  // For maskable, background is full bleed (rx=0) and cross scale is slightly adjusted
  const rx = maskable ? 0 : 116
  const crossScale = maskable ? 0.88 : 0.94
  const transform = `translate(256 256) scale(${crossScale}) translate(-256 -256)`

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="${width}" height="${height}">
  <defs>
    <!-- Gradiente de Fundo Verde Esmeralda Clínico -->
    <linearGradient id="clinicGreen" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#10B981" />
      <stop offset="45%" stop-color="#059669" />
      <stop offset="100%" stop-color="#047857" />
    </linearGradient>

    <!-- Brilho Ambiente Superior -->
    <radialGradient id="topGlow" cx="28%" cy="18%" r="65%">
      <stop offset="0%" stop-color="#FFFFFF" stop-opacity="0.28" />
      <stop offset="60%" stop-color="#FFFFFF" stop-opacity="0.05" />
      <stop offset="100%" stop-color="#FFFFFF" stop-opacity="0" />
    </radialGradient>

    <!-- Sombra Suave da Cruz Médica -->
    <filter id="dropShadow" x="-20%" y="-20%" width="140%" height="140%">
      <feDropShadow dx="0" dy="12" stdDeviation="14" flood-color="#022c22" flood-opacity="0.32" />
    </filter>

    <!-- Sombra Interna do Coração -->
    <filter id="heartShadow" x="-20%" y="-20%" width="140%" height="140%">
      <feDropShadow dx="0" dy="4" stdDeviation="6" flood-color="#047857" flood-opacity="0.25" />
    </filter>

    <!-- Gradiente do Coração Central -->
    <linearGradient id="heartGrad" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" stop-color="#059669" />
      <stop offset="100%" stop-color="#047857" />
    </linearGradient>
  </defs>

  <!-- Fundo Verde da Clínica -->
  <rect width="512" height="512" rx="${rx}" fill="url(#clinicGreen)" />
  <rect width="512" height="512" rx="${rx}" fill="url(#topGlow)" />
  ${maskable ? '' : `<rect x="5" y="5" width="502" height="502" rx="111" fill="none" stroke="#FFFFFF" stroke-opacity="0.18" stroke-width="3" />`}

  <!-- Grupo Central da Cruz Médica com Efeito de Escala e Sombra -->
  <g transform="${transform}" filter="url(#dropShadow)">
    <!-- Cruz Médica Branca com Cantos Arredondados Suaves -->
    <path fill="#FFFFFF" fill-rule="evenodd" d="
      M 214 96
      C 214 82.7, 224.7 72, 238 72
      L 274 72
      C 287.3 72, 298 82.7, 298 96
      L 298 214
      L 416 214
      C 429.3 214, 440 224.7, 440 238
      L 440 274
      C 440 287.3, 429.3 298, 416 298
      L 298 298
      L 298 416
      C 298 429.3, 287.3 440, 274 440
      L 238 440
      C 224.7 440, 214 429.3, 214 416
      L 214 298
      L 96 298
      C 82.7 298, 72 287.3, 72 274
      L 72 238
      C 72 224.7, 82.7 214, 96 214
      L 214 214
      Z
    " />

    <!-- Círculo Suave de Contenção do Núcleo Clínico -->
    <circle cx="256" cy="256" r="68" fill="#ECFDF5" />

    <!-- Coração Clínico de Cuidado e Saúde -->
    <path filter="url(#heartShadow)" fill="url(#heartGrad)" d="
      M 256 288
      C 256 288, 218 266, 218 244
      C 218 231, 228 221, 241 221
      C 248.5 221, 253.5 225, 256 228
      C 258.5 225, 263.5 221, 271 221
      C 284 221, 294 231, 294 244
      C 294 266, 256 288, 256 288
      Z
    " />

    <!-- Linha de Pulso / Eletrocardiograma / Vitalidade em Branco -->
    <path fill="none" stroke="#FFFFFF" stroke-width="4.5" stroke-linecap="round" stroke-linejoin="round" d="
      M 226 248
      L 239 248
      L 245 237
      L 252 258
      L 260 240
      L 266 250
      L 273 248
      L 286 248
    " />
  </g>
</svg>
`
}

function renderHtmlToPng(svgString, outputPath, size) {
  const tempHtml = path.join(process.cwd(), `temp_render_${size}.html`)
  const htmlContent = `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body, html { width: ${size}px; height: ${size}px; overflow: hidden; background: transparent; }
  svg { display: block; width: 100%; height: 100%; }
</style>
</head>
<body>
${svgString}
</body>
</html>`

  fs.writeFileSync(tempHtml, htmlContent, 'utf8')

  try {
    execFileSync(CHROME_PATH, [
      '--headless',
      '--disable-gpu',
      '--hide-scrollbars',
      `--window-size=${size},${size}`,
      '--default-background-color=00000000',
      `--screenshot=${outputPath}`,
      tempHtml,
    ], { stdio: 'pipe' })
  } finally {
    if (fs.existsSync(tempHtml)) {
      fs.unlinkSync(tempHtml)
    }
  }
}

async function main() {
  const publicDir = path.join(process.cwd(), 'public')
  console.log('Gerando ícones para Clínica Dr Marcelo...')

  // 1. SVG Oficial (Favicon e PWA SVG)
  const standardSvg = getSvg({ maskable: false, width: 512, height: 512 })
  fs.writeFileSync(path.join(publicDir, 'favicon.svg'), standardSvg, 'utf8')
  fs.writeFileSync(path.join(publicDir, 'pwa-icon.svg'), standardSvg, 'utf8')
  console.log('✓ public/favicon.svg gerado.')
  console.log('✓ public/pwa-icon.svg gerado.')

  // 2. SVG Maskable
  const maskableSvg = getSvg({ maskable: true, width: 512, height: 512 })
  fs.writeFileSync(path.join(publicDir, 'pwa-maskable.svg'), maskableSvg, 'utf8')
  console.log('✓ public/pwa-maskable.svg gerado.')

  // 3. Render PNGs via Headless Chrome
  renderHtmlToPng(standardSvg, path.join(publicDir, 'pwa-192x192.png'), 192)
  console.log('✓ public/pwa-192x192.png gerado.')

  renderHtmlToPng(standardSvg, path.join(publicDir, 'pwa-512x512.png'), 512)
  console.log('✓ public/pwa-512x512.png gerado.')

  renderHtmlToPng(maskableSvg, path.join(publicDir, 'pwa-maskable-512x512.png'), 512)
  console.log('✓ public/pwa-maskable-512x512.png gerado.')

  renderHtmlToPng(standardSvg, path.join(publicDir, 'apple-touch-icon.png'), 180)
  console.log('✓ public/apple-touch-icon.png gerado.')

  renderHtmlToPng(standardSvg, path.join(publicDir, 'favicon-32x32.png'), 32)
  console.log('✓ public/favicon-32x32.png gerado.')

  console.log('Todos os ícones foram gerados com sucesso!')
}

main().catch(err => {
  console.error(err)
  process.exit(1)
})
