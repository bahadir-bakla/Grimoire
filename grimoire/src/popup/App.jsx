import { useState, useEffect } from 'react'
import SessionControl   from './components/SessionControl.jsx'
import CharacterCard    from './components/CharacterCard.jsx'
import GrimoireList     from './components/GrimoireList.jsx'
import WorldChronicle   from './components/WorldChronicle.jsx'
import Settings         from './components/Settings.jsx'
import { t }            from '../shared/i18n.js'

// AI durum renk/etiket map
const AI_STATUS_DOT = {
  checking:    { color: '#534ab7', title: 'AI kontrol ediliyor…' },
  available:   { color: '#1d9e75', title: 'AI hazır' },
  downloading: { color: '#ef9f27', title: 'Model indiriliyor…' },
  unavailable: { color: '#e24b4a', title: 'AI kullanılamıyor — API key gerekli' },
  configured:  { color: '#1d9e75', title: 'API key ayarlandı' },
}

const TABS = [
  { id: 'seans',    label: 'Seans'   },
  { id: 'grimoire', label: 'Grimoire'},
  { id: 'dunya',    label: 'Dünya'   },
  { id: 'ayarlar',  label: 'Ayarlar' },
]

export default function App() {
  const [activeTab, setActiveTab]           = useState('seans')
  const [charRefreshKey, setCharRefreshKey] = useState(0)
  const [lang, setLang]                     = useState('tr')
  const [aiStatus, setAiStatus]             = useState('checking')

  useEffect(() => {
    chrome.storage.local.get(['settings'], (data) => {
      const s = data.settings
      setLang(s?.appLanguage || 'tr')
      // Cloud provider + key varsa "configured" say, yoksa Chrome AI'ı kontrol et
      if (s?.aiProvider && s.aiProvider !== 'chrome' && s.apiKey) {
        setAiStatus('configured')
      } else {
        chrome.runtime.sendMessage({ type: 'CHECK_AI' }, (res) => {
          setAiStatus(res?.status ?? 'unavailable')
        })
      }
    })
  }, [])

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      height: 560,
    }}>

      {/* Header */}
      <div style={{
        padding: '14px 16px 0',
        borderBottom: '0.5px solid rgba(255,255,255,.07)',
        flexShrink: 0,
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: '#afa9ec', letterSpacing: '.14em' }}>
            GRIMOIRE
          </div>
          <div
            title={AI_STATUS_DOT[aiStatus]?.title ?? ''}
            style={{
              width: 7, height: 7, borderRadius: '50%',
              background: AI_STATUS_DOT[aiStatus]?.color ?? '#534ab7',
              boxShadow: `0 0 5px ${AI_STATUS_DOT[aiStatus]?.color ?? '#534ab7'}88`,
              flexShrink: 0,
            }}
          />
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
              {t(`tabs.${tab.id}`, lang)}
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
            <CharacterCard refreshKey={charRefreshKey} lang={lang} />
            <SessionControl onSessionChange={() => setCharRefreshKey(k => k + 1)} lang={lang} />
          </>
        )}

        {activeTab === 'grimoire' && <GrimoireList lang={lang} />}

        {activeTab === 'dunya'    && <WorldChronicle lang={lang} />}

        {activeTab === 'ayarlar'  && <Settings lang={lang} />}
      </div>

    </div>
  )
}
