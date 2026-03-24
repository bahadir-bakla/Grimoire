# Phase 2 — Lore Dönüşümü (Claude API)

> **Hedef:** Seans aktifken ziyaret edilen her sayfanın ana metnini Claude API ile fantasy/scifi/noir lore'una çevir, sayfa kenarında sidebar olarak göster.
> **Tahmini süre:** 3–4 saat
> **Gereklilik:** Phase 1 checklist'i tam ✅

---

## Claude Code'a ver

```
Grimoire Phase 2: Claude API ile lore dönüşümü yapacağız.
service-worker.js'e Claude API çağrısı ekle, content.js'e sayfa metni
çekme ve sidebar injection yaz, content.css'e sidebar stilleri ekle.
Mevcut kodları sil değil, yeni fonksiyonları ekle.
```

---

## Adım 2.1 — constants.js'e lore stilleri ekle

`src/shared/constants.js` dosyasına şunları ekle (mevcut içeriği koru, alta ekle):

```js
// Lore stil tanımları
export const LORE_STYLES = {
  fantasy: {
    label: 'Fantasy Destanı',
    systemPrompt: `Sen bir orta çağ fantasy destanı yazarısın.
Görevin: verilen metni epik, kadim ve büyülü bir dil kullanarak yeniden yazmak.
Kurallar:
- Bilimsel kavramlar → kadim sihir ve büyü
- Kurumlar ve yapılar → kaleler, loncalar, krallıklar
- Süreçler → ritüeller, kehanetler, seferler
- Kişiler → kahramanlar, ustalar, bilgeler
- Orijinal bilgiyi koru ama dili tamamen dönüştür
- 3-4 paragraf, her paragraf en fazla 4 cümle
- Açıklama yapma, sadece dönüştürülmüş metni yaz`,
  },

  scifi: {
    label: 'Sci-Fi Teknik Raporu',
    systemPrompt: `Sen bir hard sci-fi evreninde teknik rapor yazan bir araştırmacısın.
Görevin: verilen metni soğuk, kesin ve gelecekçi terminoloji kullanarak yeniden yazmak.
Kurallar:
- Kavramlar → protokoller, algoritmalar, sistemler
- Kişiler → ajanlar, operatörler, koordinatörler
- Yerler → sektörler, istasyonlar, nodlar
- Sayısal ve teknik dil ön planda
- 3-4 paragraf
- Sadece dönüştürülmüş metni yaz`,
  },

  noir: {
    label: 'Noir Dedektif',
    systemPrompt: `Sen yorgun bir dedektifsin, şehrin karanlık sokak monologunu yazıyorsun.
Görevin: verilen metni sinik, şiirsel ve kasvetli bir iç ses olarak yeniden yazmak.
Kurallar:
- Her kavram bir sır, suç veya kadere teslimiyete dönüşür
- Kısa, kesik cümleler. Ara sıra uzun soluklu melankolik pasajlar.
- Şehir metaforları: yağmur, duman, neon, karanlık sokaklar
- 3-4 paragraf
- Sadece dönüştürülmüş metni yaz`,
  },

  mythology: {
    label: 'Kadim Mitoloji',
    systemPrompt: `Sen antik bir mitoloji anlatıcısısın.
Görevin: verilen metni Yunan-Roma mitolojisi tarzında yeniden yazmak.
Kurallar:
- Kavramlar → tanrıların armağanları veya lanetleri
- Kişiler → tanrı, yarı-tanrı, kahraman, ölümlü
- Süreçler → kader, kehanetin gerçekleşmesi, ilahi müdahale
- Epik sıfatlar ve kaderin kaçınılmazlığı hissi
- 3-4 paragraf
- Sadece dönüştürülmüş metni yaz`,
  },
}

// Claude API
export const CLAUDE_MODEL  = 'claude-haiku-4-5-20251001'  // hızlı ve ucuz
export const MAX_INPUT_CHARS = 3000  // token tasarrufu için metin kırpma
export const MAX_LORE_TOKENS = 600
```

---

## Adım 2.2 — service-worker.js'e Claude API ekle

`src/background/service-worker.js` dosyasına import'ları güncelle ve yeni fonksiyonları ekle. Mevcut `endSession`, `startSession` fonksiyonlarına dokunma — sadece ekle:

### Import satırını güncelle (dosyanın başında):

```js
import {
  getStorage,
  setStorage,
  drainCharacterXP,
} from '../shared/storage.js'

import {
  STORAGE_KEYS,
  MSG,
  DISTRACTION_DOMAINS,
  SCROLLS_PER_DEPTH,
  LORE_STYLES,
  CLAUDE_MODEL,
  MAX_LORE_TOKENS,
} from '../shared/constants.js'
```

### Dosyanın sonuna ekle (mevcut listener'ın IÇINE — MSG.GET_STATE bloğundan sonra):

```js
  // ─── Lore dönüşümü ──────────────────────────────────────────────────────

  if (msg.type === MSG.TRANSFORM_TO_LORE) {
    ;(async () => {
      try {
        const { settings } = await getStorage([STORAGE_KEYS.SETTINGS])

        const apiKey = settings?.apiKey || import.meta.env.VITE_ANTHROPIC_API_KEY
        if (!apiKey) {
          sendResponse({ ok: false, error: 'API key eksik. Ayarlar\'dan ekle.' })
          return
        }

        const style = LORE_STYLES[settings?.loreStyle ?? 'fantasy'] ?? LORE_STYLES.fantasy

        const loreText = await callClaude({
          apiKey,
          systemPrompt: style.systemPrompt,
          userText: msg.text,
        })

        sendResponse({ ok: true, loreText, style: settings?.loreStyle ?? 'fantasy' })
      } catch (err) {
        console.error('[Grimoire SW] TRANSFORM_TO_LORE error:', err)
        sendResponse({ ok: false, error: err.message })
      }
    })()
    return true
  }
```

### Claude API fonksiyonu — dosyanın sonuna ekle (listener'ın dışına):

```js
// ─── Claude API ───────────────────────────────────────────────────────────

async function callClaude({ apiKey, systemPrompt, userText }) {
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
      messages: [
        {
          role: 'user',
          content: `Aşağıdaki metni dönüştür:\n\n${userText}`,
        },
      ],
    }),
  })

  if (!response.ok) {
    const err = await response.json().catch(() => ({}))
    throw new Error(err?.error?.message ?? `API hatası: ${response.status}`)
  }

  const data = await response.json()
  const text = data?.content?.[0]?.text

  if (!text) throw new Error('API boş yanıt döndürdü')

  return text.trim()
}
```

---

## Adım 2.3 — content.js'e sayfa metni ve sidebar ekle

`src/content/content.js` dosyasının ÜSTÜNE import ekle, ALTINA yeni fonksiyonları ekle. Mevcut `handleMonsterAttack` fonksiyonunu koru:

### Dosyanın başına ekle:

```js
import { MSG, MAX_INPUT_CHARS } from '../shared/constants.js'
```

### Dosyanın sonuna ekle:

```js
// ─── Sayfa metnini çek ────────────────────────────────────────────────────

function extractPageText() {
  // Önce makale/ana içerik alanını dene
  const selectors = [
    'article',
    'main',
    '[role="main"]',
    '.post-content',
    '.article-content',
    '.entry-content',
    '#content',
  ]

  let root = null
  for (const sel of selectors) {
    root = document.querySelector(sel)
    if (root) break
  }
  root = root ?? document.body

  // Gürültüyü kaldır
  const clone = root.cloneNode(true)
  const noiseSelectors = [
    'script', 'style', 'nav', 'footer', 'header',
    'aside', '.sidebar', '.ad', '.advertisement',
    '.cookie-banner', '.popup', '[aria-hidden="true"]',
  ]
  noiseSelectors.forEach(sel => {
    clone.querySelectorAll(sel).forEach(el => el.remove())
  })

  const text = (clone.innerText ?? clone.textContent ?? '')
    .replace(/\s+/g, ' ')
    .trim()

  return text.slice(0, MAX_INPUT_CHARS)
}

// ─── Sidebar DOM ──────────────────────────────────────────────────────────

function getSidebar() {
  return document.getElementById('gr-sidebar')
}

function createSidebar() {
  if (getSidebar()) return  // zaten var

  const sidebar = document.createElement('div')
  sidebar.id = 'gr-sidebar'
  sidebar.innerHTML = `
    <div class="gr-sidebar-header">
      <span class="gr-sidebar-title">GRIMOIRE</span>
      <button class="gr-sidebar-close" id="gr-close" title="Kapat">×</button>
    </div>
    <div class="gr-sidebar-body" id="gr-body">
      <div class="gr-loading" id="gr-loading">
        <div class="gr-loading-dot"></div>
        <div class="gr-loading-dot"></div>
        <div class="gr-loading-dot"></div>
      </div>
      <div class="gr-lore-text" id="gr-lore" style="display:none"></div>
      <div class="gr-error" id="gr-error" style="display:none"></div>
    </div>
    <div class="gr-sidebar-footer" id="gr-footer" style="display:none">
      <button class="gr-save-btn" id="gr-save">Grimoire'a Kaydet</button>
      <div class="gr-xp-preview" id="gr-xp-preview"></div>
    </div>
  `

  document.body.appendChild(sidebar)

  document.getElementById('gr-close').addEventListener('click', () => {
    sidebar.classList.add('gr-sidebar-closing')
    setTimeout(() => sidebar.remove(), 250)
  })
}

function showLoading() {
  document.getElementById('gr-loading').style.display = 'flex'
  document.getElementById('gr-lore').style.display   = 'none'
  document.getElementById('gr-error').style.display  = 'none'
  document.getElementById('gr-footer').style.display = 'none'
}

function showLore(loreText, xpPreview) {
  document.getElementById('gr-loading').style.display = 'none'
  document.getElementById('gr-error').style.display   = 'none'

  const loreEl = document.getElementById('gr-lore')
  loreEl.style.display = 'block'

  // Paragraf paragraf render et
  const paragraphs = loreText.split('\n\n').filter(Boolean)
  loreEl.innerHTML = paragraphs
    .map(p => `<p>${p.trim()}</p>`)
    .join('')

  document.getElementById('gr-footer').style.display = 'block'
  document.getElementById('gr-xp-preview').textContent = `+${xpPreview} XP kazanacaksın`
}

function showError(message) {
  document.getElementById('gr-loading').style.display = 'none'
  document.getElementById('gr-lore').style.display    = 'none'

  const errEl = document.getElementById('gr-error')
  errEl.style.display = 'block'
  errEl.textContent = message
}

// ─── XP hesapla (scroll derinliğine göre) ────────────────────────────────

function calculateXPPreview() {
  const scrollable = document.body.scrollHeight - window.innerHeight
  const scrollPct = scrollable > 0
    ? Math.min(100, (window.scrollY / scrollable) * 100)
    : 50

  return Math.floor(100 + scrollPct * 3)  // 100–400 arası XP
}

// ─── Ana dönüşüm akışı ────────────────────────────────────────────────────

let currentLoreText  = null
let currentPageTitle = null

async function transformCurrentPage() {
  const text = extractPageText()

  if (text.length < 150) {
    console.log('[Grimoire] Not enough text on page, skipping transform')
    return
  }

  createSidebar()
  showLoading()

  currentPageTitle = document.title.slice(0, 80)
  currentLoreText  = null

  const res = await chrome.runtime.sendMessage({
    type: MSG.TRANSFORM_TO_LORE,
    text,
  })

  if (!res.ok) {
    showError(`Lore dönüşümü başarısız: ${res.error}`)
    return
  }

  currentLoreText = res.loreText
  const xpPreview = calculateXPPreview()
  showLore(res.loreText, xpPreview)

  // Kaydet butonu (Phase 3'te tamamlanacak — şimdilik log)
  document.getElementById('gr-save').addEventListener('click', () => {
    console.log('[Grimoire] Save clicked — Phase 3\'te tamamlanacak')
    document.getElementById('gr-save').textContent = 'Phase 3\'te aktif olacak'
    document.getElementById('gr-save').disabled = true
  })
}

// ─── Seans durumunu kontrol et, aktifse dönüştür ─────────────────────────

chrome.storage.local.get(['session'], ({ session }) => {
  if (session?.isActive) {
    // Küçük gecikme — sayfa tam yüklensin
    setTimeout(transformCurrentPage, 800)
  }
})
```

---

## Adım 2.4 — content.css'e sidebar stilleri ekle

`src/content/content.css` dosyasını tamamen şununla değiştir:

```css
/* ── Sidebar ─────────────────────────────────────────────────────────── */

#gr-sidebar {
  position: fixed;
  top: 0;
  right: 0;
  width: 320px;
  height: 100vh;
  background: #0f0e17;
  color: #e8e6d9;
  font-family: Georgia, 'Times New Roman', serif;
  font-size: 14px;
  line-height: 1.75;
  z-index: 2147483647;
  display: flex;
  flex-direction: column;
  border-left: 1px solid rgba(175, 169, 236, 0.2);
  animation: gr-slide-in 0.25s ease;
  overflow: hidden;
}

#gr-sidebar.gr-sidebar-closing {
  animation: gr-slide-out 0.25s ease forwards;
}

@keyframes gr-slide-in {
  from { transform: translateX(100%); opacity: 0; }
  to   { transform: translateX(0);    opacity: 1; }
}

@keyframes gr-slide-out {
  from { transform: translateX(0);    opacity: 1; }
  to   { transform: translateX(100%); opacity: 0; }
}

/* ── Header ──────────────────────────────────────────────────────────── */

.gr-sidebar-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 14px 16px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.06);
  flex-shrink: 0;
}

.gr-sidebar-title {
  font-family: -apple-system, BlinkMacSystemFont, sans-serif;
  font-size: 11px;
  font-weight: 600;
  letter-spacing: .14em;
  color: #afa9ec;
}

.gr-sidebar-close {
  background: none;
  border: none;
  color: #534ab7;
  font-size: 22px;
  line-height: 1;
  cursor: pointer;
  padding: 0 2px;
  transition: color .15s;
}

.gr-sidebar-close:hover {
  color: #afa9ec;
}

/* ── Body ─────────────────────────────────────────────────────────────── */

.gr-sidebar-body {
  flex: 1;
  overflow-y: auto;
  padding: 16px;
  scrollbar-width: thin;
  scrollbar-color: rgba(83, 74, 183, 0.4) transparent;
}

.gr-lore-text {
  font-style: italic;
  color: #d4cfb8;
}

.gr-lore-text p {
  margin: 0 0 14px;
}

.gr-lore-text p:last-child {
  margin-bottom: 0;
}

.gr-error {
  font-family: -apple-system, BlinkMacSystemFont, sans-serif;
  font-size: 12px;
  color: #e24b4a;
  background: rgba(226, 75, 74, 0.08);
  border: 1px solid rgba(226, 75, 74, 0.2);
  border-radius: 6px;
  padding: 10px 12px;
  line-height: 1.5;
}

/* ── Loading animasyonu ───────────────────────────────────────────────── */

.gr-loading {
  display: flex;
  gap: 6px;
  align-items: center;
  justify-content: center;
  padding: 32px 0;
}

.gr-loading-dot {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: #534ab7;
  animation: gr-pulse 1.2s ease-in-out infinite;
}

.gr-loading-dot:nth-child(2) { animation-delay: .2s; }
.gr-loading-dot:nth-child(3) { animation-delay: .4s; }

@keyframes gr-pulse {
  0%, 100% { opacity: .3; transform: scale(.8); }
  50%       { opacity: 1;  transform: scale(1.1); }
}

/* ── Footer ──────────────────────────────────────────────────────────── */

.gr-sidebar-footer {
  padding: 14px 16px;
  border-top: 1px solid rgba(255, 255, 255, 0.06);
  flex-shrink: 0;
}

.gr-save-btn {
  width: 100%;
  padding: 10px 0;
  background: #534ab7;
  color: #fff;
  border: none;
  border-radius: 7px;
  font-family: -apple-system, BlinkMacSystemFont, sans-serif;
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  transition: background .15s;
  margin-bottom: 6px;
}

.gr-save-btn:hover  { background: #7f77dd; }
.gr-save-btn:disabled { background: #2c2a4a; color: #534ab7; cursor: default; }

.gr-xp-preview {
  font-family: -apple-system, BlinkMacSystemFont, sans-serif;
  font-size: 11px;
  color: #534ab7;
  text-align: center;
}

/* ── Canavar saldırı banner'ı (Phase 1'den) ─────────────────────────── */

#gr-attack-banner {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  background: #a32d2d;
  color: #fff;
  font-family: sans-serif;
  font-size: 13px;
  padding: 10px 16px;
  z-index: 2147483646;
  display: flex;
  justify-content: space-between;
  align-items: center;
}
```

---

## Adım 2.5 — Build al ve test et

```bash
npm run build
```

Chrome'da extension'ı yenile.

---

## Test senaryosu

1. Popup'tan seans başlat
2. Wikipedia'da herhangi bir makaleye git (örn. `en.wikipedia.org/wiki/Mitochondria`)
3. ~1 saniye bekle → sağ tarafta Grimoire sidebar açılmalı
4. Loading animasyonu görünmeli
5. 5-10 saniye içinde lore metni görünmeli
6. Footer'da "Grimoire'a Kaydet" butonu görünmeli

---

## ✅ Phase 2 Checklist

- [ ] `npm run build` hatasız çalışıyor
- [ ] `.env` dosyasında geçerli bir Anthropic API key var
- [ ] Seans aktifken Wikipedia sayfasına gidince sidebar açılıyor
- [ ] Loading animasyonu (3 nokta) görünüyor
- [ ] 5–15 saniye içinde lore metni sidebar'da çıkıyor
- [ ] Lore metni seçilen stile (fantasy/scifi/noir) uygun
- [ ] Sidebar kapatma butonu (×) çalışıyor, animasyonla kapanıyor
- [ ] "Grimoire'a Kaydet" butonu görünüyor (Phase 3'te dolacak)
- [ ] Çok kısa sayfalarda (< 150 karakter) sidebar açılmıyor
- [ ] Hatalı API key'de sidebar'da hata mesajı görünüyor, extension çökmüyor

---

## API Key Ayarı

Şu an `.env` üzerinden alıyoruz. Kullanıcıya soracak Settings sayfası Phase 5'te gelecek. Test için:

```
# .env
VITE_ANTHROPIC_API_KEY=sk-ant-...
```

⚠️ `.env`'nin `.gitignore`'da olduğunu kontrol et.

---

## Sık Karşılaşılan Hatalar

**"API hatası: 401"**
→ API key yanlış veya `.env` değişkeni build'e yansımamış. `npm run build` sonrası tekrar dene.

**"API hatası: 429"**
→ Rate limit. Birkaç saniye bekle, tekrar dene.

**Sidebar çıkmıyor**
→ Content script yüklendi mi? Sayfada `[Grimoire] Content script loaded` logu var mı? Extension'ı yenile.

**"Could not establish connection"**
→ Service worker uyumuş olabilir. Extension sayfasından "inspect service worker" ile uyandır.

**Lore çok kısa veya alakasız**
→ `MAX_INPUT_CHARS` değerini düşür veya `systemPrompt`'u düzenle.

---

## Sonraki Adım

Phase 2 checklist'in hepsi ✅ olduktan sonra:

```
PHASE_3_xp.md dosyasını aç ve uygula.
```
