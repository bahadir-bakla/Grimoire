import { useEffect, useState, useRef } from 'react'
import { MSG } from '../../shared/constants.js'
import { t } from '../../shared/i18n.js'

export default function SessionControl({ onSessionChange, lang = 'tr' }) {
  const [session, setSession]   = useState(null)
  const [elapsed, setElapsed]   = useState(0)
  const [loading, setLoading]   = useState(false)
  const [rewardMessage, setRewardMessage] = useState(null)
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

  const toggleSession = (mode = 'lore') => {
    setLoading(true)
    setRewardMessage(null)
    const type = session?.isActive ? MSG.END_SESSION : MSG.START_SESSION
    
    chrome.runtime.sendMessage({ type, mode }, (endRes) => {
      if (type === MSG.END_SESSION && endRes?.ok && endRes.result?.focusXP > 0) {
        setRewardMessage(`+${endRes.result.focusXP} ${t('session.reward', lang)}`)
      }

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
            {t('session.focusTime', lang)}
          </div>
        </div>
      )}

      {rewardMessage && (
        <div style={{
          textAlign: 'center', marginBottom: 12, color: '#1d9e75', fontSize: 13, fontWeight: 500
        }}>
          {rewardMessage}
        </div>
      )}

      {/* Buton */}
      <button
        onClick={() => toggleSession('lore')}
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
            ? t('session.endSession', lang)
            : t('session.enterDungeon', lang)}
      </button>

      {/* Resmi Özet Butonu */}
      {!isActive && (
        <button
          onClick={() => toggleSession('formal_summary')}
          disabled={loading}
          style={{
            marginTop: 8,
            width: '100%',
            padding: '9px 0',
            borderRadius: 9,
            border: '1px solid rgba(83,74,183,.4)',
            background: 'rgba(83,74,183,.1)',
            color: '#afa9ec',
            fontSize: 13,
            fontWeight: 500,
            cursor: loading ? 'not-allowed' : 'pointer',
            opacity: loading ? .6 : 1,
            transition: 'all .15s',
            fontFamily: 'inherit',
          }}
        >
          {loading ? '...' : t('session.formalSummary', lang)}
        </button>
      )}
    </div>
  )
}
