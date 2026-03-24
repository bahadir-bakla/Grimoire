# Phase 5 — Popup UI (Settings + Polish)

> **Hedef:** Tam fonksiyonlu popup. API key ayarı, lore stili seçimi, karakter durumu, grimoire envanteri, hepsi tek arayüzde.
> **Tahmini süre:** 2–3 saat
> **Gereklilik:** Phase 4 checklist'i tam ✅

---

## Claude Code'a ver

```
Grimoire Phase 5: Popup UI polish ve Settings sayfası.
Mevcut SessionControl ve CharacterCard bileşenlerini geliştir,
Settings bileşeni ekle (API key, lore stili, zorluk), App.jsx'e
3. tab olarak Ayarlar ekle. Tasarım tutarlı ve dark theme olsun.
```

---

## Adım 5.1 — CharacterCard'ı geliştir

`src/popup/components/CharacterCard.jsx` dosyasını tamamen şununla değiştir:

```jsx
import { useEffect, useState } from 'react'

export default function CharacterCard({ refreshKey }) {
  const [char, setChar]       = useState(null)
  const [session, setSession] = useState(null)
  const [grimoire, setGrimoire] = useState([])

  useEffect(() => {
    chrome.storage.local.get(['character', 'session', 'grimoire'], (data) => {
      setChar(data.character    ?? { level: 1, xp: 0, xpToNext: 500 })
      setSession(data.session   ?? null)
      setGrimoire(data.grimoire ?? [])
    })
  }, [refreshKey])

  if (!char) return null

  const pct = Math.min(100, Math.floor((char.xp / char.xpToNext) * 100))
  const weeklyScrolls = grimoire.filter(
    e => e.savedAt > Date.now() - 7 * 24 * 60 * 60 * 1000
  ).length

  return (
    <div style={{
      background: 'rgba(83, 74, 183, 0.08)',
      border: '0.5px solid rgba(83, 74, 183, 0.25)',
      borderRadius: 12,
      padding: 14,
      marginBottom: 14,
    }}>

      {/* Üst satır */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 12,
      }}>
        <div>
          <div style={{ fontSize: 18, fontWeight: 500, color: '#afa9ec', lineHeight: 1 }}>
            Lv. {char.level}
          </div>
          <div style={{ fontSize: 11, color: '#534ab7', marginTop: 2 }}>
            {pct}% dolu
          </div>
        </div>

        {session?.isActive ? (
          <div style={{
            background: 'rgba(29, 158, 117, .12)',
            border: '0.5px solid rgba(29, 158, 117, .3)',
            borderRadius: 99,
            padding: '4px 10px',
            fontSize: 11,
            color: '#1d9e75',
          }}>
            ▼ {session.depth}. kat aktif
          </div>
        ) : (
          <div style={{
            fontSize: 11,
            color: '#534ab7',
            opacity: .5,
          }}>
            Seans yok
          </div>
        )}
      </div>

      {/* XP bar */}
      <div style={{
        height: 6,
        background: 'rgba(255,255,255,.06)',
        borderRadius: 3,
        overflow: 'hidden',
        marginBottom: 5,
      }}>
        <div style={{
          height: '100%',
          width: `${pct}%`,
          background: 'linear-gradient(90deg, #534ab7 0%, #7f77dd 100%)',
          borderRadius: 3,
          transition: 'width .8s ease',
        }} />
      </div>

      {/* XP sayılar */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        fontSize: 11,
        color: '#534ab7',
        marginBottom: 12,
      }}>
        <span>{char.xp} XP</span>
        <span>{char.xpToNext - char.xp} XP kaldı</span>
      </div>

      {/* İstatistikler */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: '1fr 1fr',
        gap: 8,
      }}>
        <StatCell label="Toplam scroll" value={grimoire.length} />
        <StatCell label="Bu hafta" value={weeklyScrolls} />
      </div>
    </div>
  )
}

function StatCell({ label, value }) {
  return (
    <div style={{
      background: 'rgba(255,255,255,.03)',
      borderRadius: 8,
      padding: '8px 10px',
      textAlign: 'center',
    }}>
      <div style={{ fontSize: 16, fontWeight: 500, color: '#d4cfb8' }}>{value}</div>
      <div style={{ fontSize: 10, color: '#888780', marginTop: 2 }}>{label}</div>
    </div>
  )
}
```

---

## Adım 5.2 — SessionControl'ü geliştir

`src/popup/components/SessionControl.jsx` dosyasını tamamen şununla değiştir:

```jsx
import { useEffect, useState, useRef } from 'react'
import { MSG } from '../../shared/constants.js'

export default function SessionControl({ onSessionChange }) {
  const [session, setSession]   = useState(null)
  const [elapsed, setElapsed]   = useState(0)
  const [loading, setLoading]   = useState(false)
  const intervalRef = useRef(null)

  useEffect(() => {
    chrome.runtime.sendMessage({ type: MSG.GET_STATE }, (res) => {
      if (res?.ok) setSession(res.data.session)
    })
  }, [])

  useEffect(() => {
    clearInterval(intervalRef.current)
    if (session?.isActive) {
      const tick = () => setElapsed(Math.floor((Date.now() - session.startedAt) / 1000))
      tick()
      intervalRef.current = setInterval(tick, 1000)
    } else {
      setElapsed(0)
    }
    return () => clearInterval(intervalRef.current)
  }, [session])

  const toggleSession = () => {
    setLoading(true)
    const type = session?.isActive ? MSG.END_SESSION : MSG.START_SESSION
    chrome.runtime.sendMessage({ type }, () => {
      chrome.runtime.sendMessage({ type: MSG.GET_STATE }, (res) => {
        setLoading(false)
        if (res?.ok) {
          setSession(res.data.session)
          onSessionChange?.(res.data.session)
        }
      })
    })
  }

  const fmt = (s) => {
    const h   = Math.floor(s / 3600)
    const m   = Math.floor((s % 3600) / 60)
    const sec = s % 60
    return [h, m, sec].map(n => n.toString().padStart(2, '0')).join(':')
  }

  const isActive = session?.isActive

  return (
    <div style={{ marginBottom: 16 }}>
      {/* Timer */}
      {isActive && (
        <div style={{
          textAlign: 'center',
          marginBottom: 14,
        }}>
          <div style={{
            fontSize: 32,
            fontWeight: 400,
            color: '#afa9ec',
            fontVariantNumeric: 'tabular-nums',
            letterSpacing: '-.01em',
            lineHeight: 1,
            marginBottom: 4,
          }}>
            {fmt(elapsed)}
          </div>
          <div style={{ fontSize: 11, color: '#534ab7' }}>
            fokus süresi
          </div>
        </div>
      )}

      {/* Buton */}
      <button
        onClick={toggleSession}
        disabled={loading}
        style={{
          width: '100%',
          padding: '11px 0',
          borderRadius: 9,
          border: isActive
            ? '1px solid rgba(226, 75, 74, .4)'
            : 'none',
          background: isActive
            ? 'rgba(226, 75, 74, .06)'
            : '#534ab7',
          color: isActive ? '#e24b4a' : '#fff',
          fontSize: 14,
          fontWeight: 500,
          cursor: loading ? 'not-allowed' : 'pointer',
          opacity: loading ? .6 : 1,
          transition: 'all .15s',
          fontFamily: 'inherit',
        }}
      >
        {loading
          ? '...'
          : isActive
            ? 'Seans Bitti'
            : "Dungeon'a Gir"}
      </button>
    </div>
  )
}
```

---

## Adım 5.3 — Settings bileşeni oluştur

### Yeni dosya: src/popup/components/Settings.jsx

```jsx
import { useEffect, useState } from 'react'
import { LORE_STYLES } from '../../shared/constants.js'

const DIFFICULTY_OPTIONS = [
  { value: 'easy',   label: 'Kolay',  desc: 'Canavar XP drenajı %50 azaltılmış' },
  { value: 'normal', label: 'Normal', desc: 'Standart canavar gücü' },
  { value: 'hard',   label: 'Zor',    desc: 'Canavar XP drenajı %50 artırılmış' },
]

export default function Settings() {
  const [settings, setSettings] = useState(null)
  const [saved, setSaved]       = useState(false)
  const [showKey, setShowKey]   = useState(false)

  useEffect(() => {
    chrome.storage.local.get(['settings'], ({ settings }) => {
      setSettings(settings ?? {
        apiKey: '',
        loreStyle: 'fantasy',
        monsterDifficulty: 'normal',
      })
    })
  }, [])

  const update = (key, value) => {
    setSettings(prev => ({ ...prev, [key]: value }))
    setSaved(false)
  }

  const save = () => {
    chrome.storage.local.set({ settings }, () => {
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    })
  }

  const resetData = () => {
    if (!confirm('Tüm veriler silinecek. Emin misin?')) return
    chrome.storage.local.clear(() => {
      chrome.storage.local.set({
        session: null,
        character: { level: 1, xp: 0, xpToNext: 500 },
        grimoire: [],
        settings: {
          apiKey: settings?.apiKey ?? '',
          loreStyle: 'fantasy',
          monsterDifficulty: 'normal',
        },
      }, () => window.location.reload())
    })
  }

  if (!settings) return null

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>

      {/* API Key */}
      <Section title="Anthropic API Key">
        <div style={{ position: 'relative' }}>
          <input
            type={showKey ? 'text' : 'password'}
            value={settings.apiKey}
            onChange={e => update('apiKey', e.target.value)}
            placeholder="sk-ant-..."
            style={{
              width: '100%',
              padding: '8px 36px 8px 10px',
              background: 'rgba(255,255,255,.04)',
              border: '0.5px solid rgba(255,255,255,.12)',
              borderRadius: 7,
              color: '#e8e6d9',
              fontSize: 12,
              fontFamily: 'monospace',
              outline: 'none',
              boxSizing: 'border-box',
            }}
          />
          <button
            onClick={() => setShowKey(v => !v)}
            style={{
              position: 'absolute',
              right: 8,
              top: '50%',
              transform: 'translateY(-50%)',
              background: 'none',
              border: 'none',
              color: '#534ab7',
              cursor: 'pointer',
              fontSize: 11,
              padding: 0,
            }}
          >
            {showKey ? 'gizle' : 'göster'}
          </button>
        </div>
        <div style={{ fontSize: 11, color: '#534ab7', marginTop: 5 }}>
          api.anthropic.com'dan alabilirsin. Yerel olarak saklanır.
        </div>
      </Section>

      {/* Lore stili */}
      <Section title="Lore stili">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {Object.entries(LORE_STYLES).map(([key, style]) => (
            <label
              key={key}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                padding: '8px 10px',
                background: settings.loreStyle === key
                  ? 'rgba(83,74,183,.15)'
                  : 'rgba(255,255,255,.03)',
                border: settings.loreStyle === key
                  ? '0.5px solid rgba(83,74,183,.4)'
                  : '0.5px solid rgba(255,255,255,.07)',
                borderRadius: 7,
                cursor: 'pointer',
                transition: 'all .15s',
              }}
            >
              <input
                type="radio"
                name="loreStyle"
                value={key}
                checked={settings.loreStyle === key}
                onChange={() => update('loreStyle', key)}
                style={{ accentColor: '#7f77dd' }}
              />
              <span style={{ fontSize: 12, color: '#d4cfb8' }}>{style.label}</span>
            </label>
          ))}
        </div>
      </Section>

      {/* Zorluk */}
      <Section title="Canavar zorluğu">
        <div style={{ display: 'flex', gap: 6 }}>
          {DIFFICULTY_OPTIONS.map(opt => (
            <button
              key={opt.value}
              onClick={() => update('monsterDifficulty', opt.value)}
              title={opt.desc}
              style={{
                flex: 1,
                padding: '7px 0',
                background: settings.monsterDifficulty === opt.value
                  ? '#534ab7'
                  : 'rgba(255,255,255,.04)',
                border: '0.5px solid rgba(255,255,255,.1)',
                borderRadius: 7,
                color: settings.monsterDifficulty === opt.value ? '#fff' : '#888780',
                fontSize: 12,
                cursor: 'pointer',
                transition: 'all .15s',
                fontFamily: 'inherit',
              }}
            >
              {opt.label}
            </button>
          ))}
        </div>
        <div style={{ fontSize: 11, color: '#534ab7', marginTop: 5 }}>
          {DIFFICULTY_OPTIONS.find(o => o.value === settings.monsterDifficulty)?.desc}
        </div>
      </Section>

      {/* Kaydet */}
      <button
        onClick={save}
        style={{
          width: '100%',
          padding: '10px 0',
          background: saved ? '#1d9e75' : '#534ab7',
          border: 'none',
          borderRadius: 9,
          color: '#fff',
          fontSize: 13,
          fontWeight: 500,
          cursor: 'pointer',
          transition: 'background .3s',
          fontFamily: 'inherit',
        }}
      >
        {saved ? 'Kaydedildi ✓' : 'Kaydet'}
      </button>

      {/* Tehlike bölgesi */}
      <div style={{
        borderTop: '0.5px solid rgba(255,255,255,.06)',
        paddingTop: 14,
      }}>
        <div style={{ fontSize: 11, color: '#888780', marginBottom: 8 }}>
          Tehlike bölgesi
        </div>
        <button
          onClick={resetData}
          style={{
            width: '100%',
            padding: '8px 0',
            background: 'none',
            border: '0.5px solid rgba(226,75,74,.3)',
            borderRadius: 7,
            color: '#e24b4a',
            fontSize: 12,
            cursor: 'pointer',
            fontFamily: 'inherit',
            transition: 'background .15s',
          }}
          onMouseEnter={e => e.target.style.background = 'rgba(226,75,74,.06)'}
          onMouseLeave={e => e.target.style.background = 'none'}
        >
          Tüm verileri sıfırla
        </button>
      </div>
    </div>
  )
}

function Section({ title, children }) {
  return (
    <div>
      <div style={{
        fontSize: 10,
        fontWeight: 600,
        letterSpacing: '.08em',
        color: '#534ab7',
        textTransform: 'uppercase',
        marginBottom: 8,
      }}>
        {title}
      </div>
      {children}
    </div>
  )
}
```

---

## Adım 5.4 — App.jsx'i 3 tab'a güncelle

`src/popup/App.jsx` dosyasını tamamen şununla değiştir:

```jsx
import { useState } from 'react'
import SessionControl from './components/SessionControl.jsx'
import CharacterCard  from './components/CharacterCard.jsx'
import GrimoireList   from './components/GrimoireList.jsx'
import Settings       from './components/Settings.jsx'

const TABS = [
  { id: 'seans',   label: 'Seans' },
  { id: 'grimoire', label: 'Grimoire' },
  { id: 'ayarlar', label: 'Ayarlar' },
]

export default function App() {
  const [activeTab, setActiveTab]           = useState('seans')
  const [charRefreshKey, setCharRefreshKey] = useState(0)

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      height: 480,
    }}>

      {/* Header */}
      <div style={{
        padding: '14px 16px 0',
        borderBottom: '0.5px solid rgba(255,255,255,.07)',
        flexShrink: 0,
      }}>
        <div style={{
          fontSize: 12,
          fontWeight: 600,
          color: '#afa9ec',
          letterSpacing: '.14em',
          marginBottom: 12,
        }}>
          GRIMOIRE
        </div>

        {/* Tab bar */}
        <div style={{ display: 'flex' }}>
          {TABS.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              style={{
                flex: 1,
                padding: '7px 0',
                background: 'none',
                border: 'none',
                borderBottom: activeTab === tab.id
                  ? '2px solid #7f77dd'
                  : '2px solid transparent',
                color: activeTab === tab.id ? '#afa9ec' : '#534ab7',
                fontSize: 12,
                fontWeight: activeTab === tab.id ? 500 : 400,
                cursor: 'pointer',
                fontFamily: 'inherit',
                transition: 'all .15s',
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* İçerik */}
      <div style={{
        flex: 1,
        overflowY: 'auto',
        padding: 16,
        scrollbarWidth: 'thin',
        scrollbarColor: 'rgba(83,74,183,.3) transparent',
      }}>
        {activeTab === 'seans' && (
          <>
            <CharacterCard refreshKey={charRefreshKey} />
            <SessionControl onSessionChange={() => setCharRefreshKey(k => k + 1)} />
          </>
        )}

        {activeTab === 'grimoire' && <GrimoireList />}

        {activeTab === 'ayarlar' && <Settings />}
      </div>

    </div>
  )
}
```

---

## Adım 5.5 — popup.html'e boyut sabitle

`popup.html` içindeki `<style>` bloğunu şununla değiştir:

```html
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body {
    width: 340px;
    height: 480px;
    overflow: hidden;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
    background: #0f0e17;
    color: #e8e6d9;
  }
  #root { height: 100%; }
</style>
```

---

## Adım 5.6 — Build al ve tam test et

```bash
npm run build
```

---

## ✅ Phase 5 Checklist

- [ ] `npm run build` hatasız çalışıyor
- [ ] Popup tam 340×480px, taşma yok
- [ ] "Seans" tab'ında CharacterCard görünüyor (level, XP bar, istatistikler)
- [ ] "Seans" tab'ında SessionControl çalışıyor (başlat/bitir, timer)
- [ ] Seans başlatılınca CharacterCard'daki depth güncelleniyor
- [ ] "Grimoire" tab'ında kayıtlar listeleniyor
- [ ] Kayda tıklanınca orijinal sayfa yeni sekmede açılıyor
- [ ] "Ayarlar" tab'ında API key alanı var, göster/gizle çalışıyor
- [ ] Lore stili seçilip kaydedilince sonraki lore dönüşümü o stili kullanıyor
- [ ] Canavar zorluğu seçilip kaydediliyor
- [ ] "Tüm verileri sıfırla" confirm dialog'dan sonra storage'ı temizliyor
- [ ] Dark theme tutarlı — tüm metinler okunabilir
- [ ] Scrollbar grimoire listesinde görünüyor (çok kayıt varsa)

---

## Sık Karşılaşılan Hatalar

**Popup 480px'den fazla uzuyor**
→ `body` ve `#root` height'ı sabit olduğundan emin ol. İçerik `overflow: hidden` ile kırpılıyor, scroll sadece içerik div'inde.

**API key kaydedilmiyor**
→ `chrome.storage.local.set` async — `save` fonksiyonu doğru şekilde callback'li mi?

**Lore stili değişmiyor**
→ `settings` objesi storage'da mı güncellendi? DevTools'tan kontrol: `chrome.storage.local.get(['settings'], console.log)`

**Radio buton seçilmiyor**
→ `accentColor: '#7f77dd'` sadece modern Chrome'da çalışır — fallback için border style yeterli.

---

## Sonraki Adım

Phase 5 checklist'in hepsi ✅ olduktan sonra:

```
PHASE_6_publish.md dosyasını aç ve uygula.
```
