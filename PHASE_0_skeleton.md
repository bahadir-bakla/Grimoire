# Phase 0 — Proje İskeleti

> **Hedef:** Chrome'a yüklenebilen, hatasız build alan, boş ama çalışan extension.
> **Tahmini süre:** 1–2 saat
> **Bu phase bitmeden Phase 1'e geçme.**

---

## Claude Code'a ver

```
Grimoire adında bir Chrome Extension projesi kuruyoruz. Manifest V3, React + Vite kullanacağız. Bu phase'de sadece iskelet kurulacak — hiçbir iş mantığı yok. Aşağıdaki adımları sırayla uygula.
```

---

## Adım 0.1 — Klasör yapısını oluştur

Proje kök dizininde şu yapıyı oluştur:

```
grimoire/
├── manifest.json
├── popup.html
├── .env
├── .env.example
├── .gitignore
├── package.json
├── vite.config.js
├── public/
│   └── icons/
│       ├── icon16.png    ← placeholder, sonra değiştirilecek
│       ├── icon32.png
│       ├── icon48.png
│       └── icon128.png
└── src/
    ├── background/
    │   └── service-worker.js
    ├── content/
    │   ├── content.js
    │   └── content.css
    ├── popup/
    │   ├── main.jsx
    │   ├── App.jsx
    │   └── index.css
    └── shared/
        ├── constants.js
        └── storage.js
```

---

## Adım 0.2 — package.json

```json
{
  "name": "grimoire",
  "version": "0.1.0",
  "private": true,
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "preview": "vite preview"
  },
  "dependencies": {
    "react": "^18.2.0",
    "react-dom": "^18.2.0"
  },
  "devDependencies": {
    "@crxjs/vite-plugin": "^2.0.0-beta.23",
    "@vitejs/plugin-react": "^4.2.0",
    "vite": "^5.0.0"
  }
}
```

Sonra terminalde:

```bash
npm install
```

---

## Adım 0.3 — manifest.json

```json
{
  "manifest_version": 3,
  "name": "Grimoire",
  "version": "0.1.0",
  "description": "Okuduğun şey büyüye dönüşür. Dikkatini kaybedersen canavar gelir.",
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
      "16": "public/icons/icon16.png",
      "32": "public/icons/icon32.png",
      "48": "public/icons/icon48.png",
      "128": "public/icons/icon128.png"
    }
  },
  "icons": {
    "16": "public/icons/icon16.png",
    "32": "public/icons/icon32.png",
    "48": "public/icons/icon48.png",
    "128": "public/icons/icon128.png"
  }
}
```

---

## Adım 0.4 — vite.config.js

```js
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { crx } from '@crxjs/vite-plugin'
import manifest from './manifest.json'

export default defineConfig({
  plugins: [
    react(),
    crx({ manifest }),
  ],
  build: {
    rollupOptions: {
      input: {
        popup: 'popup.html',
      },
    },
  },
})
```

---

## Adım 0.5 — popup.html

```html
<!DOCTYPE html>
<html lang="tr">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Grimoire</title>
    <style>
      body {
        width: 340px;
        min-height: 480px;
        margin: 0;
        padding: 0;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
        background: #0f0e17;
        color: #e8e6d9;
      }
    </style>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/popup/main.jsx"></script>
  </body>
</html>
```

---

## Adım 0.6 — Boş kaynak dosyaları

### src/background/service-worker.js

```js
// Grimoire — Service Worker
// Phase 0: sadece başlangıç logu

console.log('[Grimoire] Service worker started — v0.1.0')

// Boş mesaj handler (Phase 1'de dolacak)
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  console.log('[Grimoire SW] Message received:', msg.type)
  return true
})
```

### src/content/content.js

```js
// Grimoire — Content Script
// Phase 0: sadece sayfa logu

console.log('[Grimoire] Content script loaded:', window.location.href)

// Phase 1'de background'dan mesaj dinleyeceğiz
chrome.runtime.onMessage.addListener((msg) => {
  console.log('[Grimoire CS] Message received:', msg.type)
})
```

### src/content/content.css

```css
/* Grimoire content styles — Phase 0: boş */
/* Phase 2'de sidebar stilleri eklenecek */
```

### src/shared/constants.js

```js
// Grimoire — Sabitler
// Phase 0: temel sabitler

export const VERSION = '0.1.0'

export const STORAGE_KEYS = {
  SESSION:   'session',
  CHARACTER: 'character',
  GRIMOIRE:  'grimoire',
  SETTINGS:  'settings',
}
```

### src/shared/storage.js

```js
// Grimoire — Storage yardımcı fonksiyonlar
// Phase 0: sadece iskelet, Phase 1'de genişleyecek

import { STORAGE_KEYS } from './constants.js'

export const STORAGE_DEFAULTS = {
  [STORAGE_KEYS.SESSION]: null,
  [STORAGE_KEYS.CHARACTER]: {
    level: 1,
    xp: 0,
    xpToNext: 500,
  },
  [STORAGE_KEYS.GRIMOIRE]: [],
  [STORAGE_KEYS.SETTINGS]: {
    apiKey: '',
    loreStyle: 'fantasy',
    monsterDifficulty: 'normal',
  },
}

/**
 * Storage'dan veri oku
 * @param {string|string[]|null} keys - null ise tüm default key'ler
 */
export async function getStorage(keys = null) {
  const k = keys ?? Object.keys(STORAGE_DEFAULTS)
  return chrome.storage.local.get(k)
}

/**
 * Storage'a veri yaz
 * @param {object} data
 */
export async function setStorage(data) {
  return chrome.storage.local.set(data)
}

/**
 * Storage'ı tamamen sıfırla (geliştirme için)
 */
export async function resetStorage() {
  await chrome.storage.local.clear()
  await setStorage(STORAGE_DEFAULTS)
  console.log('[Grimoire] Storage reset to defaults')
}
```

### src/popup/main.jsx

```jsx
import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import './index.css'

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
)
```

### src/popup/App.jsx

```jsx
import React from 'react'

export default function App() {
  return (
    <div style={{ padding: 20 }}>
      <h1 style={{
        fontSize: 18,
        fontWeight: 500,
        color: '#afa9ec',
        marginBottom: 8,
        letterSpacing: '.06em',
      }}>
        GRIMOIRE
      </h1>
      <p style={{ fontSize: 13, color: '#888780' }}>
        Phase 0 — iskelet hazır.
      </p>
    </div>
  )
}
```

### src/popup/index.css

```css
* {
  box-sizing: border-box;
  margin: 0;
  padding: 0;
}

:root {
  --bg:          #0f0e17;
  --surface:     #1a1a2e;
  --border:      rgba(255, 255, 255, 0.08);
  --text:        #e8e6d9;
  --text-muted:  #888780;
  --purple:      #7f77dd;
  --purple-dark: #534ab7;
  --teal:        #1d9e75;
  --red:         #e24b4a;
  --amber:       #ef9f27;
}

body {
  background: var(--bg);
  color: var(--text);
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
  font-size: 14px;
  line-height: 1.5;
}

button {
  cursor: pointer;
  font-family: inherit;
}
```

---

## Adım 0.7 — .env dosyaları

### .env

```
VITE_ANTHROPIC_API_KEY=sk-ant-buraya-gir
```

### .env.example

```
VITE_ANTHROPIC_API_KEY=sk-ant-...
```

### .gitignore

```
node_modules/
dist/
.env
*.local
```

---

## Adım 0.8 — Placeholder ikonlar oluştur

Terminal'de çalıştır (ImageMagick varsa):

```bash
for size in 16 32 48 128; do
  convert -size ${size}x${size} xc:#534ab7 public/icons/icon${size}.png
done
```

ImageMagick yoksa: `public/icons/` klasörüne herhangi 4 PNG koy, isimlerini `icon16.png`, `icon32.png`, `icon48.png`, `icon128.png` yap. Phase 6'da gerçek ikonları yapacağız.

---

## Adım 0.9 — Build al ve Chrome'a yükle

```bash
npm run build
```

Hatasız bitince:

1. Chrome'da `chrome://extensions` aç
2. Sağ üstten **Developer mode** aç
3. **Load unpacked** → `grimoire/dist/` klasörünü seç
4. Extension listede "Grimoire" görünmeli

---

## ✅ Phase 0 Checklist

Hepsini tamamlamadan Phase 1'e geçme:

- [ ] `npm install` hatasız bitti
- [ ] `npm run build` hatasız bitti, `dist/` klasörü oluştu
- [ ] Chrome'da extension yüklendi, "Grimoire" listede görünüyor
- [ ] Extension ikonuna tıklayınca popup açılıyor, "GRIMOIRE / Phase 0" yazısı görünüyor
- [ ] Herhangi bir sayfada DevTools → Console'da `[Grimoire] Content script loaded: <url>` görünüyor
- [ ] `chrome://extensions` → "Grimoire" → "Service worker" linkine tıklayınca ayrı DevTools açılıyor ve `[Grimoire] Service worker started` logu görünüyor
- [ ] `.env` dosyası var ve `.gitignore`'da
- [ ] `src/shared/storage.js` import edildiğinde hata vermiyor

---

## Sık Karşılaşılan Hatalar

**"Cannot use import statement in content script"**
→ `vite.config.js`'de `crx` plugin doğru kurulu mu kontrol et.

**"Extension ID değişti, storage sıfırlandı"**
→ Her `Load unpacked` aynı klasörü gösterdiği sürece ID aynı kalır. `dist/` klasörünü silip tekrar build alırsan ID değişmez.

**"Manifest file is missing or unreadable"**
→ `Load unpacked` yaparken `dist/` klasörünü seç, `grimoire/` kökünü değil.

**Icon hatası**
→ `public/icons/` klasöründe 4 PNG olduğundan emin ol.

---

## Sonraki Adım

Phase 0 checklist'in hepsi ✅ olduktan sonra:

```
PHASE_1_session.md dosyasını aç ve uygula.
```
