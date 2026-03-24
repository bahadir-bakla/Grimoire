# Phase 6 — Polish ve Yayın

> **Hedef:** Extension'ı portföy kalitesine getir. Edge case'leri kapat, ikonları yap, Chrome Web Store'a yükle, GitHub'ı hazırla.
> **Tahmini süre:** 3–4 saat
> **Gereklilik:** Phase 5 checklist'i tam ✅

---

## Claude Code'a ver

```
Grimoire Phase 6: Polish ve yayın hazırlığı.
Error boundary ekle, edge case'leri kapat, manifest'i güncelle,
README.md yaz. Kod değişikliklerini listele, ben ikonları ve
Web Store materyallerini ayrıca hazırlayacağım.
```

---

## Adım 6.1 — Edge case'leri kapat

### service-worker.js — API key kontrolü

`callClaude` fonksiyonunu şununla değiştir (başa guard ekle):

```js
async function callClaude({ apiKey, systemPrompt, userText }) {
  if (!apiKey || !apiKey.startsWith('sk-ant-')) {
    throw new Error('Geçersiz API key. Ayarlar\'dan sk-ant-... formatında gir.')
  }

  if (!userText || userText.trim().length < 50) {
    throw new Error('Metin çok kısa, dönüştürülemiyor.')
  }

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: CLAUDE_MODEL,
      max_tokens: MAX_LORE_TOKENS,
      system: systemPrompt,
      messages: [{ role: 'user', content: `Aşağıdaki metni dönüştür:\n\n${userText}` }],
    }),
  })

  if (response.status === 401) {
    throw new Error('API key geçersiz. Ayarlar\'dan kontrol et.')
  }
  if (response.status === 429) {
    throw new Error('Rate limit aşıldı. 30 saniye bekle.')
  }
  if (!response.ok) {
    const err = await response.json().catch(() => ({}))
    throw new Error(err?.error?.message ?? `API hatası: ${response.status}`)
  }

  const data = await response.json()
  const text = data?.content?.[0]?.text
  if (!text) throw new Error('API boş yanıt döndürdü.')

  return text.trim()
}
```

### content.js — Sayfa uyumluluk kontrolü

`transformCurrentPage` fonksiyonunun başına ekle:

```js
async function transformCurrentPage() {
  // Chrome iç sayfalarında çalışma
  const url = window.location.href
  if (
    url.startsWith('chrome://') ||
    url.startsWith('chrome-extension://') ||
    url.startsWith('about:') ||
    url.startsWith('data:')
  ) {
    console.log('[Grimoire] Internal page, skipping')
    return
  }

  // Seans hâlâ aktif mi? (kullanıcı seansı bitirmiş olabilir)
  const { session } = await chrome.storage.local.get(['session'])
  if (!session?.isActive) {
    console.log('[Grimoire] Session ended before transform completed')
    return
  }

  // ... mevcut kod devam eder
```

### storage.js — Quota kontrolü

`addToGrimoire` fonksiyonuna ekle:

```js
export async function addToGrimoire(entry) {
  const { grimoire } = await getStorage([STORAGE_KEYS.GRIMOIRE])
  const current = grimoire ?? []

  const duplicate = current.find(e => e.url === entry.url)
  if (duplicate) return { saved: false, reason: 'duplicate', grimoire: current }

  const updated = [entry, ...current]

  // Storage quota kontrolü (~5MB limit)
  const totalChars = JSON.stringify(updated).length
  if (totalChars > 4_500_000) {
    // En eski 30 kaydı sil
    console.warn('[Grimoire] Storage near limit, trimming old entries')
    updated.splice(updated.length - 30, 30)
  }

  await setStorage({ [STORAGE_KEYS.GRIMOIRE]: updated })
  return { saved: true, grimoire: updated }
}
```

---

## Adım 6.2 — Popup'a error boundary ekle

### Yeni dosya: src/popup/ErrorBoundary.jsx

```jsx
import { Component } from 'react'

export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error }
  }

  componentDidCatch(error, info) {
    console.error('[Grimoire] Popup error:', error, info)
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          padding: 20,
          color: '#e24b4a',
          fontFamily: 'sans-serif',
          fontSize: 13,
        }}>
          <div style={{ fontWeight: 500, marginBottom: 8 }}>Bir hata oluştu</div>
          <div style={{ color: '#888780', marginBottom: 16, fontSize: 12 }}>
            {this.state.error?.message ?? 'Bilinmeyen hata'}
          </div>
          <button
            onClick={() => this.setState({ hasError: false, error: null })}
            style={{
              background: 'none',
              border: '1px solid rgba(226,75,74,.4)',
              borderRadius: 7,
              color: '#e24b4a',
              padding: '6px 14px',
              cursor: 'pointer',
              fontSize: 12,
              fontFamily: 'inherit',
            }}
          >
            Tekrar dene
          </button>
        </div>
      )
    }
    return this.props.children
  }
}
```

### main.jsx'i güncelle:

```jsx
import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import ErrorBoundary from './ErrorBoundary.jsx'
import './index.css'

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </React.StrictMode>
)
```

---

## Adım 6.3 — manifest.json'u güncelle

```json
{
  "manifest_version": 3,
  "name": "Grimoire",
  "version": "1.0.0",
  "description": "Okuduğun şey büyüye dönüşür. Dikkatini kaybedersen canavar gelir. Çalışma seanslarını dungeon'a, okuduklarını grimoire'a dönüştür.",
  "permissions": [
    "storage",
    "tabs",
    "activeTab",
    "scripting",
    "alarms"
  ],
  "host_permissions": [
    "<all_urls>"
  ],
  "background": {
    "service_worker": "src/background/service-worker.js",
    "type": "module"
  },
  "content_scripts": [
    {
      "matches": ["<all_urls>"],
      "js": ["src/content/content.js"],
      "css": ["src/content/content.css"],
      "run_at": "document_idle",
      "exclude_matches": [
        "chrome://*/*",
        "chrome-extension://*/*",
        "https://chrome.google.com/webstore/*"
      ]
    }
  ],
  "action": {
    "default_popup": "popup.html",
    "default_icon": {
      "16":  "public/icons/icon16.png",
      "32":  "public/icons/icon32.png",
      "48":  "public/icons/icon48.png",
      "128": "public/icons/icon128.png"
    }
  },
  "icons": {
    "16":  "public/icons/icon16.png",
    "32":  "public/icons/icon32.png",
    "48":  "public/icons/icon48.png",
    "128": "public/icons/icon128.png"
  }
}
```

---

## Adım 6.4 — İkon tasarımı

### Konsept

Grimoire = aydınlık bir kitap silueti, koyu zemin. Mor (#7f77dd) accent.

### Figma / Canva olmadan (kod ile)

```bash
# Node.js ile ikon oluştur (sharp kütüphanesi)
npm install -D sharp
```

### scripts/generate-icons.mjs

```js
import sharp from 'sharp'
import { writeFileSync } from 'fs'

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

for (const size of sizes) {
  const buffer = await sharp(Buffer.from(svgIcon))
    .resize(size, size)
    .png()
    .toBuffer()

  writeFileSync(`public/icons/icon${size}.png`, buffer)
  console.log(`Generated icon${size}.png`)
}
```

```bash
node scripts/generate-icons.mjs
```

> Alternatif: Figma'da manuel yap veya AI ile ikon üret ve 4 boyuta export et.

---

## Adım 6.5 — Son build ve zip

```bash
npm run build
```

### dist/ klasörünü zip'le

```bash
cd dist
zip -r ../grimoire-v1.0.0.zip .
cd ..
```

---

## Adım 6.6 — Chrome Web Store yayını

### Gerekli materyaller

| Materyal | Boyut | Açıklama |
|---|---|---|
| Ikon | 128×128 PNG | Zaten var |
| Ekran görüntüsü | 1280×800 veya 640×400 | Min. 1, max. 5 |
| Promo görseli (opsiyonel) | 440×280 PNG | Store'da öne çıkar |

### Ekran görüntüsü çek

1. Extension yüklüyken Wikipedia'ya git, seans başlat
2. Sidebar açık haldeyken Chrome'un tam ekran screenshot'unu al (`Cmd+Shift+3` / `PrtSc`)
3. 1280×800 boyutuna kırp
4. En az 1 tane gerekli, 3-4 tane ideal

### Web Store adımları

1. [Chrome Web Store Developer Dashboard](https://chrome.google.com/webstore/devconsole) aç
2. "New item" → `grimoire-v1.0.0.zip` yükle
3. Şunları doldur:
   - **Name:** Grimoire
   - **Short description** (132 kar): "Okuduğun şey büyüye dönüşür. Çalışma seansını RPG'ye, sayfaları lore'a dönüştür."
   - **Detailed description:** Aşağıyı kopyala
   - **Category:** Productivity
   - **Language:** Turkish
4. Gizlilik politikası URL'i ekle (aşağıda)
5. Ekran görüntülerini yükle
6. Submit

### Detailed description metni

```
Grimoire, çalışma seanslarını bir dungeon'a dönüştüren ve okuduğun her sayfayı 
fantasy lore'una çeviren bir odaklanma eklentisi.

ÖZELLİKLER
• Seans başlat → dungeon katlarına in, XP kazan
• Her sayfa AI ile fantasy / sci-fi / noir lore'una dönüşür
• Dikkat dağıtıcı sekme açarsan canavar saldırır
• Haftalık boss fight — o haftaki fokus skoruna göre zorlanır
• Tüm okuduklarını Grimoire envanterinde topla

TEKNİK
Anthropic Claude API kullanır. API key'ini Ayarlar'dan girebilirsin.
Veriler sadece cihazında saklanır, dışarıya gönderilmez.
```

---

## Adım 6.7 — Gizlilik politikası

GitHub Pages veya herhangi bir hosting'e basit bir sayfa:

```html
<!DOCTYPE html>
<html lang="tr">
<head><meta charset="UTF-8"><title>Grimoire — Gizlilik Politikası</title></head>
<body>
  <h1>Grimoire Gizlilik Politikası</h1>
  <p>Son güncelleme: [tarih]</p>

  <h2>Toplanan veriler</h2>
  <p>Grimoire, çalışma süreleri, ziyaret edilen sayfaların başlık ve URL'lerini
  yalnızca cihazınızda (chrome.storage.local) saklar. Bu veriler hiçbir
  sunucuya gönderilmez.</p>

  <h2>Üçüncü taraf API</h2>
  <p>Lore dönüşümü için Anthropic Claude API kullanılır. Sayfa metni bu API'ye
  gönderilir. Anthropic'in gizlilik politikası: anthropic.com/privacy</p>

  <h2>İletişim</h2>
  <p>[e-posta adresin]</p>
</body>
</html>
```

---

## Adım 6.8 — GitHub README

`README.md` dosyasını oluştur:

```markdown
# Grimoire

> Okuduğun şey büyüye dönüşür. Dikkatini kaybedersen canavar gelir.

[Demo GIF buraya]

Grimoire, çalışma seanslarını bir dungeon'a, okuduğun her sayfayı AI ile 
fantasy/sci-fi/noir lore'una dönüştüren bir Chrome eklentisi.

## Özellikler

- **Lore dönüşümü** — Wikipedia, arXiv, herhangi bir makale → anında epik destan
- **Dungeon sistemi** — her okuma seansı bir kat aşağı; XP kazan, level atla
- **Canavar saldırısı** — dikkat dağıtıcı sekme açılınca XP kıran canavar çıkar
- **Haftalık boss** — o haftanın odaklanma skoru boss'un zorluğunu belirler
- **Grimoire envanteri** — tüm okuduklarını bir arşivde topla

## Teknik stack

| Katman | Teknoloji |
|---|---|
| Extension | Chrome Manifest V3 |
| UI (popup) | React + Vite + @crxjs/vite-plugin |
| AI | Anthropic Claude API (claude-haiku) |
| Storage | chrome.storage.local |
| Content script | Vanilla JS |

## Kurulum (geliştirme)

```bash
git clone https://github.com/[kullanıcı-adın]/grimoire
cd grimoire
npm install
cp .env.example .env
# .env dosyasına Anthropic API key'ini gir
npm run build
```

Chrome'da `chrome://extensions` → **Load unpacked** → `dist/` klasörünü seç.

## Proje yapısı

```
src/
├── background/    # Service worker (API calls, tab tracking, alarms)
├── content/       # Content script (sidebar, monster UI)
├── popup/         # React popup (session control, grimoire list, settings)
└── shared/        # Sabitler ve storage yardımcı fonksiyonları
```

## Geliştirme notları

- API key'i `.env` dosyasında veya popup Ayarlar'dan girilebilir
- Canavar sistemi test için service worker console'unu kullan
- `chrome.alarms` test: `chrome.alarms.onAlarm.dispatch({ name: 'weekly-boss-check' })`

## Lisans

MIT
```

---

## ✅ Phase 6 Final Checklist

### Teknik

- [ ] `npm run build` hatasız — production build
- [ ] Edge case'ler kapalı: kısa sayfa, geçersiz API key, rate limit, kapalı tab
- [ ] Error boundary popup'ta çalışıyor
- [ ] Storage quota kontrolü var
- [ ] Chrome iç sayfalarında (chrome://) content script çalışmıyor
- [ ] `.env` `.gitignore`'da

### Görsel

- [ ] 4 boyutta ikon (16, 32, 48, 128 px) var ve extension listede görünüyor
- [ ] Popup tasarımı tutarlı ve okunabilir
- [ ] Sidebar animasyonları akıcı
- [ ] Canavar overlay shake animasyonu çalışıyor

### Yayın

- [ ] `manifest.json` version `1.0.0`
- [ ] `dist/` zip'lendi
- [ ] Web Store'a yüklendi
- [ ] Ekran görüntüleri (min. 1) eklendi
- [ ] Gizlilik politikası URL'i eklendi
- [ ] Kısa açıklama 132 karakterin altında
- [ ] Submit edildi (review 1-3 iş günü)

### Portföy

- [ ] GitHub'a push edildi
- [ ] README.md var ve düzgün render oluyor
- [ ] Demo GIF README'de (Loom veya ScreenToGif ile çek)
- [ ] Web Store linki README'de
- [ ] Portföy sitene eklendi

---

## Demo GIF çekme

Loom (ücretsiz) veya ScreenToGif ile şu akışı kaydet:

1. Boş bir Chrome penceresinde extension popup'u aç
2. "Dungeon'a Gir" tıkla
3. Wikipedia'da herhangi bir makaleye git
4. Sidebar'ın açılıp lore metninin gelmesini bekle
5. "Grimoire'a Kaydet" tıkla, XP animasyonu görün
6. Yeni sekmede twitter.com aç → canavar saldırısı overlay'i
7. Popup'u aç → Grimoire tab'ında kayıt görün

Toplam süre: ~45-60 saniye.

---

## Tebrikler

Grimoire tamamlandı. Portföy için güçlü bir proje: teknik derinlik (MV3 + AI entegrasyonu + gamification), gerçek kullanılabilirlik (insanlar indirir), ve görsel anlatı (demo GIF anında anlaşılır).
```
