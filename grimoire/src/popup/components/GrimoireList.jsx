import { useEffect, useState } from 'react'
import { removeFromGrimoire } from '../../shared/storage.js'
import { t } from '../../shared/i18n.js'

export default function GrimoireList({ lang = 'tr' }) {
  const [entries, setEntries] = useState(null)

  useEffect(() => {
    chrome.storage.local.get(['grimoire'], ({ grimoire }) => {
      setEntries(grimoire ?? [])
    })
  }, [])

  if (entries === null) {
    return (
      <div style={{ textAlign: 'center', padding: '24px 0', color: '#534ab7', fontSize: 12 }}>
        {t('list.loading', lang)}
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
        {t('list.empty1', lang)}<br />
        {t('list.empty2', lang)}
      </div>
    )
  }

  const handleDelete = async (id, e) => {
    e.stopPropagation()
    if (!confirm(t('list.deleteConfirm', lang))) return
    const updated = await removeFromGrimoire(id)
    setEntries(updated)
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      {entries.map(entry => (
        <EntryCard key={entry.id} entry={entry} onDelete={handleDelete} lang={lang} />
      ))}
    </div>
  )
}

function EntryCard({ entry, onDelete, lang }) {
  const date = new Date(entry.savedAt).toLocaleDateString(lang === 'en' ? 'en-US' : 'tr-TR', {
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
        alignItems: 'center',
        fontSize: 11,
        color: '#888780',
      }}>
        <span>{date}</span>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <span style={{ color: '#534ab7' }}>+{entry.xpEarned} XP</span>
          <button 
            onClick={(e) => onDelete(entry.id, e)}
            style={{
              background: 'none', border: 'none', color: '#e24b4a', cursor: 'pointer',
              padding: '0 4px', fontSize: 13, lineHeight: 1, opacity: 0.7
            }}
            title="Sil"
            onMouseEnter={e => e.currentTarget.style.opacity = 1}
            onMouseLeave={e => e.currentTarget.style.opacity = 0.7}
          >×</button>
        </div>
      </div>
    </div>
  )
}
