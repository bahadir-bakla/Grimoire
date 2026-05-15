import { useRef, useState } from 'react'
import { createRoot } from 'react-dom/client'
import html2canvas from 'html2canvas'

// Lore stiline göre renk teması
const STYLE_THEMES = {
  fantasy:    { accent: '#7f77dd', bg: '#0f0e17', label: '⚔️ Fantasy' },
  scifi:      { accent: '#3ba8d8', bg: '#0a1220', label: '🚀 Sci-Fi' },
  noir:       { accent: '#b8a888', bg: '#111010', label: '🌧️ Noir' },
  mythology:  { accent: '#d4a840', bg: '#110e08', label: '⚡ Mitoloji' },
  cyberpunk:  { accent: '#e040a0', bg: '#0a0014', label: '⚡ Cyberpunk' },
  lovecraft:  { accent: '#5a8060', bg: '#080e0a', label: '🐙 Lovecraft' },
  pirate:     { accent: '#c87830', bg: '#0e0c08', label: '☠️ Korsan' },
  postapoc:   { accent: '#a04830', bg: '#100a08', label: '☢️ Kıyamet' },
  samurai:    { accent: '#c83840', bg: '#100808', label: '⛩️ Samuray' },
  twitter:    { accent: '#1d9ef0', bg: '#080e18', label: '🐦 Twitter' },
  formal_summary: { accent: '#888780', bg: '#0f0f0f', label: '📋 Özet' },
}

export function useLoreCardExport() {
  const [exporting, setExporting] = useState(false)

  const exportCard = async (entry, lang = 'tr') => {
    setExporting(true)
    try {
      // Kartı geçici gizli div içinde render et
      const container = document.createElement('div')
      container.style.cssText = 'position:fixed;left:-9999px;top:-9999px;'
      document.body.appendChild(container)

      const root = createRoot(container)

      await new Promise(resolve => {
        root.render(
          <LoreCardCanvas entry={entry} lang={lang} onReady={resolve} />
        )
      })

      const cardEl = container.querySelector('#gr-lore-card-canvas')
      if (!cardEl) throw new Error('Card element not found')

      const canvas = await html2canvas(cardEl, {
        scale: 2,
        useCORS: false,
        backgroundColor: null,
        logging: false,
      })

      const url = canvas.toDataURL('image/png')
      const a   = document.createElement('a')
      a.href     = url
      a.download = `grimoire-${entry.id.slice(0, 8)}.png`
      a.click()

      root.unmount()
      container.remove()
    } finally {
      setExporting(false)
    }
  }

  return { exportCard, exporting }
}

// Kart DOM'u — html2canvas'ın render edeceği element
function LoreCardCanvas({ entry, lang, onReady }) {
  const ref = useRef(null)
  const style = entry.loreStyle || 'fantasy'
  const theme = STYLE_THEMES[style] ?? STYLE_THEMES.fantasy

  const date = new Date(entry.savedAt).toLocaleDateString(
    lang === 'en' ? 'en-US' : 'tr-TR',
    { day: 'numeric', month: 'long', year: 'numeric' }
  )

  // Lore metnini kırp — kart için ~280 karakter
  const preview = entry.loreText
    ? entry.loreText.replace(/\n+/g, ' ').trim().slice(0, 280) + (entry.loreText.length > 280 ? '…' : '')
    : ''

  // Render tamamlandığında onReady çağır
  const refCallback = (el) => {
    ref.current = el
    if (el) setTimeout(onReady, 50)
  }

  return (
    <div
      id="gr-lore-card-canvas"
      ref={refCallback}
      style={{
        width: 420,
        minHeight: 560,
        background: theme.bg,
        borderRadius: 16,
        padding: '28px 28px 24px',
        fontFamily: 'Georgia, serif',
        boxSizing: 'border-box',
        border: `1.5px solid ${theme.accent}33`,
        display: 'flex',
        flexDirection: 'column',
        gap: 0,
        overflow: 'hidden',
      }}
    >
      {/* Header */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 20,
      }}>
        <div style={{
          fontFamily: '-apple-system, BlinkMacSystemFont, sans-serif',
          fontSize: 11,
          fontWeight: 700,
          letterSpacing: '.18em',
          color: theme.accent,
          textTransform: 'uppercase',
        }}>
          GRIMOIRE
        </div>
        <div style={{
          fontFamily: '-apple-system, BlinkMacSystemFont, sans-serif',
          fontSize: 11,
          color: theme.accent + '99',
          letterSpacing: '.06em',
        }}>
          {theme.label}
        </div>
      </div>

      {/* Divider */}
      <div style={{ height: 1, background: theme.accent + '22', marginBottom: 20 }} />

      {/* Başlık */}
      <div style={{
        fontSize: 17,
        fontWeight: 500,
        color: '#e8e6d9',
        lineHeight: 1.4,
        marginBottom: 16,
        fontFamily: 'Georgia, serif',
      }}>
        {entry.title}
      </div>

      {/* Lore metni */}
      <div style={{
        fontSize: 13,
        color: '#c0b8a8',
        lineHeight: 1.75,
        fontStyle: 'italic',
        flex: 1,
        marginBottom: 20,
      }}>
        {preview}
      </div>

      {/* Divider */}
      <div style={{ height: 1, background: theme.accent + '22', marginBottom: 16 }} />

      {/* Footer */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        fontFamily: '-apple-system, BlinkMacSystemFont, sans-serif',
      }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <div style={{ fontSize: 12, color: theme.accent, fontWeight: 600 }}>
            +{entry.xpEarned} XP
          </div>
          <div style={{ fontSize: 10, color: '#534ab760' }}>{date}</div>
        </div>
        <div style={{
          fontSize: 10,
          color: '#534ab7',
          letterSpacing: '.08em',
          fontWeight: 500,
        }}>
          grimoire.extension
        </div>
      </div>
    </div>
  )
}
