# Phase 2 — Patch: Chrome Built-in AI

> **Hedef:** Claude API bağımlılığını kaldır, Chrome'un yerleşik Gemini Nano modeliyle değiştir.
> Kullanıcı API key girmez, ücret ödemez, internet gerekmez.
>
> **Ne değişiyor:**
> - `src/shared/ai.js` → yeni, tüm AI mantığı burada
> - `src/background/service-worker.js` → `callClaude` yerine `callBuiltinAI`
> - `manifest.json` → bir permission ekleniyor
> - `src/popup/components/Settings.jsx` → API key alanı kaldırılıyor
> - `src/shared/constants.js` → `CLAUDE_MODEL`, `MAX_LORE_TOKENS` kaldırılıyor
>
> **Ne değişmiyor:** content.js, content.css, storage.js, XP sistemi, canavar sistemi — hepsi aynı kalır.
>
> **Gereksinim:** Chrome 127+ (Chromium tabanlı her tarayıcı işe yarar)

---

## Chrome Built-in AI nedir?

Chrome, Gemini Nano modelini cihaza indirip yerleştiriyor. Extension'lar buna `ai.languageModel` API'siyle erişiyor. Model tamamen lokalde çalışıyor — istek dışarı gitmiyor, ücret yok, API key yok.

**Kısıtlamalar:**
- Gemini Nano, Claude Haiku'dan daha küçük bir model. Lore kalitesi biraz daha düşük olabilir.
- Kullanıcının modelı indirmiş olması gerekiyor (Chrome bunu otomatik yapıyor, ilk kullanımda birkaç dakika beklenebilir).
- Çok uzun promptlar context window'u aşabilir — metin kırpmayı `1500` karakterde tutuyoruz.

---

## Adım P2.1 — manifest.json'a permission ekle

`manifest.json` içindeki `"permissions"` array'ine ekle:

```json
"permissions": [
  "storage",
  "tabs",
  "activeTab",
  "scripting",
  "alarms",
  "aiLanguageModelOriginTrial"
],
```

> `aiLanguageModelOriginTrial` → Chrome'un extension'lara Built-in AI erişimi açan özel permission.

---

## Adım P2.2 — src/shared/ai.js oluştur

Bu dosyayı tamamen sıfırdan yaz:

```js
// Grimoire — Chrome Built-in AI katmanı
// Tüm AI çağrıları buradan geçer.

import { LORE_STYLES } from './constants.js'

// ─── Kullanılabilirlik kontrolü ───────────────────────────────────────────

/**
 * Chrome Built-in AI'ın bu cihazda kullanılabilir olup olmadığını kontrol et.
 * @returns {'available' | 'downloading' | 'unavailable'}
 */
export async function checkAIAvailability() {
  try {
    if (!('ai' in self) || !('languageModel' in self.ai)) {
      return 'unavailable'
    }

    const capabilities = await self.ai.languageModel.capabilities()

    // 'readily' → hazır
    // 'after-download' → model indiriliyor
    // 'no' → bu cihazda desteklenmiyor
    if (capabilities.available === 'readily') return 'available'
    if (capabilities.available === 'after-download') return 'downloading'
    return 'unavailable'
  } catch (err) {
    console.warn('[Grimoire AI] Availability check failed:', err)
    return 'unavailable'
  }
}

// ─── Lore dönüşümü ────────────────────────────────────────────────────────

/**
 * Verilen metni seçili lore stilinde dönüştür.
 * @param {object} params
 * @param {string} params.text       - dönüştürülecek ham metin (max 1500 karakter)
 * @param {string} params.loreStyle  - 'fantasy' | 'scifi' | 'noir' | 'mythology'
 * @returns {Promise<string>} dönüştürülmüş lore metni
 */
export async function transformToLore({ text, loreStyle = 'fantasy' }) {
  const status = await checkAIAvailability()

  if (status === 'unavailable') {
    throw new Error(
      'Chrome Built-in AI bu cihazda desteklenmiyor. Chrome 127+ gerekiyor.'
    )
  }

  if (status === 'downloading') {
    throw new Error(
      'AI modeli indiriliyor. Birkaç dakika sonra tekrar dene.'
    )
  }

  const style = LORE_STYLES[loreStyle] ?? LORE_STYLES.fantasy

  // Metin kırpma — Gemini Nano context window küçük
  const trimmedText = text.slice(0, 1500)

  let session
  try {
    session = await self.ai.languageModel.create({
      systemPrompt: style.systemPrompt,
    })

    const result = await session.prompt(
      `Aşağıdaki metni dönüştür:\n\n${trimmedText}`
    )

    return result.trim()
  } finally {
    // Session'ı serbest bırak — memory yönetimi için önemli
    session?.destroy()
  }
}

// ─── Session önbellekleme (opsiyonel optimizasyon) ────────────────────────
// Her çağrıda yeni session açmak yerine, aynı style için session'ı yeniden
// kullanabiliriz. Ancak service worker uyuyunca session kaybolur, bu yüzden
// basit tutuyoruz — her çağrıda yeni session.
```

---

## Adım P2.3 — constants.js'i temizle

`src/shared/constants.js` dosyasından şu satırları **sil**:

```js
// SİL — artık gerekmiyor
export const CLAUDE_MODEL  = 'claude-haiku-4-5-20251001'
export const MAX_LORE_TOKENS = 600
```

`MAX_INPUT_CHARS` değerini güncelle:

```js
// ESKİ
export const MAX_INPUT_CHARS = 3000

// YENİ — Gemini Nano için daha küçük
export const MAX_INPUT_CHARS = 1500
```

---

## Adım P2.4 — service-worker.js'i güncelle

### Import satırlarını değiştir

**Sil:**
```js
import {
  LORE_STYLES,
  CLAUDE_MODEL,
  MAX_LORE_TOKENS,
  ...
} from '../shared/constants.js'
```

**Ekle (constants import'una dokunma, sadece ai.js'i ekle):**
```js
import { transformToLore, checkAIAvailability } from '../shared/ai.js'
```

### `TRANSFORM_TO_LORE` handler'ını değiştir

**Eski handler'ı tamamen bununla değiştir:**

```js
  if (msg.type === MSG.TRANSFORM_TO_LORE) {
    ;(async () => {
      try {
        const { settings } = await getStorage([STORAGE_KEYS.SETTINGS])
        const loreStyle = settings?.loreStyle ?? 'fantasy'

        const loreText = await transformToLore({
          text: msg.text,
          loreStyle,
        })

        sendResponse({ ok: true, loreText, style: loreStyle })
      } catch (err) {
        console.error('[Grimoire SW] TRANSFORM_TO_LORE error:', err)
        sendResponse({ ok: false, error: err.message })
      }
    })()
    return true
  }
```

### `callClaude` fonksiyonunu sil

Dosyanın sonundaki `async function callClaude(...)` fonksiyonunu tamamen sil — artık `ai.js` bu işi yapıyor.

---

## Adım P2.5 — Settings.jsx'ten API key alanını kaldır

`src/popup/components/Settings.jsx` içindeki API key bölümünü kaldır ve yerine AI durumu göster:

```jsx
// Settings.jsx içindeki API key <Section>'ını tamamen şununla değiştir:

import { useEffect, useState } from 'react'
import { LORE_STYLES } from '../../shared/constants.js'

// ... (diğer importlar aynı)

// Settings fonksiyonu içinde, settings state'in altına ekle:
const [aiStatus, setAiStatus] = useState('checking')

useEffect(() => {
  chrome.runtime.sendMessage({ type: 'CHECK_AI' }, (res) => {
    setAiStatus(res?.status ?? 'unavailable')
  })
}, [])
```

### Settings render içinde API key Section'ını şununla değiştir:

```jsx
{/* AI Durumu */}
<Section title="AI durumu">
  <AIStatusBadge status={aiStatus} />
</Section>
```

### AIStatusBadge bileşenini dosyanın sonuna ekle:

```jsx
function AIStatusBadge({ status }) {
  const config = {
    checking: {
      color: '#534ab7',
      bg: 'rgba(83,74,183,.1)',
      border: 'rgba(83,74,183,.2)',
      text: 'Kontrol ediliyor...',
      sub: null,
    },
    available: {
      color: '#1d9e75',
      bg: 'rgba(29,158,117,.08)',
      border: 'rgba(29,158,117,.2)',
      text: 'Hazır',
      sub: 'Chrome Built-in AI aktif. API key gerekmez.',
    },
    downloading: {
      color: '#ef9f27',
      bg: 'rgba(239,159,39,.08)',
      border: 'rgba(239,159,39,.2)',
      text: 'İndiriliyor',
      sub: 'Gemini Nano modeli indiriliyor. Birkaç dakika sürer.',
    },
    unavailable: {
      color: '#e24b4a',
      bg: 'rgba(226,75,74,.08)',
      border: 'rgba(226,75,74,.2)',
      text: 'Desteklenmiyor',
      sub: 'Chrome 127+ gerekiyor. chrome://flags/#prompt-api-for-gemini-nano aktif et.',
    },
  }

  const c = config[status] ?? config.unavailable

  return (
    <div style={{
      background: c.bg,
      border: `0.5px solid ${c.border}`,
      borderRadius: 8,
      padding: '10px 12px',
    }}>
      <div style={{ fontSize: 13, fontWeight: 500, color: c.color, marginBottom: c.sub ? 4 : 0 }}>
        {c.text}
      </div>
      {c.sub && (
        <div style={{ fontSize: 11, color: '#888780', lineHeight: 1.5 }}>
          {c.sub}
        </div>
      )}
    </div>
  )
}
```

---

## Adım P2.6 — service-worker.js'e CHECK_AI handler ekle

`onMessage.addListener` içine ekle:

```js
  if (msg.type === 'CHECK_AI') {
    ;(async () => {
      const status = await checkAIAvailability()
      sendResponse({ status })
    })()
    return true
  }
```

---

## Adım P2.7 — storage.js'ten apiKey alanını kaldır

`STORAGE_DEFAULTS` içindeki settings'i güncelle:

```js
// ESKİ
[STORAGE_KEYS.SETTINGS]: {
  apiKey: '',
  loreStyle: 'fantasy',
  monsterDifficulty: 'normal',
},

// YENİ
[STORAGE_KEYS.SETTINGS]: {
  loreStyle: 'fantasy',
  monsterDifficulty: 'normal',
},
```

---

## Adım P2.8 — Build al ve test et

```bash
npm run build
```

### Chrome flag kontrolü (ilk kurulumda bir kez)

1. Chrome'da `chrome://flags/#prompt-api-for-gemini-nano` aç
2. **Enabled** yap → Chrome'u yeniden başlat
3. `chrome://components` aç → "Optimization Guide On Device Model" → **Check for update**
4. Model indirmesi tamamlanana kadar bekle (birkaç dakika, arka planda)

### Test et

1. Extension'ı yenile (`chrome://extensions` → yenile)
2. Popup → Ayarlar → "AI durumu: Hazır" görünmeli
3. Seans başlat, Wikipedia'ya git
4. Sidebar açılmalı, Gemini Nano lore üretmeli

---

## ✅ Patch Checklist

- [ ] `manifest.json`'da `aiLanguageModelOriginTrial` permission var
- [ ] `src/shared/ai.js` oluşturuldu
- [ ] `service-worker.js` artık `callClaude` yerine `transformToLore` kullanıyor
- [ ] `constants.js`'de `CLAUDE_MODEL` ve `MAX_LORE_TOKENS` yok
- [ ] `MAX_INPUT_CHARS` 1500 oldu
- [ ] Settings'te API key alanı yok, AI durumu badge'i var
- [ ] `chrome://flags/#prompt-api-for-gemini-nano` aktif
- [ ] Model indirildi (`chrome://components` kontrol)
- [ ] Popup Ayarlar → "Hazır" yazıyor
- [ ] Wikipedia'da lore dönüşümü çalışıyor (5-15 saniye sürebilir)
- [ ] Seans yokken sidebar açılmıyor
- [ ] `npm run build` hatasız

---

## Kullanıcıya gösterilecek mesajlar (hazır)

| Durum | Ne gösterilir |
|---|---|
| Model hazır | Sidebar normal açılır |
| Model indiriliyor | "AI modeli indiriliyor. Birkaç dakika sonra dene." |
| Desteklenmiyor | "Chrome 127+ gerekiyor." + flag linki |
| Metin çok kısa | Sidebar açılmaz, sessiz geçilir |

---

## Neden bu iyi bir portföy kararı

Chrome Built-in AI'ı kullanan extension sayısı henüz çok az — bu teknoloji 2024-2025'in öne çıkan özelliği. "On-device AI, sıfır maliyet, privacy-first" anlatısı işveren için güçlü. README'ye şunu ekle:

```markdown
## Neden Chrome Built-in AI?

Kullanıcıların API key almasını veya ücret ödemesini gerektiren araçlar
gerçek kullanılmaz. Grimoire, Chrome'un yerleşik Gemini Nano modelini
kullanarak sıfır friction sağlar: indirmek = kullanmak.
```
