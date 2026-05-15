import { useEffect, useState, useRef } from 'react'
import { removeFromGrimoire, setStorage } from '../../shared/storage.js'
import { t } from '../../shared/i18n.js'
import { useLoreCardExport } from './LoreCard.jsx'

export default function GrimoireList({ lang = 'tr' }) {
  const [entries, setEntries]       = useState(null)
  const [query, setQuery]           = useState('')
  const [activeTag, setActiveTag]   = useState(null)
  const [showExport, setShowExport] = useState(false)
  const { exportCard, exporting }   = useLoreCardExport()

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

  // Tüm tagler — tüm kayıtlardan unique set
  const allTags = [...new Set(entries.flatMap(e => e.tags ?? []))].sort()

  // Filtrele
  const q = query.trim().toLowerCase()
  const filtered = entries.filter(e => {
    const matchTag   = !activeTag || (e.tags ?? []).includes(activeTag)
    const matchQuery = !q
      || e.title.toLowerCase().includes(q)
      || e.loreText.toLowerCase().includes(q)
    return matchTag && matchQuery
  })

  const handleDelete = async (id, ev) => {
    ev.stopPropagation()
    if (!confirm(t('list.deleteConfirm', lang))) return
    const updated = await removeFromGrimoire(id)
    setEntries(updated)
  }

  const handleTagUpdate = async (entryId, newTags) => {
    const updated = entries.map(e => e.id === entryId ? { ...e, tags: newTags } : e)
    setEntries(updated)
    await setStorage({ grimoire: updated })
  }

  // ── Export ──────────────────────────────────────────────────────────────

  const exportMarkdown = () => {
    const lines = entries.map(e => {
      const date = new Date(e.savedAt).toLocaleDateString()
      const tags    = e.tags?.length    ? `\n**Tags:** ${e.tags.join(', ')}` : ''
      const comment = e.comment?.trim() ? `\n\n> **Not:** ${e.comment}` : ''
      const badge   = e.isHighlight     ? `\n> *Seçili metin*` : ''
      return `# ${e.title}\n**Tarih:** ${date} | **XP:** +${e.xpEarned}${tags}${badge}${comment}\n\n${e.loreText}\n\n---`
    }).join('\n\n')

    download(`grimoire-${Date.now()}.md`, lines, 'text/markdown')
    setShowExport(false)
  }

  const exportJSON = () => {
    download(
      `grimoire-${Date.now()}.json`,
      JSON.stringify(entries, null, 2),
      'application/json'
    )
    setShowExport(false)
  }

  // ── Render ───────────────────────────────────────────────────────────────

  if (entries.length === 0) {
    return (
      <div style={{ textAlign: 'center', padding: '24px 16px', color: '#888780', fontSize: 12, lineHeight: 1.6 }}>
        {t('list.empty1', lang)}<br />{t('list.empty2', lang)}
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>

      {/* Arama + Export butonu */}
      <div style={{ display: 'flex', gap: 6 }}>
        <input
          type="text"
          value={query}
          onChange={e => setQuery(e.target.value)}
          placeholder={t('list.searchPlaceholder', lang)}
          style={inputStyle}
        />
        <div style={{ position: 'relative' }}>
          <button
            onClick={() => setShowExport(v => !v)}
            style={exportBtnStyle}
            title={t('list.exportBtn', lang)}
          >
            ↓
          </button>
          {showExport && (
            <div style={dropdownStyle}>
              <button style={dropItemStyle} onClick={exportMarkdown}>{t('list.exportMd', lang)}</button>
              <button style={dropItemStyle} onClick={exportJSON}>{t('list.exportJson', lang)}</button>
            </div>
          )}
        </div>
      </div>

      {/* Tag filtre barı */}
      {allTags.length > 0 && (
        <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
          <TagChip
            label={t('list.allTags', lang)}
            active={activeTag === null}
            onClick={() => setActiveTag(null)}
          />
          {allTags.map(tag => (
            <TagChip
              key={tag}
              label={tag}
              active={activeTag === tag}
              onClick={() => setActiveTag(activeTag === tag ? null : tag)}
            />
          ))}
        </div>
      )}

      {/* Kayıtlar */}
      {filtered.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '16px 0', color: '#888780', fontSize: 12 }}>
          {t('list.emptySearch', lang)}
        </div>
      ) : (
        filtered.map(entry => (
          <EntryCard
            key={entry.id}
            entry={entry}
            onDelete={handleDelete}
            onTagUpdate={handleTagUpdate}
            lang={lang}
            onExportCard={exportCard}
            exportingCard={exporting}
          />
        ))
      )}
    </div>
  )
}

// ── EntryCard ────────────────────────────────────────────────────────────────

function EntryCard({ entry, onDelete, onTagUpdate, onExportCard, exportingCard, lang }) {
  const [expanded, setExpanded]   = useState(false)
  const [tagInput, setTagInput]   = useState('')
  const inputRef                  = useRef(null)

  const date = new Date(entry.savedAt).toLocaleDateString(lang === 'en' ? 'en-US' : 'tr-TR', {
    day: 'numeric', month: 'short',
  })
  const tags = entry.tags ?? []

  const addTag = () => {
    const val = tagInput.trim()
    if (!val || tags.includes(val)) { setTagInput(''); return }
    onTagUpdate(entry.id, [...tags, val])
    setTagInput('')
  }

  const removeTag = (tag, ev) => {
    ev.stopPropagation()
    onTagUpdate(entry.id, tags.filter(t => t !== tag))
  }

  return (
    <div style={cardStyle}>
      {/* Başlık satırı */}
      <div
        onClick={() => setExpanded(v => !v)}
        style={{ cursor: 'pointer', userSelect: 'none' }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 6 }}>
          <div style={{ fontSize: 12, fontWeight: 500, color: '#d4cfb8', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {entry.isHighlight && <span style={{ color: '#534ab7', marginRight: 4 }}>✨</span>}
            {entry.title}
          </div>
          <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexShrink: 0 }}>
            <span style={{ fontSize: 11, color: '#534ab7' }}>+{entry.xpEarned} XP</span>
            <button
              onClick={(e) => onDelete(entry.id, e)}
              style={{ background: 'none', border: 'none', color: '#e24b4a', cursor: 'pointer', padding: '0 2px', fontSize: 13, lineHeight: 1, opacity: 0.6 }}
              onMouseEnter={e => e.currentTarget.style.opacity = 1}
              onMouseLeave={e => e.currentTarget.style.opacity = 0.6}
              title="Sil"
            >×</button>
          </div>
        </div>
        <div style={{ fontSize: 10, color: '#888780', marginTop: 3 }}>{date}</div>
      </div>

      {/* Taglar */}
      <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginTop: 7, alignItems: 'center' }}>
        {tags.map(tag => (
          <span key={tag} style={tagStyle}>
            {tag}
            <button
              onClick={e => removeTag(tag, e)}
              style={{ background: 'none', border: 'none', color: '#afa9ec', cursor: 'pointer', padding: '0 0 0 3px', fontSize: 10, lineHeight: 1 }}
            >×</button>
          </span>
        ))}
        <input
          ref={inputRef}
          value={tagInput}
          onChange={e => setTagInput(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addTag() } }}
          onClick={e => e.stopPropagation()}
          placeholder={t('list.tagPlaceholder', lang)}
          style={tagInputStyle}
        />
      </div>

      {/* Genişletilmiş lore önizleme */}
      {expanded && (
        <div
          onClick={e => e.stopPropagation()}
          style={{ marginTop: 10, borderTop: '0.5px solid rgba(255,255,255,.06)', paddingTop: 10 }}
        >
          <div style={{ fontSize: 11, color: '#c0b8a8', lineHeight: 1.65, fontStyle: 'italic', maxHeight: 160, overflowY: 'auto' }}>
            {entry.loreText.slice(0, 600)}{entry.loreText.length > 600 ? '…' : ''}
          </div>
          <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
            <button
              onClick={() => chrome.tabs.create({ url: entry.url })}
              style={{ background: 'none', border: '1px solid rgba(83,74,183,.3)', borderRadius: 5, color: '#534ab7', fontSize: 10, padding: '4px 8px', cursor: 'pointer' }}
            >
              {lang === 'en' ? 'Open page →' : 'Sayfayı aç →'}
            </button>
            <button
              onClick={() => onExportCard(entry, lang)}
              disabled={exportingCard}
              style={{ background: 'rgba(83,74,183,.15)', border: '1px solid rgba(83,74,183,.3)', borderRadius: 5, color: '#afa9ec', fontSize: 10, padding: '4px 8px', cursor: exportingCard ? 'default' : 'pointer', opacity: exportingCard ? 0.5 : 1 }}
            >
              {exportingCard ? '...' : (lang === 'en' ? '🖼 Save as Card' : '🖼 Kart olarak kaydet')}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

// ── TagChip ──────────────────────────────────────────────────────────────────

function TagChip({ label, active, onClick }) {
  return (
    <button
      onClick={onClick}
      style={{
        background: active ? 'rgba(83,74,183,.35)' : 'rgba(255,255,255,.04)',
        border: `1px solid ${active ? 'rgba(83,74,183,.7)' : 'rgba(255,255,255,.08)'}`,
        borderRadius: 20,
        color: active ? '#afa9ec' : '#888780',
        fontSize: 10,
        padding: '3px 9px',
        cursor: 'pointer',
        transition: 'all .15s',
        fontFamily: 'inherit',
      }}
    >
      {label}
    </button>
  )
}

// ── Yardımcılar ──────────────────────────────────────────────────────────────

function download(filename, content, type) {
  const blob = new Blob([content], { type })
  const url  = URL.createObjectURL(blob)
  const a    = document.createElement('a')
  a.href     = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

// ── Stiller ──────────────────────────────────────────────────────────────────

const inputStyle = {
  flex: 1,
  background: 'rgba(255,255,255,.04)',
  border: '1px solid rgba(83,74,183,.25)',
  borderRadius: 7,
  color: '#d4cfb8',
  fontFamily: 'inherit',
  fontSize: 12,
  padding: '7px 10px',
  outline: 'none',
}

const exportBtnStyle = {
  background: 'rgba(83,74,183,.2)',
  border: '1px solid rgba(83,74,183,.4)',
  borderRadius: 7,
  color: '#afa9ec',
  fontSize: 15,
  width: 34,
  height: 34,
  cursor: 'pointer',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  fontWeight: 600,
}

const dropdownStyle = {
  position: 'absolute',
  right: 0,
  top: 38,
  background: '#1a1830',
  border: '1px solid rgba(83,74,183,.4)',
  borderRadius: 8,
  overflow: 'hidden',
  zIndex: 100,
  minWidth: 180,
  boxShadow: '0 8px 24px rgba(0,0,0,.5)',
}

const dropItemStyle = {
  display: 'block',
  width: '100%',
  background: 'none',
  border: 'none',
  color: '#afa9ec',
  fontSize: 12,
  padding: '9px 14px',
  textAlign: 'left',
  cursor: 'pointer',
  fontFamily: 'inherit',
}

const cardStyle = {
  background: 'rgba(255,255,255,.03)',
  border: '0.5px solid rgba(255,255,255,.07)',
  borderRadius: 8,
  padding: '9px 11px',
  transition: 'border-color .15s',
}

const tagStyle = {
  display: 'inline-flex',
  alignItems: 'center',
  background: 'rgba(83,74,183,.15)',
  border: '1px solid rgba(83,74,183,.3)',
  borderRadius: 20,
  color: '#afa9ec',
  fontSize: 10,
  padding: '2px 6px 2px 8px',
}

const tagInputStyle = {
  background: 'none',
  border: 'none',
  borderBottom: '1px solid rgba(83,74,183,.3)',
  color: '#afa9ec',
  fontSize: 10,
  padding: '2px 4px',
  outline: 'none',
  width: 90,
  fontFamily: 'inherit',
}
