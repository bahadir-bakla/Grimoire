import sharp from 'sharp'
import { writeFileSync, mkdirSync, existsSync } from 'fs'

// 128x128 SVG ikon — grimoire kitabı
const svgIcon = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128">
  <rect width="128" height="128" rx="24" fill="#0f0e17"/>
  <rect x="28" y="22" width="72" height="84" rx="6" fill="#1a1a2e" stroke="#534ab7" stroke-width="2"/>
  <rect x="22" y="26" width="72" height="84" rx="6" fill="#0f0e17" stroke="#7f77dd" stroke-width="1.5"/>
  <line x1="38" y1="52" x2="78" y2="52" stroke="#534ab7" stroke-width="2" stroke-linecap="round"/>
  <line x1="38" y1="64" x2="78" y2="64" stroke="#534ab7" stroke-width="2" stroke-linecap="round"/>
  <line x1="38" y1="76" x2="62" y2="76" stroke="#534ab7" stroke-width="2" stroke-linecap="round"/>
  <circle cx="58" cy="94" r="6" fill="#7f77dd" opacity=".8"/>
</svg>`

const sizes = [16, 32, 48, 128]

// output klasörünü garantiye al
if (!existsSync('public/icons')) {
  mkdirSync('public/icons', { recursive: true })
}

for (const size of sizes) {
  const buffer = await sharp(Buffer.from(svgIcon))
    .resize(size, size)
    .png()
    .toBuffer()

  writeFileSync(`public/icons/icon${size}.png`, buffer)
  console.log(`Generated icon${size}.png`)
}
