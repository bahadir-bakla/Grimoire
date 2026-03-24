# Phase 3 — XP Sistemi ve Grimoire Envanteri

> **Hedef:** Sayfaları grimoire'a kaydet, XP kazan, level atla, popup'ta envanter görün.
> **Tahmini süre:** 2–3 saat
> **Gereklilik:** Phase 2 checklist'i tam ✅

---

## Claude Code'a ver

```
Grimoire Phase 3: XP sistemi ve grimoire envanteri.
service-worker.js'e SAVE_SCROLL handler ekle, content.js'deki kaydet butonunu
aktifleştir, popup'a GrimoireList ve CharacterCard bileşenleri ekle.
Mevcut kodları koru, yeni fonksiyonlar ve bileşenler ekle.
```

---

## Adım 3.1 — storage.js'e grimoire fonksiyonları ekle

`src/shared/storage.js` dosyasının sonuna ekle:

```js
/**
 * Grimoire'a yeni kayıt ekle.
 * @param {object} entry - { id, title, url, loreText, xpEarned, savedAt }
 * @returns {object[]} güncellenmiş grimoire array
 */
export async function addToGrimoire(entry) {
  const { grimoire } = await getStorage([STORAGE_KEYS.GRIMOIRE])
  const current = grimoire ?? []

  // Aynı URL'den zaten kayıt var mı?
  const duplicate = current.find(e => e.url === entry.url)
  if (duplicate) {
    console.log('[Grimoire] Duplicate URL, skipping save:', entry.url)
    return { saved: false, reason: 'duplicate', grimoire: current }
  }

  // Başa ekle (en yeni üstte)
  const updated = [entry, ...current]

  // Max 200 kayıt — en eski 20'yi sil
  const trimmed = updated.length > 200
    ? updated.slice(0, 180)
    : updated

  await setStorage({ [STORAGE_KEYS.GRIMOIRE]: trimmed })
  return { saved: true, grimoire: trimmed }
}

/**
 * Grimoire'dan kayıt sil.
 * @param {string} id
 */
export async function removeFromGrimoire(id) {
  const { grimoire } = await getStorage([STORAGE_KEYS.GRIMOIRE])
  const updated = (grimoire ?? []).filter(e => e.id !== id)
  await setStorage({ [STORAGE_KEYS.GRIMOIRE]: updated })
  return updated
}
```

---

## Adım 3.2 — constants.js'e XP sabitleri ekle

`src/shared/constants.js` dosyasına ekle:

```js
// XP hesaplama
export const XP_CONFIG = {
  BASE_XP: 100,                // minimum XP
  SCROLL_MULTIPLIER: 3,        // scroll %'si başına XP
  MAX_XP_PER_SAVE: 400,        // tek kaydın verebileceği max XP
  LONG_READ_BONUS: 50,         // 5dk+ okuma süresi bonusu
  DEEP_SCROLL_BONUS: 75,       // %80+ scroll bonusu
}

// Dungeon derinliği eşikleri
export const DEPTH_THRESHOLDS = [
  { depth: 1, minScrolls: 0 },
  { depth: 2, minScrolls: 3 },
  { depth: 3, minScrolls: 7 },
  { depth: 4, minScrolls: 12 },
  { depth: 5, minScrolls: 18 },
]
```

---

## Adım 3.3 — service-worker.js'e SAVE_SCROLL handler ekle

`src/background/service-worker.js` içindeki `onMessage.addListener` callback'ine, `TRANSFORM_TO_LORE` bloğundan SONRA ekle:

```js
  // ─── Grimoire kaydetme ────────────────────────────────────────────────────

  if (msg.type === MSG.SAVE_SCROLL) {
    ;(async () => {
      try {
        const { saved, reason, grimoire } = await addToGrimoire(msg.entry)

        if (!saved) {
          sendResponse({ ok: false, reason })
          return
        }

        // XP kazan
        const updatedChar = await updateCharacter(msg.entry.xpEarned)

        // Dungeon derinliğini güncelle
        const newDepth = calculateDepthFromScrolls(grimoire.length)
        const { session } = await getStorage([STORAGE_KEYS.SESSION])
        if (session?.isActive) {
          await setStorage({
            [STORAGE_KEYS.SESSION]: { ...session, depth: newDepth },
          })
        }

        // Level atlama kontrolü
        const leveledUp = updatedChar.level > (msg.entry.prevLevel ?? 1)

        sendResponse({
          ok: true,
          character: updatedChar,
          depth: newDepth,
          leveledUp,
        })
      } catch (err) {
        console.error('[Grimoire SW] SAVE_SCROLL error:', err)
        sendResponse({ ok: false, error: err.message })
      }
    })()
    return true
  }
```

### Import satırına addToGrimoire ekle:

```js
import {
  getStorage,
  setStorage,
  drainCharacterXP,
  updateCharacter,
  addToGrimoire,
} from '../shared/storage.js'
```

### Yardımcı fonksiyon ekle (service-worker.js dosyasının sonuna):

```js
/**
 * Toplam scroll sayısından dungeon derinliğini hesapla.
 */
function calculateDepthFromScrolls(scrollCount) {
  for (let i = DEPTH_THRESHOLDS.length - 1; i >= 0; i--) {
    if (scrollCount >= DEPTH_THRESHOLDS[i].minScrolls) {
      return DEPTH_THRESHOLDS[i].depth
    }
  }
  return 1
}
```

### constants.js import'ına DEPTH_THRESHOLDS ekle:

```js
import {
  STORAGE_KEYS,
  MSG,
  DISTRACTION_DOMAINS,
  SCROLLS_PER_DEPTH,
  LORE_STYLES,
  CLAUDE_MODEL,
  MAX_LORE_TOKENS,
  DEPTH_THRESHOLDS,
} from '../shared/constants.js'
```

---

## Adım 3.4 — content.js'deki kaydet butonunu aktifleştir

`src/content/content.js` dosyasında `transformCurrentPage` fonksiyonu içindeki kaydet butonu event listener'ını şununla değiştir:

```js
  // Kaydet butonu
  const saveBtn = document.getElementById('gr-save')
  saveBtn.addEventListener('click', () => saveCurrentPage(res.loreText))
```

### Dosyanın sonuna yeni fonksiyon ekle:

```js
// ─── Sayfayı kaydet ───────────────────────────────────────────────────────

let pageOpenedAt = Date.now()

async function saveCurrentPage(loreText) {
  const saveBtn = document.getElementById('gr-save')
  if (!saveBtn) return

  saveBtn.textContent = 'Kaydediliyor...'
  saveBtn.disabled = true

  // XP hesapla
  const scrollable = document.body.scrollHeight - window.innerHeight
  const scrollPct  = scrollable > 0
    ? Math.min(100, (window.scrollY / scrollable) * 100)
    : 50
  const readSecs   = Math.floor((Date.now() - pageOpenedAt) / 1000)

  let xp = XP_CONFIG.BASE_XP + Math.floor(scrollPct * XP_CONFIG.SCROLL_MULTIPLIER)
  if (readSecs >= 300) xp += XP_CONFIG.LONG_READ_BONUS
  if (scrollPct >= 80) xp += XP_CONFIG.DEEP_SCROLL_BONUS
  xp = Math.min(xp, XP_CONFIG.MAX_XP_PER_SAVE)

  // Mevcut level'ı al
  const { character } = await chrome.storage.local.get(['character'])

  const entry = {
    id:        crypto.randomUUID(),
    title:     document.title.slice(0, 80),
    url:       window.location.href,
    loreText,
    xpEarned:  xp,
    savedAt:   Date.now(),
    scrollPct: Math.floor(scrollPct),
    readSecs,
    prevLevel: character?.level ?? 1,
  }

  const res = await chrome.runtime.sendMessage({
    type: MSG.SAVE_SCROLL,
    entry,
  })

  if (!res.ok) {
    if (res.reason === 'duplicate') {
      saveBtn.textContent = 'Zaten kaydedildi'
    } else {
      saveBtn.textContent = `Hata: ${res.error ?? 'bilinmiyor'}`
    }
    return
  }

  // Başarı UI
  saveBtn.textContent = `+${xp} XP kazandın!`
  document.getElementById('gr-xp-preview').textContent = ''

  if (res.leveledUp) {
    showLevelUpBanner(res.character.level)
  }
}

// ─── Level atlama banner'ı ────────────────────────────────────────────────

function showLevelUpBanner(newLevel) {
  const banner = document.createElement('div')
  banner.style.cssText = `
    position: fixed;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    background: #0f0e17;
    border: 2px solid #7f77dd;
    border-radius: 12px;
    padding: 24px 32px;
    z-index: 2147483647;
    text-align: center;
    font-family: Georgia, serif;
    color: #e8e6d9;
    animation: gr-level-pop .4s ease;
  `
  banner.innerHTML = `
    <div style="font-size:13px;color:#afa9ec;letter-spacing:.1em;margin-bottom:8px">GRİMOİR</div>
    <div style="font-size:28px;font-weight:500;color:#7f77dd;margin-bottom:4px">Seviye ${newLevel}</div>
    <div style="font-size:14px;color:#888780">Yeni bir kat açıldı.</div>
  `
  document.body.appendChild(banner)
  setTimeout(() => banner.remove(), 3000)
}
```

### constants.js import'ına XP_CONFIG ekle:

```js
import { MSG, MAX_INPUT_CHARS, XP_CONFIG } from '../shared/constants.js'
```

---

## Adım 3.5 — Popup bileşenleri oluştur

### src/popup/components/CharacterCard.jsx

```jsx
import { useEffect, useState } from 'react'

export default function CharacterCard({ refreshKey }) {
  const [char, setChar] = useState(null)
  const [session, setSession] = useState(null)

  useEffect(() => {
    chrome.storage.local.get(['character', 'session'], (data) => {
      setChar(data.character ?? { level: 1, xp: 0, xpToNext: 500 })
      setSession(data.session)
    })
  }, [refreshKey])

  if (!char) return null

  const pct = Math.min(100, Math.floor((char.xp / char.xpToNext) * 100))

  return (
    <div style={{
      background: 'rgba(83, 74, 183, 0.08)',
      border: '0.5px solid rgba(83, 74, 183, 0.2)',
      borderRadius: 10,
      padding: '14px 14px 12px',
      marginBottom: 14,
    }}>
      {/* Üst satır: Level + Depth */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'baseline',
        marginBottom: 10,
      }}>
        <span style={{ fontSize: 13, fontWeight: 500, color: '#afa9ec' }}>
          Lv. {char.level}
        </span>
        {session?.isActive && (
          <span style={{ fontSize: 11, color: '#534ab7' }}>
            ▼ {session.depth}. kat
          </span>
        )}
      </div>

      {/* XP bar */}
      <div style={{
        height: 5,
        background: 'rgba(255,255,255,.07)',
        borderRadius: 3,
        overflow: 'hidden',
        marginBottom: 5,
      }}>
        <div style={{
          height: '100%',
          width: `${pct}%`,
          background: '#7f77dd',
          borderRadius: 3,
          transition: 'width .6s ease',
        }} />
      </div>

      {/* XP sayaç */}
      <div style={{
        fontSize: 11,
        color: '#534ab7',
        display: 'flex',
        justifyContent: 'space-between',
      }}>
        <span>{char.xp} XP</span>
        <span>{char.xpToNext} XP gerekli</span>
      </div>
    </div>
  )
}
```

### src/popup/components/GrimoireList.jsx

```jsx
import { useEffect, useState } from 'react'

export default function GrimoireList() {
  const [entries, setEntries] = useState(null)

  useEffect(() => {
    chrome.storage.local.get(['grimoire'], ({ grimoire }) => {
      setEntries(grimoire ?? [])
    })
  }, [])

  if (entries === null) {
    return (
      <div style={{ textAlign: 'center', padding: '24px 0', color: '#534ab7', fontSize: 12 }}>
        Yükleniyor...
      </div>
    )
  }

  if (entries.length === 0) {
    return (
      <div style={{
        textAlign: 'center',
        padding: '24px 16px',
        color: '#888780',
        fontSize: 12,
        lineHeight: 1.6,
      }}>
        Grimoire boş.<br />
        Seans başlat, bir sayfa oku ve kaydet.
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      {entries.map(entry => (
        <EntryCard key={entry.id} entry={entry} />
      ))}
    </div>
  )
}

function EntryCard({ entry }) {
  const date = new Date(entry.savedAt).toLocaleDateString('tr-TR', {
    day: 'numeric', month: 'short',
  })

  return (
    <div
      onClick={() => chrome.tabs.create({ url: entry.url })}
      style={{
        background: 'rgba(255,255,255,.03)',
        border: '0.5px solid rgba(255,255,255,.07)',
        borderRadius: 8,
        padding: '9px 11px',
        cursor: 'pointer',
        transition: 'background .15s, border-color .15s',
      }}
      onMouseEnter={e => {
        e.currentTarget.style.background = 'rgba(83,74,183,.1)'
        e.currentTarget.style.borderColor = 'rgba(83,74,183,.3)'
      }}
      onMouseLeave={e => {
        e.currentTarget.style.background = 'rgba(255,255,255,.03)'
        e.currentTarget.style.borderColor = 'rgba(255,255,255,.07)'
      }}
    >
      <div style={{
        fontSize: 12,
        fontWeight: 500,
        color: '#d4cfb8',
        marginBottom: 4,
        whiteSpace: 'nowrap',
        overflow: 'hidden',
        textOverflow: 'ellipsis',
      }}>
        {entry.title}
      </div>
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        fontSize: 11,
        color: '#888780',
      }}>
        <span>{date}</span>
        <span style={{ color: '#534ab7' }}>+{entry.xpEarned} XP</span>
      </div>
    </div>
  )
}
```

---

## Adım 3.6 — App.jsx'e tab navigasyonu ekle

`src/popup/App.jsx` dosyasını tamamen şununla değiştir:

```jsx
import { useState } from 'react'
import SessionControl from './components/SessionControl.jsx'
import CharacterCard from './components/CharacterCard.jsx'
import GrimoireList from './components/GrimoireList.jsx'

const TABS = ['Seans', 'Grimoire']

export default function App() {
  const [activeTab, setActiveTab] = useState('Seans')
  const [sessionRefreshKey, setSessionRefreshKey] = useState(0)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Header */}
      <div style={{
        padding: '14px 16px 0',
        borderBottom: '0.5px solid rgba(255,255,255,.07)',
        flexShrink: 0,
      }}>
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 12,
        }}>
          <span style={{
            fontSize: 12,
            fontWeight: 600,
            color: '#afa9ec',
            letterSpacing: '.12em',
          }}>
            GRIMOIRE
          </span>
        </div>

        {/* Tab bar */}
        <div style={{ display: 'flex', gap: 0 }}>
          {TABS.map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              style={{
                flex: 1,
                padding: '7px 0',
                background: 'none',
                border: 'none',
                borderBottom: activeTab === tab
                  ? '2px solid #7f77dd'
                  : '2px solid transparent',
                color: activeTab === tab ? '#afa9ec' : '#888780',
                fontSize: 12,
                fontWeight: activeTab === tab ? 500 : 400,
                cursor: 'pointer',
                transition: 'color .15s',
              }}
            >
              {tab}
            </button>
          ))}
        </div>
      </div>

      {/* İçerik */}
      <div style={{ flex: 1, overflowY: 'auto', padding: 16 }}>

        {activeTab === 'Seans' && (
          <>
            <CharacterCard refreshKey={sessionRefreshKey} />
            <SessionControl onSessionChange={() => setSessionRefreshKey(k => k + 1)} />
          </>
        )}

        {activeTab === 'Grimoire' && (
          <GrimoireList />
        )}

      </div>
    </div>
  )
}
```

---

## Adım 3.7 — content.css'e level-up animasyonu ekle

`src/content/content.css` dosyasının sonuna ekle:

```css
@keyframes gr-level-pop {
  0%   { opacity: 0; transform: translate(-50%, -50%) scale(.8); }
  60%  { transform: translate(-50%, -50%) scale(1.05); }
  100% { opacity: 1; transform: translate(-50%, -50%) scale(1); }
}
```

---

## Adım 3.8 — Build al ve test et

```bash
npm run build
```

---

## Test senaryosu

1. Popup → Seans başlat
2. Wikipedia sayfasına git
3. Sidebar açılsın, lore görünsün
4. Biraz scroll yap, birkaç dakika bekle
5. "Grimoire'a Kaydet" tıkla
6. `+XP kazandın!` mesajı görünsün
7. Popup → Grimoire tab'ına geç → kayıt listede görünsün
8. Popup → Seans tab'ında XP bar'ının dolduğunu gör
9. Aynı sayfaya tekrar gidip kaydetmeyi dene → "Zaten kaydedildi" görünsün

---

## ✅ Phase 3 Checklist

- [ ] `npm run build` hatasız çalışıyor
- [ ] Lore görününce "Grimoire'a Kaydet" butonu aktif
- [ ] Kaydet tıklanınca `+XP kazandın!` mesajı çıkıyor
- [ ] `chrome.storage.local`'da `grimoire` array'i doluyor
- [ ] Popup Grimoire tab'ında kayıtlar listeleniyor
- [ ] Kayda tıklanınca orijinal sayfa yeni sekmede açılıyor
- [ ] Popup'ta XP bar dolduğunu gösteriyor
- [ ] Level atlayınca sayfada level-up banner'ı çıkıyor
- [ ] Aynı URL iki kez kaydedilemez, "Zaten kaydedildi" diyor
- [ ] Scroll yüzdesi yüksekse ve okuma süresi uzunsa XP bonusu uygulanıyor

---

## Storage Test Komutu

Service worker DevTools console'unda:

```js
// Grimoire içeriğini gör
chrome.storage.local.get(['grimoire', 'character'], console.log)

// Grimoire'ı sıfırla (sadece geliştirme)
chrome.storage.local.set({ grimoire: [], character: { level: 1, xp: 0, xpToNext: 500 } })
```

---

## Sonraki Adım

Phase 3 checklist'in hepsi ✅ olduktan sonra:

```
PHASE_4_monster.md dosyasını aç ve uygula.
```
