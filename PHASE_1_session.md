# Phase 1 — Seans ve Tab Takibi

> **Hedef:** Kullanıcı "Dungeon'a Gir" dediğinde seans başlasın, farklı sekmeye geçince background bunu tespit etsin, seans storage'a yazılsın.
> **Tahmini süre:** 2–3 saat
> **Gereklilik:** Phase 0 checklist'i tam ✅

---

## Claude Code'a ver

```
Grimoire extension'ın Phase 1'ini uyguluyoruz: seans sistemi ve tab takibi.
storage.js'i genişlet, service-worker.js'e mesaj handler'ları ekle, popup'a
SessionControl bileşeni ekle. Mevcut dosyaları sil değil, genişlet.
```

---

## Adım 1.1 — storage.js'i genişlet

`src/shared/storage.js` dosyasını tamamen şununla değiştir:

```js
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

export async function getStorage(keys = null) {
  const k = keys ?? Object.keys(STORAGE_DEFAULTS)
  return chrome.storage.local.get(k)
}

export async function setStorage(data) {
  return chrome.storage.local.set(data)
}

export async function resetStorage() {
  await chrome.storage.local.clear()
  await setStorage(STORAGE_DEFAULTS)
  console.log('[Grimoire] Storage reset')
}

/**
 * Karaktere XP ekle, gerekirse level atla.
 * @param {number} xpDelta - eklenecek XP miktarı
 * @returns {object} güncellenmiş character objesi
 */
export async function updateCharacter(xpDelta) {
  const { character } = await getStorage([STORAGE_KEYS.CHARACTER])
  const char = { ...character }

  char.xp += xpDelta

  // Level atlama döngüsü
  while (char.xp >= char.xpToNext) {
    char.xp -= char.xpToNext
    char.level += 1
    char.xpToNext = Math.floor(char.xpToNext * 1.45)
    console.log(`[Grimoire] Level up! Now level ${char.level}`)
  }

  await setStorage({ [STORAGE_KEYS.CHARACTER]: char })
  return char
}

/**
 * Karakterden XP düş (negatife düşürme).
 * @param {number} xpDelta - düşülecek XP miktarı
 * @returns {object} güncellenmiş character objesi
 */
export async function drainCharacterXP(xpDelta) {
  const { character } = await getStorage([STORAGE_KEYS.CHARACTER])
  const char = { ...character }
  char.xp = Math.max(0, char.xp - xpDelta)
  await setStorage({ [STORAGE_KEYS.CHARACTER]: char })
  return char
}
```

---

## Adım 1.2 — constants.js'e seans sabitleri ekle

`src/shared/constants.js` dosyasını tamamen şununla değiştir:

```js
export const VERSION = '0.1.0'

export const STORAGE_KEYS = {
  SESSION:   'session',
  CHARACTER: 'character',
  GRIMOIRE:  'grimoire',
  SETTINGS:  'settings',
}

// Mesaj tipleri — background ↔ popup ↔ content script arası iletişim
export const MSG = {
  // Popup → Background
  START_SESSION: 'START_SESSION',
  END_SESSION:   'END_SESSION',
  GET_STATE:     'GET_STATE',

  // Background → Content Script
  MONSTER_ATTACK:   'MONSTER_ATTACK',
  SESSION_ENDED:    'SESSION_ENDED',

  // Content Script → Background
  TRANSFORM_TO_LORE: 'TRANSFORM_TO_LORE',  // Phase 2'de
  SAVE_SCROLL:       'SAVE_SCROLL',          // Phase 3'te

  // Background → Popup
  XP_UPDATE:    'XP_UPDATE',
  LEVEL_UP:     'LEVEL_UP',
}

// Dikkat dağıtıcı domain'ler (canavar tetikler)
export const DISTRACTION_DOMAINS = [
  'twitter.com',
  'x.com',
  'instagram.com',
  'tiktok.com',
  'reddit.com',
  'youtube.com',
  'facebook.com',
  'twitch.tv',
  'netflix.com',
]

// Dungeon derinliği hesaplama
// Her 3 kayıtlı scroll = 1 kat aşağı
export const SCROLLS_PER_DEPTH = 3
```

---

## Adım 1.3 — service-worker.js'i yaz

`src/background/service-worker.js` dosyasını tamamen şununla değiştir:

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
} from '../shared/constants.js'

console.log('[Grimoire] Service worker started — v0.1.0')

// ─── Yardımcı fonksiyonlar ────────────────────────────────────────────────

/**
 * Aktif seans var mı?
 */
async function getActiveSession() {
  const { session } = await getStorage([STORAGE_KEYS.SESSION])
  return session?.isActive ? session : null
}

/**
 * Dungeon derinliğini grimoire boyutuna göre hesapla
 */
async function calculateDepth() {
  const { grimoire } = await getStorage([STORAGE_KEYS.GRIMOIRE])
  return Math.floor((grimoire?.length ?? 0) / SCROLLS_PER_DEPTH) + 1
}

/**
 * Belirtilen tab'ın domain'i dikkat dağıtıcı mı?
 */
function isDistraction(url = '') {
  return DISTRACTION_DOMAINS.some(d => url.includes(d))
}

// ─── Seans başlat ────────────────────────────────────────────────────────

async function startSession(focusTabId) {
  const depth = await calculateDepth()

  const session = {
    isActive:   true,
    startedAt:  Date.now(),
    focusTabId,
    depth,
  }

  await setStorage({ [STORAGE_KEYS.SESSION]: session })
  console.log('[Grimoire] Session started, focusTabId:', focusTabId, 'depth:', depth)
  return session
}

// ─── Seans bitir ─────────────────────────────────────────────────────────

async function endSession() {
  const session = await getActiveSession()
  if (!session) return null

  const duration = Date.now() - session.startedAt
  await setStorage({ [STORAGE_KEYS.SESSION]: null })

  console.log('[Grimoire] Session ended, duration:', Math.floor(duration / 1000), 's')
  return { duration }
}

// ─── Mesaj handler ────────────────────────────────────────────────────────

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  console.log('[Grimoire SW] Message:', msg.type)

  // Seans başlat
  if (msg.type === MSG.START_SESSION) {
    ;(async () => {
      try {
        // Popup'tan gelen mesajda tab ID'si yok, aktif tab'ı bul
        const [activeTab] = await chrome.tabs.query({
          active: true,
          currentWindow: true,
        })
        const session = await startSession(activeTab?.id ?? null)
        sendResponse({ ok: true, session })
      } catch (err) {
        console.error('[Grimoire SW] startSession error:', err)
        sendResponse({ ok: false, error: err.message })
      }
    })()
    return true  // async sendResponse için zorunlu
  }

  // Seans bitir
  if (msg.type === MSG.END_SESSION) {
    ;(async () => {
      try {
        const result = await endSession()
        sendResponse({ ok: true, result })
      } catch (err) {
        sendResponse({ ok: false, error: err.message })
      }
    })()
    return true
  }

  // Güncel state'i döndür (popup açılınca kullanır)
  if (msg.type === MSG.GET_STATE) {
    ;(async () => {
      try {
        const data = await getStorage()
        sendResponse({ ok: true, data })
      } catch (err) {
        sendResponse({ ok: false, error: err.message })
      }
    })()
    return true
  }

  return true
})

// ─── Tab değişim takibi ───────────────────────────────────────────────────

chrome.tabs.onActivated.addListener(async ({ tabId, windowId }) => {
  const session = await getActiveSession()
  if (!session) return

  // Kullanıcı fokus tab'ına döndü → tehlike yok
  if (tabId === session.focusTabId) {
    console.log('[Grimoire] Back to focus tab')
    return
  }

  // Farklı sekme → tab bilgisini al
  let tab
  try {
    tab = await chrome.tabs.get(tabId)
  } catch {
    return  // tab zaten kapanmış
  }

  const url = tab.url ?? ''
  const trigger = isDistraction(url) ? 'social_media' : 'tab_switch'

  console.log('[Grimoire] Distraction detected, trigger:', trigger, 'url:', url)

  // Fokus tab'ına canavar mesajı gönder
  // Phase 4'te monster seçimi burada yapılacak, şimdi basit uyarı
  try {
    await chrome.tabs.sendMessage(session.focusTabId, {
      type: MSG.MONSTER_ATTACK,
      trigger,
      // monster ve xpLost Phase 4'te eklenecek
    })
  } catch (err) {
    // Fokus tab'ı kapalı veya content script yok — sessizce geç
    console.log('[Grimoire] Could not send to focus tab:', err.message)
  }
})

// ─── Tab kapatılınca ──────────────────────────────────────────────────────

chrome.tabs.onRemoved.addListener(async (tabId) => {
  const session = await getActiveSession()
  if (!session) return

  if (tabId === session.focusTabId) {
    // Kullanıcı fokus tab'ını kapattı → seansı bitir
    console.log('[Grimoire] Focus tab closed, ending session')
    await endSession()
  }
})
```

---

## Adım 1.4 — content.js'e mesaj dinleyici ekle

`src/content/content.js` dosyasını tamamen şununla değiştir:

```js
import { MSG } from '../shared/constants.js'

console.log('[Grimoire] Content script loaded:', window.location.href)

// ─── Background'dan gelen mesajları dinle ─────────────────────────────────

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  console.log('[Grimoire CS] Message received:', msg.type)

  if (msg.type === MSG.MONSTER_ATTACK) {
    handleMonsterAttack(msg)
    sendResponse({ ok: true })
  }

  return true
})

// ─── Phase 1: Basit canavar uyarısı (Phase 4'te tamamen değişecek) ────────

function handleMonsterAttack(msg) {
  // Mevcut uyarı varsa kaldır
  document.getElementById('gr-attack-banner')?.remove()

  const banner = document.createElement('div')
  banner.id = 'gr-attack-banner'
  banner.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    background: #a32d2d;
    color: #fff;
    font-family: sans-serif;
    font-size: 13px;
    padding: 10px 16px;
    z-index: 999999;
    display: flex;
    justify-content: space-between;
    align-items: center;
  `

  const label = msg.trigger === 'social_media'
    ? 'Sosyal medyaya daldın! Geri dön veya XP kaybedersin.'
    : 'Başka sekmeye geçtin. Fokus tab\'ına dön!'

  banner.innerHTML = `
    <span>${label}</span>
    <button onclick="this.parentElement.remove()" style="
      background: none;
      border: 1px solid rgba(255,255,255,.4);
      color: #fff;
      border-radius: 4px;
      padding: 3px 10px;
      cursor: pointer;
      font-size: 12px;
    ">Tamam</button>
  `

  document.body.prepend(banner)

  // 6 saniye sonra otomatik kapat
  setTimeout(() => banner?.remove(), 6000)
}
```

---

## Adım 1.5 — Popup'a SessionControl bileşeni ekle

### Yeni dosya: src/popup/components/SessionControl.jsx

```jsx
import { useEffect, useState, useRef } from 'react'
import { MSG } from '../../shared/constants.js'

export default function SessionControl({ onSessionChange }) {
  const [session, setSession] = useState(null)
  const [elapsed, setElapsed] = useState(0)
  const [loading, setLoading] = useState(false)
  const intervalRef = useRef(null)

  // Popup açıldığında mevcut state'i çek
  useEffect(() => {
    chrome.runtime.sendMessage({ type: MSG.GET_STATE }, (res) => {
      if (res?.ok) {
        setSession(res.data.session)
      }
    })
  }, [])

  // Timer
  useEffect(() => {
    clearInterval(intervalRef.current)

    if (session?.isActive) {
      const tick = () => {
        setElapsed(Math.floor((Date.now() - session.startedAt) / 1000))
      }
      tick()
      intervalRef.current = setInterval(tick, 1000)
    } else {
      setElapsed(0)
    }

    return () => clearInterval(intervalRef.current)
  }, [session])

  const toggleSession = async () => {
    setLoading(true)
    const type = session?.isActive ? MSG.END_SESSION : MSG.START_SESSION

    chrome.runtime.sendMessage({ type }, (res) => {
      setLoading(false)
      if (res?.ok) {
        // Güncel session'ı tekrar çek
        chrome.runtime.sendMessage({ type: MSG.GET_STATE }, (stateRes) => {
          if (stateRes?.ok) {
            setSession(stateRes.data.session)
            onSessionChange?.(stateRes.data.session)
          }
        })
      }
    })
  }

  // HH:MM:SS formatı
  const formatTime = (s) => {
    const h = Math.floor(s / 3600)
    const m = Math.floor((s % 3600) / 60)
    const sec = s % 60
    return [h, m, sec].map(n => n.toString().padStart(2, '0')).join(':')
  }

  const isActive = session?.isActive

  return (
    <div style={{ marginBottom: 16 }}>
      {/* Timer */}
      {isActive && (
        <div style={{
          fontSize: 28,
          fontWeight: 500,
          textAlign: 'center',
          marginBottom: 12,
          fontVariantNumeric: 'tabular-nums',
          color: '#afa9ec',
          letterSpacing: '.04em',
        }}>
          {formatTime(elapsed)}
        </div>
      )}

      {/* Dungeon derinliği */}
      {isActive && session.depth && (
        <div style={{
          textAlign: 'center',
          fontSize: 12,
          color: '#888780',
          marginBottom: 12,
        }}>
          ▼ {session.depth}. kat
        </div>
      )}

      {/* Ana buton */}
      <button
        onClick={toggleSession}
        disabled={loading}
        style={{
          width: '100%',
          padding: '11px 0',
          borderRadius: 8,
          border: isActive ? '1px solid #e24b4a' : 'none',
          background: isActive ? 'transparent' : '#534ab7',
          color: isActive ? '#e24b4a' : '#fff',
          fontSize: 14,
          fontWeight: 500,
          cursor: loading ? 'not-allowed' : 'pointer',
          opacity: loading ? 0.6 : 1,
          transition: 'opacity .15s',
        }}
      >
        {loading ? '...' : isActive ? 'Seans Bitti' : "Dungeon'a Gir"}
      </button>
    </div>
  )
}
```

---

## Adım 1.6 — App.jsx'i güncelle

`src/popup/App.jsx` dosyasını tamamen şununla değiştir:

```jsx
import { useState } from 'react'
import SessionControl from './components/SessionControl.jsx'

export default function App() {
  const [session, setSession] = useState(null)

  return (
    <div style={{ padding: 20 }}>
      {/* Başlık */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 20,
        paddingBottom: 16,
        borderBottom: '0.5px solid rgba(255,255,255,.08)',
      }}>
        <span style={{
          fontSize: 13,
          fontWeight: 500,
          color: '#afa9ec',
          letterSpacing: '.1em',
        }}>
          GRIMOIRE
        </span>
        <span style={{ fontSize: 11, color: '#534ab7' }}>
          Phase 1
        </span>
      </div>

      {/* Seans kontrolü */}
      <SessionControl onSessionChange={setSession} />

      {/* Durum bilgisi */}
      <p style={{ fontSize: 12, color: '#888780', marginTop: 12 }}>
        {session?.isActive
          ? 'Lore dönüşümü Phase 2\'de aktif olacak.'
          : 'Seans başlat, fokus tab\'ını belirle.'}
      </p>
    </div>
  )
}
```

---

## Adım 1.7 — Build al ve test et

```bash
npm run build
```

Chrome'da extension'ı yenile:
`chrome://extensions` → Grimoire → yenile ikonuna tıkla

---

## ✅ Phase 1 Checklist

- [ ] `npm run build` hatasız çalışıyor
- [ ] Popup açılınca "Dungeon'a Gir" butonu görünüyor
- [ ] Butona tıklayınca seans başlıyor, timer sayıyor
- [ ] "Seans Bitti" tıklayınca timer sıfırlanıyor
- [ ] Seans aktifken `chrome://extensions` → Grimoire → storage inspector'da `session: { isActive: true, ... }` görünüyor
- [ ] Seans aktifken farklı sekmeye geçince fokus sayfasının üstünde kırmızı banner çıkıyor
- [ ] Sosyal medya sekmesi (twitter.com vs.) açılınca farklı mesaj çıkıyor
- [ ] Fokus sekmesi kapatılınca `session` storage'da `null` oluyor
- [ ] "Seans Bitti" tıklanınca da `session: null` oluyor
- [ ] Service worker DevTools'unda `[Grimoire] Session started` logu görünüyor

---

## Storage'ı manuel test et

Chrome DevTools → Application → Storage → Local Storage alanında:

```
chrome://extensions → Grimoire → "inspect views: service worker"
```

Açılan DevTools'ta Console'a yaz:

```js
// Mevcut storage'ı gör
chrome.storage.local.get(null, console.log)

// Storage'ı sıfırla (test için)
chrome.storage.local.clear(() => console.log('cleared'))
```

---

## Sık Karşılaşılan Hatalar

**"Could not establish connection"**
→ Content script henüz yüklenmemiş. Sayfayı yenile, sonra seans başlat.

**"return true" olmayınca sendResponse çalışmıyor**
→ Tüm async message handler'larında `return true` olmalı — bunu unutma.

**Popup her açılışta sıfırdan yükleniyor**
→ Normal. Popup'un state'i `chrome.storage`'dan okuması bu yüzden önemli.

**Tab ID bulunamıyor**
→ `chrome.tabs.query` bazen boş dönebilir. `activeTab` permission manifest'te var mı kontrol et.

---

## Sonraki Adım

Phase 1 checklist'in hepsi ✅ olduktan sonra:

```
PHASE_2_lore.md dosyasını aç ve uygula.
```
