import { useEffect, useState } from 'react'
import { t } from '../../shared/i18n.js'

const TYPE_ICONS = {
  place:     '🏰',
  event:     '⚡',
  character: '🧙',
  era:       '📜',
  artifact:  '💎',
}

export default function WorldChronicle({ lang = 'tr' }) {
  const [world, setWorld]       = useState(null)
  const [loading, setLoading]   = useState(false)
  const [copied,  setCopied]    = useState(false)

  useEffect(() => {
    chrome.storage.local.get(['world'], ({ world }) => {
      setWorld(world ?? { entries: [], chronicle: '', lastChronicleUpdate: null })
    })
  }, [])

  const updateChronicle = () => {
    if (!world?.entries?.length) return
    setLoading(true)
    chrome.runtime.sendMessage({ type: 'REGENERATE_CHRONICLE' }, (res) => {
      setLoading(false)
      if (res?.ok) {
        setWorld(prev => ({
          ...prev,
          chronicle:           res.chronicle,
          lastChronicleUpdate: Date.now(),
        }))
      }
    })
  }

  const copyChronicle = () => {
    if (!world?.chronicle) return
    navigator.clipboard.writeText(world.chronicle).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  if (!world) return null

  const isEmpty = world.entries.length === 0

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

      {/* ── Entity Chips ──────────────────────────────────────────── */}
      {!isEmpty && (
        <div>
          <div style={{
            fontSize: 10, fontWeight: 600, letterSpacing: '.08em',
            color: '#534ab7', textTransform: 'uppercase', marginBottom: 8,
          }}>
            {t('world.entities', lang)} ({world.entries.length})
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {world.entries.map(entry => (
              <div
                key={entry.id}
                title={`${t('world.realm', lang)} ${entry.realm || '?'}`}
                style={{
                  background:   'rgba(83,74,183,.1)',
                  border:       '0.5px solid rgba(83,74,183,.25)',
                  borderRadius: 99,
                  padding:      '4px 10px',
                  fontSize:     11,
                  color:        '#afa9ec',
                  display:      'flex',
                  alignItems:   'center',
                  gap:          4,
                  cursor:       'default',
                }}
              >
                <span>{TYPE_ICONS[entry.type] ?? '🌐'}</span>
                <span style={{ maxWidth: 90, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {entry.title}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Chronicle ────────────────────────────────────────────── */}
      <div>
        <div style={{
          fontSize: 10, fontWeight: 600, letterSpacing: '.08em',
          color: '#534ab7', textTransform: 'uppercase', marginBottom: 8,
        }}>
          {t('world.chronicle', lang)}
        </div>

        {isEmpty ? (
          <div style={{
            textAlign: 'center', padding: '24px 16px',
            color: '#888780', fontSize: 12, lineHeight: 1.6,
          }}>
            {t('world.empty', lang)}
          </div>
        ) : world.chronicle ? (
          <div style={{
            background:    'rgba(255,255,255,.02)',
            border:        '0.5px solid rgba(175,169,236,.12)',
            borderRadius:  10,
            padding:       14,
            fontSize:      13,
            color:         '#d4cfb8',
            lineHeight:    1.8,
            fontFamily:    'Georgia, serif',
            fontStyle:     'italic',
            marginBottom:  10,
            maxHeight:     210,
            overflowY:     'auto',
            scrollbarWidth:'thin',
            scrollbarColor:'rgba(83,74,183,.3) transparent',
          }}>
            {world.chronicle}
          </div>
        ) : (
          <div style={{
            textAlign: 'center', padding: '16px',
            color: '#534ab7', fontSize: 12, lineHeight: 1.6,
            background: 'rgba(83,74,183,.05)', borderRadius: 8,
            marginBottom: 10,
          }}>
            {t('world.noChronicle', lang)}
          </div>
        )}

        {/* Buttons */}
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            onClick={updateChronicle}
            disabled={loading || isEmpty}
            style={{
              flex:         1,
              padding:      '9px 0',
              background:   loading || isEmpty ? 'rgba(83,74,183,.08)' : '#534ab7',
              border:       isEmpty ? '0.5px solid rgba(83,74,183,.2)' : 'none',
              borderRadius: 8,
              color:        loading || isEmpty ? '#534ab7' : '#fff',
              fontSize:     12,
              fontWeight:   500,
              cursor:       loading || isEmpty ? 'default' : 'pointer',
              transition:   'all .15s',
              fontFamily:   'inherit',
            }}
          >
            {loading ? t('world.generating', lang) : t('world.updateBtn', lang)}
          </button>

          {world.chronicle && (
            <button
              onClick={copyChronicle}
              style={{
                padding:      '9px 14px',
                background:   copied ? 'rgba(29,158,117,.12)' : 'rgba(255,255,255,.04)',
                border:       '0.5px solid ' + (copied ? 'rgba(29,158,117,.3)' : 'rgba(255,255,255,.1)'),
                borderRadius: 8,
                color:        copied ? '#1d9e75' : '#888780',
                fontSize:     12,
                cursor:       'pointer',
                transition:   'all .15s',
                fontFamily:   'inherit',
              }}
            >
              {copied ? t('world.copied', lang) : t('world.copy', lang)}
            </button>
          )}
        </div>

        {world.lastChronicleUpdate && (
          <div style={{ fontSize: 10, color: '#534ab7', marginTop: 6, opacity: .6 }}>
            {t('world.lastUpdated', lang)}{' '}
            {new Date(world.lastChronicleUpdate).toLocaleDateString(
              lang === 'en' ? 'en-US' : 'tr-TR',
              { day: 'numeric', month: 'short', year: 'numeric' }
            )}
          </div>
        )}
      </div>
    </div>
  )
}
