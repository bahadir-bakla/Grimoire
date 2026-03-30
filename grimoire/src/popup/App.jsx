import { useState, useEffect } from 'react'
import SessionControl   from './components/SessionControl.jsx'
import CharacterCard    from './components/CharacterCard.jsx'
import GrimoireList     from './components/GrimoireList.jsx'
import WorldChronicle   from './components/WorldChronicle.jsx'
import Settings         from './components/Settings.jsx'
import { t }            from '../shared/i18n.js'

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

  useEffect(() => {
    chrome.storage.local.get(['settings'], (data) => {
      setLang(data.settings?.appLanguage || 'tr')
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
