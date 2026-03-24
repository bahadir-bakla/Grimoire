import { useEffect, useState } from 'react'
import { LORE_STYLES, AI_PROVIDERS } from '../../shared/constants.js'
import { t } from '../../shared/i18n.js'

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

function AIStatusBadge({ status }) {
  const config = {
    checking: {
      color: '#534ab7', bg: 'rgba(83,74,183,.1)', border: 'rgba(83,74,183,.2)', text: 'Kontrol ediliyor...', sub: null,
    },
    available: {
      color: '#1d9e75', bg: 'rgba(29,158,117,.08)', border: 'rgba(29,158,117,.2)', text: 'Hazır', sub: 'Chrome Built-in AI aktif. API key gerekmez.',
    },
    downloading: {
      color: '#ef9f27', bg: 'rgba(239,159,39,.08)', border: 'rgba(239,159,39,.2)', text: 'İndiriliyor', sub: 'Gemini Nano modeli indiriliyor. Birkaç dakika sürer.',
    },
    unavailable: {
      color: '#e24b4a', bg: 'rgba(226,75,74,.08)', border: 'rgba(226,75,74,.2)', text: 'Desteklenmiyor / Eksik Kurulum', sub: 'Hardware desteği bulunamadı. Lütfen OpenAI veya Grok kullanın.',
    },
  }

  const c = config[status] ?? config.unavailable

  return (
    <div style={{
      background: c.bg, border: `0.5px solid ${c.border}`, borderRadius: 8, padding: '10px 12px',
    }}>
      <div style={{ fontSize: 13, fontWeight: 500, color: c.color, marginBottom: c.sub ? 4 : 0 }}>
        {c.text}
      </div>
      {c.sub && (
        <div style={{ fontSize: 11, color: '#888780', lineHeight: 1.5 }}>{c.sub}</div>
      )}
    </div>
  )
}

const DIFFICULTY_OPTIONS = [
  { value: 'easy',   label: 'Kolay',  desc: 'Canavar XP drenajı %50 azaltılmış' },
  { value: 'normal', label: 'Normal', desc: 'Standart canavar gücü' },
  { value: 'hard',   label: 'Zor',    desc: 'Canavar XP drenajı %50 artırılmış' },
]

export default function Settings({ lang = 'tr' }) {
  const [settings, setSettings] = useState(null)
  const [saved, setSaved]       = useState(false)
  const [aiStatus, setAiStatus] = useState('checking')
  const [showKey, setShowKey]   = useState(false)

  useEffect(() => {
    chrome.storage.local.get(['settings'], ({ settings }) => {
      setSettings(settings ?? {
        loreStyle: 'fantasy',
        monsterDifficulty: 'normal',
        aiProvider: 'chrome',
        apiKey: ''
      })
    })
    chrome.runtime.sendMessage({ type: 'CHECK_AI' }, (res) => {
      setAiStatus(res?.status ?? 'unavailable')
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
    if (!confirm(t('settings.resetConfirm', lang))) return
    chrome.storage.local.clear(() => {
      chrome.storage.local.set({
        session: null,
        character: { level: 1, xp: 0, xpToNext: 500 },
        grimoire: [],
        settings: {
          loreStyle: 'fantasy',
          monsterDifficulty: 'normal',
          aiProvider: 'chrome',
          apiKey: '',
          appLanguage: 'tr',
          customModel: ''
        },
      }, () => window.location.reload())
    })
  }

  if (!settings) return null

  const isCloudProvider = settings.aiProvider !== 'chrome'

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
      
      {/* AI Servis Sağlayıcısı */}
      <Section title={t('settings.provider', lang)}>
        <select
          value={settings.aiProvider || 'chrome'}
          onChange={e => update('aiProvider', e.target.value)}
          style={{
            width: '100%',
            padding: '8px 10px',
            background: 'rgba(255,255,255,.04)',
            border: '0.5px solid rgba(255,255,255,.12)',
            borderRadius: 7,
            color: '#e8e6d9',
            fontSize: 13,
            outline: 'none',
          }}
        >
          {Object.values(AI_PROVIDERS).map(prov => (
            <option key={prov.id} value={prov.id} style={{ background: '#0f0e17' }}>
              {prov.label}
            </option>
          ))}
        </select>
      </Section>

      {/* Dil Seçimi */}
      <Section title={t('settings.appLang', lang)}>
        <select
          value={settings.appLanguage || 'tr'}
          onChange={e => update('appLanguage', e.target.value)}
          style={{
            width: '100%',
            padding: '8px 10px',
            background: 'rgba(255,255,255,.04)',
            border: '0.5px solid rgba(255,255,255,.12)',
            borderRadius: 7,
            color: '#e8e6d9',
            fontSize: 13,
            outline: 'none',
          }}
        >
          <option value="tr" style={{ background: '#0f0e17' }}>Türkçe</option>
          <option value="en" style={{ background: '#0f0e17' }}>English</option>
        </select>
      </Section>

      {/* Seçilen Sağlayıcıya Göre Gösterge: SADECE CHROME */}
      {!isCloudProvider && (
        <AIStatusBadge status={aiStatus} />
      )}

      {/* AI Key Alanı: SADECE BULUT */}
      {isCloudProvider && (
        <Section title="API Key">
          <div style={{ position: 'relative' }}>
            <input
              type={showKey ? 'text' : 'password'}
              value={settings.apiKey || ''}
              onChange={e => update('apiKey', e.target.value)}
              placeholder="API Anahtarınızı Yapıştırın"
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
              onClick={() => setShowKey(!showKey)}
              style={{
                position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)',
                background: 'none', border: 'none', color: '#534ab7', cursor: 'pointer',
                fontSize: 11, padding: 0,
              }}
            >
              {showKey ? t('settings.hideKey', lang) : t('settings.showKey', lang)}
            </button>
          </div>
          <div style={{ fontSize: 11, color: '#534ab7', marginTop: 5, lineHeight: 1.4 }}>
            {settings.aiProvider === 'openai' && <span>{t('settings.hintOpenAI', lang)}<br/></span>}
            {settings.aiProvider === 'anthropic' && <span>{t('settings.hintAnthropic', lang)}<br/></span>}
            {settings.aiProvider === 'grok' && <span>{t('settings.hintGrok', lang)}<br/></span>}
            {settings.aiProvider === 'gemini' && <span>{t('settings.hintGemini', lang)}<br/></span>}
            <span style={{ color: '#888780' }}>{t('settings.localWarn', lang)}</span>
          </div>
        </Section>
      )}

      {/* Özel Model Adı: SADECE BULUT */}
      {isCloudProvider && (
        <Section title={t('settings.customModel', lang)}>
          <input
            type="text"
            value={settings.customModel || ''}
            onChange={e => update('customModel', e.target.value)}
            placeholder={`Örn: ${AI_PROVIDERS[settings.aiProvider]?.model || 'custom-model'}`}
            style={{
              width: '100%',
              padding: '8px 10px',
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
          <div style={{ fontSize: 11, color: '#888780', marginTop: 5 }}>
            {t('settings.customHint', lang)}
          </div>
        </Section>
      )}

      {/* Lore stili */}
      <Section title={t('settings.loreStyle', lang)}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {Object.entries(LORE_STYLES).map(([key, style]) => (
            <label
              key={key}
              style={{
                display: 'flex', alignItems: 'center', gap: 10, padding: '8px 10px',
                background: settings.loreStyle === key ? 'rgba(83,74,183,.15)' : 'rgba(255,255,255,.03)',
                border: settings.loreStyle === key ? '0.5px solid rgba(83,74,183,.4)' : '0.5px solid rgba(255,255,255,.07)',
                borderRadius: 7, cursor: 'pointer', transition: 'all .15s',
              }}
            >
              <input type="radio" name="loreStyle" value={key} checked={settings.loreStyle === key}
                     onChange={() => update('loreStyle', key)} style={{ accentColor: '#7f77dd' }} />
              <span style={{ fontSize: 12, color: '#d4cfb8' }}>
                {lang === 'en' ? (style.labelEn || style.label) : style.label}
              </span>
            </label>
          ))}
        </div>
      </Section>

      {/* Kaydet */}
      <button
        onClick={save}
        style={{
          width: '100%', padding: '10px 0', background: saved ? '#1d9e75' : '#534ab7', border: 'none',
          borderRadius: 9, color: '#fff', fontSize: 13, fontWeight: 500, cursor: 'pointer',
          transition: 'background .3s', fontFamily: 'inherit',
        }}
      >
        {saved ? 'Kaydedildi ✓' : 'Kaydet'}
      </button>

      {/* Tehlike bölgesi */}
      <div style={{ borderTop: '0.5px solid rgba(255,255,255,.06)', paddingTop: 14 }}>
        <button
          onClick={resetData}
          style={{ width: '100%', padding: '8px 0', background: 'none', border: '0.5px solid rgba(226,75,74,.3)', borderRadius: 7, color: '#e24b4a', fontSize: 12, cursor: 'pointer', fontFamily: 'inherit', transition: 'background .15s' }}
          onMouseEnter={e => e.target.style.background = 'rgba(226,75,74,.06)'}
          onMouseLeave={e => e.target.style.background = 'none'}
        >
          {t('settings.resetData', lang)}
        </button>
      </div>
    </div>
  )
}
