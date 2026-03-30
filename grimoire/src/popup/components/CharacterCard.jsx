import { useEffect, useState } from 'react'
import { t } from '../../shared/i18n.js'

export default function CharacterCard({ refreshKey, lang = 'tr' }) {
  const [char, setChar]       = useState(null)
  const [session, setSession]  = useState(null)
  const [grimoire, setGrimoire] = useState([])
  const [pendingQuizzes, setPendingQuizzes] = useState(0)

  useEffect(() => {
    chrome.storage.local.get(['character', 'session', 'grimoire', 'quizQueue'], (data) => {
      setChar(data.character    ?? { level: 1, xp: 0, xpToNext: 500 })
      setSession(data.session   ?? null)
      setGrimoire(data.grimoire ?? [])
      const now = Date.now()
      const pending = (data.quizQueue ?? []).filter(
        q => !q.attempted && q.scheduledFor <= now
      ).length
      setPendingQuizzes(pending)
    })
  }, [refreshKey])

  if (!char) return null

  // UI Koruma Kalkanı (Herhangi bir sebeple NaN gelirse varsayılana dön)
  const safeXp = isNaN(char.xp) || char.xp === null ? 0 : Number(char.xp)
  const safeXpToNext = isNaN(char.xpToNext) || char.xpToNext <= 0 ? 500 : Number(char.xpToNext)
  const safeLevel = isNaN(char.level) || char.level <= 0 ? 1 : Number(char.level)

  const pct = Math.min(100, Math.floor((safeXp / safeXpToNext) * 100))
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
            {t('char.level', lang)} {safeLevel}
          </div>
          <div style={{ fontSize: 11, color: '#534ab7', marginTop: 2 }}>
            {pct}{t('char.full', lang)}
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
            ▼ {session.depth}. {t('char.floorActive', lang)}
          </div>
        ) : (
          <div style={{
            fontSize: 11,
            color: '#534ab7',
            opacity: .5,
          }}>
            {t('char.noSession', lang)}
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
        <span>{safeXp} XP</span>
        <span>{safeXpToNext - safeXp} {t('char.xpRemaining', lang)}</span>
      </div>

      {/* İstatistikler */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: '1fr 1fr',
        gap: 8,
      }}>
        <StatCell label={t('char.totalScrolls', lang)} value={grimoire.length} />
        <StatCell label={t('char.thisWeek', lang)} value={weeklyScrolls} />
      </div>

      {/* Memory Palace badge */}
      {pendingQuizzes > 0 && (
        <div style={{
          marginTop: 8,
          background: 'rgba(175,169,236,.08)',
          border: '0.5px solid rgba(175,169,236,.25)',
          borderRadius: 8,
          padding: '7px 10px',
          fontSize: 11,
          color: '#afa9ec',
          textAlign: 'center',
          letterSpacing: '.02em',
        }}>
          🏛️ {t('quiz.badge', lang).replace('{count}', pendingQuizzes)}
        </div>
      )}
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
