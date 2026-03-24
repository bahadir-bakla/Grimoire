# Phase 4 — Canavar Sistemi

> **Hedef:** Dikkat dağıtıcı sekme açılınca veya sosyal medyaya girilince canavar saldırsın, XP yesin, haftalık boss fight tetiklensin.
> **Tahmini süre:** 3–4 saat
> **Gereklilik:** Phase 3 checklist'i tam ✅

---

## Claude Code'a ver

```
Grimoire Phase 4: Canavar sistemi.
constants.js'e MONSTERS ve boss tanımları ekle, service-worker.js'deki
tab takibini gerçek canavar lojiğiyle güçlendir, content.js'e tam
canavar saldırı UI'ı yaz, chrome.alarms ile haftalık boss kontrol et.
```

---

## Adım 4.1 — constants.js'e canavar tanımları ekle

`src/shared/constants.js` dosyasına ekle:

```js
// ─── Canavar tanımları ────────────────────────────────────────────────────

export const MONSTERS = [
  {
    id: 'procrastination_djinn',
    name: 'Erteleme İfriti',
    title: 'Dikkatini kaybettin',
    trigger: 'tab_switch',
    xpDrainPct: 0.12,           // kazanılan XP'nin %12'sini yer
    minXPDrain: 30,             // en az bu kadar düşür
    maxXPDrain: 120,
    depth: [1, 2, 3],
    message: 'Yolunu kaybedenlerin ruhu fısıldar: "Geri dön... hâlâ zaman var."',
    color: '#534ab7',
  },
  {
    id: 'scroll_wraith',
    name: 'Sonsuz Kaydırma Hayaleti',
    title: 'Sosyal medya tuzağı!',
    trigger: 'social_media',
    xpDrainPct: 0.22,
    minXPDrain: 60,
    maxXPDrain: 200,
    depth: [2, 3, 4, 5],
    message: 'Hayalet seni sonsuz girdabına çekiyor. Her kaydırma bir XP götürüyor.',
    color: '#993c1d',
  },
  {
    id: 'notification_golem',
    name: 'Bildirim Golemi',
    title: 'Uzun süredir ayrıldın',
    trigger: 'long_idle',       // 20dk hareketsizlik
    xpDrainPct: 0.08,
    minXPDrain: 20,
    maxXPDrain: 80,
    depth: [1, 2, 3, 4, 5],
    message: 'Golem hareketsizlik döneminde birikim yaptı. Varlığın onun yiyeceğiydi.',
    color: '#5f5e5a',
  },
  {
    id: 'video_siren',
    name: 'Video Sireni',
    title: 'YouTube\'a girdin',
    trigger: 'social_media',
    xpDrainPct: 0.18,
    minXPDrain: 50,
    maxXPDrain: 160,
    depth: [3, 4, 5],
    message: '"Sadece bir video" dedi Sireni. Üç saat sonra hâlâ oradaydın.',
    color: '#993556',
  },
]

// Sosyal medya domain listesi (genişletildi)
export const DISTRACTION_DOMAINS = [
  'twitter.com', 'x.com',
  'instagram.com',
  'tiktok.com',
  'reddit.com',
  'youtube.com',
  'facebook.com',
  'twitch.tv',
  'netflix.com',
  'discord.com',
  'telegram.org', 'web.telegram.org',
]

// Hareketsizlik eşiği (ms)
export const IDLE_THRESHOLD_MS = 20 * 60 * 1000  // 20 dakika

// ─── Haftalık Boss ────────────────────────────────────────────────────────

export const WEEKLY_BOSS = {
  name: 'Haftanın Gölgesi',
  description: 'Tüm haftanın fokus gücüyle yüzleş.',
  // Her hafta Pazar 20:00'de kontrol
  checkDay: 0,       // 0 = Pazar
  checkHour: 20,
  // Haftalık scroll sayısına göre boss HP hesapla
  calcHP: (weeklyScrolls) => Math.max(10, 100 - weeklyScrolls * 7),
  // Boss yenilirse XP ödülü
  winXP: (weeklyScrolls) => weeklyScrolls * 25 + 100,
  // Boss kazanırsa XP cezası
  lossXPDrain: 0.20,  // toplam XP'nin %20'si
}
```

---

## Adım 4.2 — service-worker.js'i güncelle

`src/background/service-worker.js` içindeki `chrome.tabs.onActivated` listener'ını tamamen şununla değiştir:

```js
// ─── Tab değişim takibi ───────────────────────────────────────────────────

chrome.tabs.onActivated.addListener(async ({ tabId }) => {
  const session = await getActiveSession()
  if (!session) return

  if (tabId === session.focusTabId) {
    console.log('[Grimoire] Back to focus tab')
    return
  }

  let tab
  try {
    tab = await chrome.tabs.get(tabId)
  } catch {
    return
  }

  const url = tab.url ?? ''
  const isSocial = isDistraction(url)
  const trigger  = isSocial ? 'social_media' : 'tab_switch'

  console.log('[Grimoire] Distraction:', trigger, url)

  await triggerMonsterAttack({ session, trigger })
})
```

### Dosyanın sonuna yeni fonksiyonlar ekle:

```js
// ─── Canavar sistemi ──────────────────────────────────────────────────────

/**
 * Tetikleyiciye ve dungeon derinliğine göre uygun canavarı seç ve saldırt.
 */
async function triggerMonsterAttack({ session, trigger }) {
  const { character } = await getStorage([STORAGE_KEYS.CHARACTER])
  const currentXP = character?.xp ?? 0

  // Derinliğe ve trigger'a uyan canavarlar
  const candidates = MONSTERS.filter(
    m => m.trigger === trigger && m.depth.includes(session.depth ?? 1)
  )

  if (candidates.length === 0) {
    console.log('[Grimoire] No monster for this depth/trigger combo')
    return
  }

  const monster = candidates[Math.floor(Math.random() * candidates.length)]

  // XP düş
  const drainRaw = Math.floor(currentXP * monster.xpDrainPct)
  const xpLost = Math.min(
    monster.maxXPDrain,
    Math.max(monster.minXPDrain, drainRaw)
  )

  const updatedChar = await drainCharacterXP(xpLost)
  console.log(`[Grimoire] Monster ${monster.id} drained ${xpLost} XP`)

  // Fokus sekmesine saldırı mesajı gönder
  try {
    await chrome.tabs.sendMessage(session.focusTabId, {
      type: MSG.MONSTER_ATTACK,
      monster,
      xpLost,
      remainingXP: updatedChar.xp,
    })
  } catch (err) {
    console.log('[Grimoire] Could not send monster attack:', err.message)
  }
}
```

### Import satırlarını güncelle:

```js
import {
  STORAGE_KEYS,
  MSG,
  DISTRACTION_DOMAINS,
  MONSTERS,
  IDLE_THRESHOLD_MS,
  DEPTH_THRESHOLDS,
  WEEKLY_BOSS,
  LORE_STYLES,
  CLAUDE_MODEL,
  MAX_LORE_TOKENS,
} from '../shared/constants.js'

import {
  getStorage,
  setStorage,
  updateCharacter,
  drainCharacterXP,
  addToGrimoire,
} from '../shared/storage.js'
```

---

## Adım 4.3 — Hareketsizlik (idle) tespiti

`src/background/service-worker.js` dosyasının sonuna ekle:

```js
// ─── Idle takibi ─────────────────────────────────────────────────────────

// Her dakika alarm
chrome.alarms.create('idle-check', { periodInMinutes: 1 })

// Son aktivite zamanını takip et
let lastActivityTime = Date.now()

chrome.tabs.onActivated.addListener(() => {
  lastActivityTime = Date.now()
})

chrome.tabs.onUpdated.addListener(() => {
  lastActivityTime = Date.now()
})

chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name === 'idle-check') {
    const session = await getActiveSession()
    if (!session) return

    const idleMs = Date.now() - lastActivityTime
    if (idleMs >= IDLE_THRESHOLD_MS) {
      console.log('[Grimoire] Long idle detected, triggering notification golem')
      await triggerMonsterAttack({ session, trigger: 'long_idle' })
      lastActivityTime = Date.now()  // reset — bir kez tetiklesin
    }
    return
  }

  // Haftalık boss kontrolü
  if (alarm.name === 'weekly-boss-check') {
    await checkWeeklyBoss()
    return
  }
})
```

---

## Adım 4.4 — Haftalık boss kontrolü

`src/background/service-worker.js` dosyasının sonuna ekle:

```js
// Haftalık boss alarm'ı kur (extension install/start'ta)
chrome.runtime.onInstalled.addListener(() => {
  chrome.alarms.create('weekly-boss-check', { periodInMinutes: 60 })
  console.log('[Grimoire] Weekly boss alarm set')
})

chrome.runtime.onStartup.addListener(() => {
  chrome.alarms.create('weekly-boss-check', { periodInMinutes: 60 })
})

async function checkWeeklyBoss() {
  const now = new Date()
  if (now.getDay() !== WEEKLY_BOSS.checkDay) return
  if (now.getHours() !== WEEKLY_BOSS.checkHour) return

  // Bu hafta boss zaten tetiklendi mi?
  const { bossLastTriggered } = await getStorage(['bossLastTriggered'])
  const oneWeekMs = 7 * 24 * 60 * 60 * 1000
  if (bossLastTriggered && Date.now() - bossLastTriggered < oneWeekMs) return

  // Bu haftaki scroll sayısı
  const { grimoire, character } = await getStorage([STORAGE_KEYS.GRIMOIRE, STORAGE_KEYS.CHARACTER])
  const weeklyScrolls = (grimoire ?? []).filter(
    e => e.savedAt > Date.now() - oneWeekMs
  ).length

  const bossHP  = WEEKLY_BOSS.calcHP(weeklyScrolls)
  const winXP   = WEEKLY_BOSS.winXP(weeklyScrolls)

  await setStorage({ bossLastTriggered: Date.now() })

  console.log('[Grimoire] Weekly boss triggered! HP:', bossHP, 'weeklyScrolls:', weeklyScrolls)

  // Aktif sekmeye boss mesajı gönder
  const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true })
  if (!activeTab) return

  try {
    await chrome.tabs.sendMessage(activeTab.id, {
      type: 'WEEKLY_BOSS',
      boss: { ...WEEKLY_BOSS, hp: bossHP },
      weeklyScrolls,
      winXP,
      character,
    })
  } catch (err) {
    console.log('[Grimoire] Could not send boss to tab:', err.message)
  }
}
```

---

## Adım 4.5 — content.js'e tam canavar UI'ı yaz

`src/content/content.js` içindeki `handleMonsterAttack` fonksiyonunu tamamen şununla değiştir:

```js
// ─── Canavar saldırı UI ───────────────────────────────────────────────────

function handleMonsterAttack(msg) {
  // Mevcut saldırı varsa kaldır
  document.getElementById('gr-monster')?.remove()

  const { monster, xpLost, remainingXP } = msg

  const overlay = document.createElement('div')
  overlay.id = 'gr-monster'
  overlay.innerHTML = `
    <div class="gr-monster-inner">
      <div class="gr-monster-eyebrow">${monster.title}</div>
      <div class="gr-monster-name">${monster.name}</div>
      <div class="gr-monster-msg">${monster.message}</div>
      <div class="gr-monster-xp">
        <span class="gr-xp-lost">−${xpLost} XP</span>
        <span class="gr-xp-remaining">Kalan: ${remainingXP} XP</span>
      </div>
      <div class="gr-monster-hp-wrap">
        <div class="gr-monster-hp-bar" id="gr-hp-bar"></div>
      </div>
      <button class="gr-monster-dismiss" id="gr-monster-ok">
        Anladım, geri dönüyorum
      </button>
    </div>
  `

  document.body.appendChild(overlay)

  // HP bar dolum animasyonu
  requestAnimationFrame(() => {
    const bar = document.getElementById('gr-hp-bar')
    if (bar) bar.style.width = '100%'
  })

  document.getElementById('gr-monster-ok').addEventListener('click', () => {
    overlay.classList.add('gr-monster-leaving')
    setTimeout(() => overlay.remove(), 300)
  })

  // 10 saniye sonra otomatik kapat
  const timer = setTimeout(() => {
    overlay.classList.add('gr-monster-leaving')
    setTimeout(() => overlay.remove(), 300)
  }, 10000)

  document.getElementById('gr-monster-ok').addEventListener('click', () => {
    clearTimeout(timer)
  }, { once: true })
}

// ─── Haftalık boss UI ─────────────────────────────────────────────────────

function handleWeeklyBoss(msg) {
  const { boss, weeklyScrolls, winXP } = msg

  const overlay = document.createElement('div')
  overlay.id = 'gr-boss'
  overlay.innerHTML = `
    <div class="gr-boss-inner">
      <div class="gr-boss-label">HAFTALIK YÜZLEŞME</div>
      <div class="gr-boss-name">${boss.name}</div>
      <div class="gr-boss-stats">
        Bu hafta ${weeklyScrolls} scroll tamamladın.
        Boss HP: ${boss.hp}/100
      </div>
      <div class="gr-boss-hp-track">
        <div class="gr-boss-hp-fill" style="width:${boss.hp}%"></div>
      </div>
      <div class="gr-boss-actions">
        <button class="gr-boss-fight" id="gr-boss-fight">Savaş (+${winXP} XP)</button>
        <button class="gr-boss-flee" id="gr-boss-flee">Kaç</button>
      </div>
      <div class="gr-boss-result" id="gr-boss-result" style="display:none"></div>
    </div>
  `

  document.body.appendChild(overlay)

  document.getElementById('gr-boss-fight').addEventListener('click', async () => {
    // Scroll sayısına göre kazanma şansı
    const winChance = Math.min(0.9, weeklyScrolls * 0.08 + 0.2)
    const won = Math.random() < winChance

    document.getElementById('gr-boss-fight').disabled = true
    document.getElementById('gr-boss-flee').disabled  = true

    const resultEl = document.getElementById('gr-boss-result')
    resultEl.style.display = 'block'

    if (won) {
      resultEl.innerHTML = `
        <div class="gr-boss-win">
          Zafer! +${winXP} XP kazandın.<br>
          <small>Haftalık boss yenildi.</small>
        </div>
      `
      await chrome.runtime.sendMessage({
        type: 'BOSS_RESULT',
        won: true,
        xpChange: winXP,
      })
    } else {
      resultEl.innerHTML = `
        <div class="gr-boss-loss">
          Yenildin. XP'nin %20'si silindi.<br>
          <small>Gelecek hafta daha güçlü ol.</small>
        </div>
      `
      await chrome.runtime.sendMessage({
        type: 'BOSS_RESULT',
        won: false,
        xpChange: 0,
      })
    }

    setTimeout(() => {
      overlay.classList.add('gr-monster-leaving')
      setTimeout(() => overlay.remove(), 300)
    }, 3000)
  })

  document.getElementById('gr-boss-flee').addEventListener('click', () => {
    overlay.classList.add('gr-monster-leaving')
    setTimeout(() => overlay.remove(), 300)
  })
}

// Mesaj dinleyiciyi güncelle
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  console.log('[Grimoire CS] Message:', msg.type)

  if (msg.type === MSG.MONSTER_ATTACK) {
    handleMonsterAttack(msg)
    sendResponse({ ok: true })
  }

  if (msg.type === 'WEEKLY_BOSS') {
    handleWeeklyBoss(msg)
    sendResponse({ ok: true })
  }

  return true
})
```

---

## Adım 4.6 — service-worker.js'e BOSS_RESULT handler ekle

`onMessage.addListener` içine ekle:

```js
  if (msg.type === 'BOSS_RESULT') {
    ;(async () => {
      try {
        if (msg.won) {
          await updateCharacter(msg.xpChange)
        } else {
          const { character } = await getStorage([STORAGE_KEYS.CHARACTER])
          const lossXP = Math.floor(character.xp * WEEKLY_BOSS.lossXPDrain)
          await drainCharacterXP(lossXP)
        }
        sendResponse({ ok: true })
      } catch (err) {
        sendResponse({ ok: false, error: err.message })
      }
    })()
    return true
  }
```

---

## Adım 4.7 — content.css'e canavar stilleri ekle

`src/content/content.css` dosyasının sonuna ekle:

```css
/* ── Canavar saldırı overlay ──────────────────────────────────────────── */

#gr-monster {
  position: fixed;
  inset: 0;
  display: flex;
  align-items: flex-end;
  justify-content: center;
  padding-bottom: 28px;
  z-index: 2147483646;
  pointer-events: none;
  animation: gr-monster-in .3s ease;
}

#gr-monster.gr-monster-leaving {
  animation: gr-monster-out .3s ease forwards;
}

@keyframes gr-monster-in {
  from { opacity: 0; transform: translateY(20px); }
  to   { opacity: 1; transform: translateY(0); }
}

@keyframes gr-monster-out {
  to { opacity: 0; transform: translateY(20px); }
}

.gr-monster-inner {
  background: #0f0e17;
  border: 1.5px solid #e24b4a;
  border-radius: 14px;
  padding: 20px 22px;
  max-width: 380px;
  width: 90%;
  pointer-events: all;
  font-family: Georgia, serif;
}

.gr-monster-eyebrow {
  font-family: -apple-system, sans-serif;
  font-size: 10px;
  font-weight: 600;
  letter-spacing: .12em;
  color: #e24b4a;
  text-transform: uppercase;
  margin-bottom: 4px;
}

.gr-monster-name {
  font-size: 17px;
  font-weight: 500;
  color: #f0d0d0;
  margin-bottom: 10px;
}

.gr-monster-msg {
  font-size: 13px;
  color: #c0b8a8;
  line-height: 1.65;
  font-style: italic;
  margin-bottom: 12px;
}

.gr-monster-xp {
  display: flex;
  justify-content: space-between;
  font-family: -apple-system, sans-serif;
  font-size: 12px;
  margin-bottom: 8px;
}

.gr-xp-lost      { color: #e24b4a; font-weight: 500; }
.gr-xp-remaining { color: #888780; }

.gr-monster-hp-wrap {
  height: 4px;
  background: rgba(226, 75, 74, .15);
  border-radius: 2px;
  overflow: hidden;
  margin-bottom: 14px;
}

.gr-monster-hp-bar {
  height: 100%;
  background: #e24b4a;
  border-radius: 2px;
  width: 0;
  transition: width .8s ease;
}

.gr-monster-dismiss {
  width: 100%;
  padding: 9px 0;
  background: none;
  border: 1px solid rgba(226, 75, 74, .4);
  border-radius: 7px;
  color: #f09595;
  font-family: -apple-system, sans-serif;
  font-size: 12px;
  cursor: pointer;
  transition: background .15s;
}

.gr-monster-dismiss:hover {
  background: rgba(226, 75, 74, .08);
}

/* ── Haftalık Boss overlay ────────────────────────────────────────────── */

#gr-boss {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, .7);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 2147483647;
  animation: gr-monster-in .3s ease;
}

#gr-boss.gr-monster-leaving {
  animation: gr-monster-out .3s ease forwards;
}

.gr-boss-inner {
  background: #0f0e17;
  border: 1.5px solid #7f77dd;
  border-radius: 16px;
  padding: 28px 28px 24px;
  max-width: 420px;
  width: 90%;
  font-family: Georgia, serif;
  text-align: center;
}

.gr-boss-label {
  font-family: -apple-system, sans-serif;
  font-size: 10px;
  font-weight: 600;
  letter-spacing: .14em;
  color: #534ab7;
  text-transform: uppercase;
  margin-bottom: 8px;
}

.gr-boss-name {
  font-size: 22px;
  color: #afa9ec;
  margin-bottom: 12px;
}

.gr-boss-stats {
  font-size: 13px;
  color: #888780;
  font-family: -apple-system, sans-serif;
  margin-bottom: 12px;
  line-height: 1.6;
}

.gr-boss-hp-track {
  height: 8px;
  background: rgba(83, 74, 183, .15);
  border-radius: 4px;
  overflow: hidden;
  margin-bottom: 20px;
}

.gr-boss-hp-fill {
  height: 100%;
  background: #7f77dd;
  border-radius: 4px;
  transition: width 1s ease;
}

.gr-boss-actions {
  display: flex;
  gap: 10px;
}

.gr-boss-fight {
  flex: 1;
  padding: 10px 0;
  background: #534ab7;
  color: #fff;
  border: none;
  border-radius: 8px;
  font-family: -apple-system, sans-serif;
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
}

.gr-boss-flee {
  flex: 1;
  padding: 10px 0;
  background: none;
  color: #888780;
  border: 1px solid rgba(255,255,255,.1);
  border-radius: 8px;
  font-family: -apple-system, sans-serif;
  font-size: 13px;
  cursor: pointer;
}

.gr-boss-result  { margin-top: 14px; font-family: -apple-system, sans-serif; font-size: 13px; line-height: 1.6; }
.gr-boss-win     { color: #1d9e75; }
.gr-boss-loss    { color: #e24b4a; }
```

---

## Adım 4.8 — Build al ve test et

```bash
npm run build
```

---

## Test senaryoları

### Senaryo A — Tab switch saldırısı

1. Seans başlat
2. Wikipedia'da bir sayfaya git (fokus tab)
3. Yeni sekmede `example.com` aç
4. Fokus sekmesine geri dön → saldırı overlayı görünmeli
5. XP düşmeli

### Senaryo B — Sosyal medya saldırısı

1. Seans başlat
2. Yeni sekmede `twitter.com` veya `reddit.com` aç
3. Fokus sekmesine dön → farklı (daha güçlü) canavar çıkmalı

### Senaryo C — Boss fight manuel test

Service worker DevTools console'unda:

```js
// Boss'u manuel tetikle
chrome.tabs.query({ active: true, currentWindow: true }, ([tab]) => {
  chrome.tabs.sendMessage(tab.id, {
    type: 'WEEKLY_BOSS',
    boss: { name: 'Haftanın Gölgesi', hp: 65 },
    weeklyScrolls: 5,
    winXP: 225,
    character: { level: 3, xp: 200, xpToNext: 800 },
  })
})
```

---

## ✅ Phase 4 Checklist

- [ ] `npm run build` hatasız çalışıyor
- [ ] Seans aktifken farklı sekmeye geçince canavar overlay'i çıkıyor
- [ ] `twitter.com` / `reddit.com` gibi sosyal medya sitesine gidince daha güçlü canavar çıkıyor
- [ ] Overlay'deki XP düşme rakamı doğru (storage'dan onaylanabilir)
- [ ] "Anladım, geri dönüyorum" tıklanınca overlay kapanıyor
- [ ] 10 saniye sonra overlay otomatik kapanıyor
- [ ] Seans yokken sekme değiştirilince canavar çıkmıyor
- [ ] Manuel boss test çalışıyor (service worker console)
- [ ] Boss fight "Savaş" butonuna tıklanınca sonuç görünüyor
- [ ] Boss fight kazanılınca XP artıyor, kaybedilince azalıyor

---

## Sık Karşılaşılan Hatalar

**"context invalidated" hatası**
→ Extension yenilendi, eski content script hâlâ çalışıyor. Sayfayı yenile.

**Canavar çıkmıyor**
→ Canavar derinlik kontrolü yapıyor. `MONSTERS[x].depth` array'ine `1` eklenmiş mi?

**Boss her saat çıkıyor**
→ `bossLastTriggered` storage kontrolü çalışıyor mu? DevTools'tan `chrome.storage.local.get(['bossLastTriggered'], console.log)` kontrol et.

**XP düşmüyor**
→ `drainCharacterXP` import edildi mi service-worker.js'de?

---

## Sonraki Adım

Phase 4 checklist'in hepsi ✅ olduktan sonra:

```
PHASE_5_popup.md dosyasını aç ve uygula.
```
