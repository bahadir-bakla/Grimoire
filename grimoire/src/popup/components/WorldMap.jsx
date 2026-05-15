import { useMemo, useState } from 'react'

const TYPE_ICONS = {
  place:     '🏰',
  event:     '⚡',
  character: '🧙',
  era:       '📜',
  artifact:  '💎',
}

const TYPE_COLORS = {
  place:     '#7f77dd', // Mor
  event:     '#e24b4a', // Kırmızı
  character: '#1d9e75', // Yeşil
  era:       '#ef9f27', // Turuncu
  artifact:  '#4a90e2', // Mavi
}

export default function WorldMap({ world, lang }) {
  const [hoveredEntry, setHoveredEntry] = useState(null)

  // Group entries by realm
  const realms = useMemo(() => {
    if (!world?.entries) return {}
    const grouped = {}
    world.entries.forEach(entry => {
      const r = entry.realm || (lang === 'en' ? 'Unknown Lands' : 'Bilinmeyen Topraklar')
      if (!grouped[r]) grouped[r] = []
      grouped[r].push(entry)
    })
    return grouped
  }, [world, lang])

  if (!world || world.entries.length === 0) return null

  return (
    <div style={{ position: 'relative', width: '100%', minHeight: '300px', paddingBottom: 60 }}>
      {/* Harita Arkaplanı */}
      <div style={{
        position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
        background: 'radial-gradient(circle at center, rgba(83,74,183,0.05) 0%, transparent 70%)',
        zIndex: 0, pointerEvents: 'none'
      }} />

      {/* Bölgeler */}
      <div style={{
        display: 'flex', flexDirection: 'column', gap: 24, position: 'relative', zIndex: 1
      }}>
        {Object.entries(realms).map(([realmName, entries]) => (
          <div key={realmName} style={{
            background: 'rgba(255,255,255,.01)',
            border: '0.5px solid rgba(83,74,183,.2)',
            borderRadius: 12,
            padding: 16,
            position: 'relative',
          }}>
            <div style={{
              position: 'absolute', top: -10, left: 16,
              background: '#0f0e17', padding: '0 8px',
              fontSize: 12, fontWeight: 600, color: '#7f77dd',
              letterSpacing: '.05em', border: '0.5px solid rgba(83,74,183,.4)',
              borderRadius: 6
            }}>
              {realmName}
            </div>

            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16, marginTop: 8 }}>
              {entries.map(entry => (
                <div
                  key={entry.id}
                  onMouseEnter={() => setHoveredEntry(entry)}
                  onMouseLeave={() => setHoveredEntry(null)}
                  style={{
                    display: 'flex', flexDirection: 'column', alignItems: 'center',
                    cursor: 'pointer', opacity: 0.9, transition: 'all .2s'
                  }}
                  onMouseOver={(e) => { e.currentTarget.style.opacity = 1; e.currentTarget.style.transform = 'translateY(-2px)' }}
                  onMouseOut={(e) => { e.currentTarget.style.opacity = 0.9; e.currentTarget.style.transform = 'none' }}
                >
                  <div style={{
                    width: entry.type === 'place' ? 44 : 34,
                    height: entry.type === 'place' ? 44 : 34,
                    borderRadius: '50%',
                    background: `rgba(255,255,255,.03)`,
                    border: `1px dashed ${TYPE_COLORS[entry.type] || '#534ab7'}`,
                    display: 'flex', justifyContent: 'center', alignItems: 'center',
                    fontSize: entry.type === 'place' ? 20 : 16,
                    boxShadow: `0 0 10px ${TYPE_COLORS[entry.type] || '#534ab7'}20`,
                    marginBottom: 6
                  }}>
                    {TYPE_ICONS[entry.type] || '❓'}
                  </div>
                  <div style={{
                    fontSize: 10, color: '#afa9ec', textAlign: 'center', maxWidth: 64,
                    whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis'
                  }}>
                    {entry.title}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Tooltip */}
      {hoveredEntry && (
        <div style={{
          position: 'fixed', bottom: 16, left: 16, right: 16,
          background: 'rgba(15,14,23,0.95)', border: `1px solid ${TYPE_COLORS[hoveredEntry.type] || '#534ab7'}`,
          borderRadius: 8, padding: 12, zIndex: 100, backdropFilter: 'blur(4px)',
          boxShadow: '0 4px 16px rgba(0,0,0,.5)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
            <span>{TYPE_ICONS[hoveredEntry.type] || '❓'}</span>
            <span style={{ fontSize: 13, fontWeight: 600, color: '#e8e6d9' }}>{hoveredEntry.title}</span>
            <span style={{ fontSize: 9, color: '#888780', textTransform: 'uppercase', border: '0.5px solid #88878050', padding: '1px 4px', borderRadius: 4, marginLeft: 'auto' }}>
              {hoveredEntry.type}
            </span>
          </div>
          <div style={{ fontSize: 11, color: '#d4cfb8', lineHeight: 1.5 }}>
            {hoveredEntry.summary}
          </div>
        </div>
      )}
    </div>
  )
}
