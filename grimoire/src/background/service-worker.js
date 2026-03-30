import {
  getStorage,
  setStorage,
  drainCharacterXP,
  updateCharacter,
  addToGrimoire,
} from '../shared/storage.js'

import {
  STORAGE_KEYS,
  MSG,
  DISTRACTION_DOMAINS,
  SCROLLS_PER_DEPTH,
  DEPTH_THRESHOLDS,
  MONSTERS,
  IDLE_THRESHOLD_MS,
  WEEKLY_BOSS,
} from '../shared/constants.js'

import {
  transformToLore,
  checkAIAvailability,
  extractWorldEntry,
  generateWorldChronicle,
  generateQuizQuestions,
} from '../shared/ai.js'

console.log('[Grimoire] Service worker started — v2.0.0')

// ─── Yardımcı fonksiyonlar ────────────────────────────────────────────────

async function getActiveSession() {
  const { session } = await getStorage([STORAGE_KEYS.SESSION])
  return session?.isActive ? session : null
}

async function calculateDepth() {
  const { grimoire } = await getStorage([STORAGE_KEYS.GRIMOIRE])
  return Math.floor((grimoire?.length ?? 0) / SCROLLS_PER_DEPTH) + 1
}

function isDistraction(url = '') {
  return DISTRACTION_DOMAINS.some(d => url.includes(d))
}

// ─── Seans başlat ────────────────────────────────────────────────────────

async function startSession(focusTabId, mode = 'lore') {
  const depth = await calculateDepth()

  const session = {
    isActive:   true,
    startedAt:  Date.now(),
    focusTabId,
    depth,
    mode,
  }

  await setStorage({ [STORAGE_KEYS.SESSION]: session })
  console.log('[Grimoire] Session started, focusTabId:', focusTabId, 'depth:', depth)
  return session
}

// ─── Seans bitir ─────────────────────────────────────────────────────────

async function endSession() {
  const session = await getActiveSession()
  if (!session) return null

  const duration = Date.now() - session.startedAt
  await setStorage({ [STORAGE_KEYS.SESSION]: null })

  // Odaklanma süresi için XP (1 dakikaya = 1 XP)
  const minutes = Math.floor(duration / 60000)
  const focusXP = Math.min(200, minutes * 1)
  let character = null
  let leveledUp = false

  if (focusXP > 0) {
    const prevChar = await getStorage([STORAGE_KEYS.CHARACTER]).then(res => res.character)
    character = await updateCharacter(focusXP)
    leveledUp = character.level > (prevChar?.level ?? 1)
  }

  console.log('[Grimoire] Session ended, duration:', Math.floor(duration / 1000), 's, focusXP:', focusXP)
  return { duration, focusXP, leveledUp, character }
}

// ─── Mesaj handler ────────────────────────────────────────────────────────

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  console.log('[Grimoire SW] Message:', msg.type)

  // Seans başlat
  if (msg.type === MSG.START_SESSION) {
    ;(async () => {
      try {
        const [activeTab] = await chrome.tabs.query({
          active: true,
          currentWindow: true,
        })
        const session = await startSession(activeTab?.id ?? null, msg.mode)
        sendResponse({ ok: true, session })
      } catch (err) {
        console.error('[Grimoire SW] startSession error:', err)
        sendResponse({ ok: false, error: err.message })
      }
    })()
    return true
  }

  // Seans bitir
  if (msg.type === MSG.END_SESSION) {
    ;(async () => {
      try {
        const result = await endSession()
        sendResponse({ ok: true, result })
      } catch (err) {
        sendResponse({ ok: false, error: err.message })
      }
    })()
    return true
  }

  // Güncel state'i döndür
  if (msg.type === MSG.GET_STATE) {
    ;(async () => {
      try {
        const data = await getStorage()
        sendResponse({ ok: true, data })
      } catch (err) {
        sendResponse({ ok: false, error: err.message })
      }
    })()
    return true
  }

  // ─── AI kullanılabilirlik kontrolü ───────────────────────────────────────

  if (msg.type === 'CHECK_AI') {
    ;(async () => {
      const status = await checkAIAvailability()
      sendResponse({ status })
    })()
    return true
  }

  // ─── Lore dönüşümü (Chrome Built-in AI) ─────────────────────────────────

  if (msg.type === MSG.TRANSFORM_TO_LORE) {
    ;(async () => {
      try {
        const { settings } = await getStorage([STORAGE_KEYS.SETTINGS])
        const loreStyle = msg.overrideStyle || settings?.loreStyle || 'fantasy'

        const loreText = await transformToLore({
          text: msg.text,
          loreStyle,
        })

        sendResponse({ ok: true, loreText, style: loreStyle })
      } catch (err) {
        console.error('[Grimoire SW] TRANSFORM_TO_LORE error:', err)
        sendResponse({ ok: false, error: err.message })
      }
    })()
    return true
  }

  // ─── Grimoire kaydetme ────────────────────────────────────────────────────

  if (msg.type === MSG.SAVE_SCROLL) {
    ;(async () => {
      try {
        const { saved, reason, grimoire } = await addToGrimoire(msg.entry)

        if (!saved) {
          sendResponse({ ok: false, reason })
          return
        }

        // XP kazan
        const updatedChar = await updateCharacter(msg.entry.xpEarned)

        // Dungeon derinliğini güncelle
        const newDepth = calculateDepthFromScrolls(grimoire.length)
        const { session } = await getStorage([STORAGE_KEYS.SESSION])
        if (session?.isActive) {
          await setStorage({
            [STORAGE_KEYS.SESSION]: { ...session, depth: newDepth },
          })
        }

        // Level atlama kontrolü
        const leveledUp = updatedChar.level > (msg.entry.prevLevel ?? 1)

        sendResponse({
          ok: true,
          character: updatedChar,
          depth: newDepth,
          leveledUp,
        })

        // ▐ Living World — fire-and-forget (kayıtı engellemez)
        addWorldEntry(msg.entry)
        // ▐ Memory Palace — fire-and-forget
        scheduleMemoryPalaceQuiz(msg.entry)

      } catch (err) {
        console.error('[Grimoire SW] SAVE_SCROLL error:', err)
        sendResponse({ ok: false, error: err.message })
      }
    })()
    return true
  }

  // ─── Canavar & Boss Sonucu ──────────────────────────────────────────────────

  if (msg.type === 'BOSS_RESULT') {
    ;(async () => {
      try {
        if (msg.won) {
          await updateCharacter(msg.xpChange)
        } else {
          const { character } = await getStorage([STORAGE_KEYS.CHARACTER])
          const lossXP = Math.floor(character.xp * WEEKLY_BOSS.lossXPDrain)
          await drainCharacterXP(lossXP)
        }
        sendResponse({ ok: true })
      } catch (err) {
        sendResponse({ ok: false, error: err.message })
      }
    })()
    return true
  }

  // ─── Living World: Kronik yenile ─────────────────────────────────────────

  if (msg.type === 'REGENERATE_CHRONICLE') {
    ;(async () => {
      try {
        const { world, settings } = await getStorage([STORAGE_KEYS.WORLD, STORAGE_KEYS.SETTINGS])
        const entries = world?.entries ?? []
        if (entries.length === 0) { sendResponse({ ok: false, error: 'No world entries yet.' }); return }
        const chronicle = await generateWorldChronicle(entries, settings?.appLanguage || 'tr')
        await setStorage({ [STORAGE_KEYS.WORLD]: { ...world, chronicle, lastChronicleUpdate: Date.now() } })
        sendResponse({ ok: true, chronicle })
      } catch (err) {
        console.error('[Grimoire SW] REGENERATE_CHRONICLE error:', err)
        sendResponse({ ok: false, error: err.message })
      }
    })()
    return true
  }

  // ─── Memory Palace: Quiz sonucu ─────────────────────────────────────────

  if (msg.type === 'QUIZ_RESULT') {
    ;(async () => {
      try {
        const { quizQueue } = await getStorage([STORAGE_KEYS.QUIZ_QUEUE])
        const updated = (quizQueue ?? []).map(q =>
          q.id === msg.quizId ? { ...q, attempted: true } : q
        )
        await setStorage({ [STORAGE_KEYS.QUIZ_QUEUE]: updated })
        if (msg.correct) {
          await updateCharacter(75)
          sendResponse({ ok: true, xpGained: 75 })
        } else {
          await drainCharacterXP(30)
          sendResponse({ ok: true, xpGained: 0 })
        }
      } catch (err) {
        sendResponse({ ok: false, error: err.message })
      }
    })()
    return true
  }

  return true
})

// ─── Living World: Fire-and-forget yardımcılar ─────────────────────────────

async function addWorldEntry(entry) {
  try {
    const { world } = await getStorage([STORAGE_KEYS.WORLD])
    const worldData = world ?? { entries: [], chronicle: '', lastChronicleUpdate: null }
    const worldEntry = await extractWorldEntry(entry.loreText, worldData.entries)
    worldEntry.id       = entry.id
    worldEntry.addedAt  = Date.now()
    const updatedEntries = [worldEntry, ...worldData.entries]
    await setStorage({ [STORAGE_KEYS.WORLD]: { ...worldData, entries: updatedEntries } })
    console.log('[Grimoire World] Entity added:', worldEntry.title)
  } catch (err) {
    console.warn('[Grimoire World] non-critical:', err.message)
  }
}

async function scheduleMemoryPalaceQuiz(entry) {
  try {
    const { settings, quizQueue } = await getStorage([STORAGE_KEYS.SETTINGS, STORAGE_KEYS.QUIZ_QUEUE])
    const queue = quizQueue ?? []
    if (queue.find(q => q.entryId === entry.id)) return  // duplicate guard

    const questions = await generateQuizQuestions(
      entry.loreText,
      settings?.appLanguage || 'tr'
    )

    const quizItem = {
      id:           crypto.randomUUID(),
      entryId:      entry.id,
      articleTitle: entry.title,
      scheduledFor: Date.now() + (3 * 24 * 60 * 60 * 1000),  // 3 gün
      attempted:    false,
      questions,
    }

    await setStorage({ [STORAGE_KEYS.QUIZ_QUEUE]: [...queue, quizItem] })
    chrome.alarms.create(`quiz-${quizItem.id}`, { when: quizItem.scheduledFor })
    console.log('[Grimoire Quiz] Scheduled for:', entry.title)
  } catch (err) {
    console.warn('[Grimoire Quiz] non-critical:', err.message)
  }
}

// ─── Tab değişim takibi ───────────────────────────────────────────────────

chrome.tabs.onActivated.addListener(async ({ tabId }) => {
  // Pending quiz var mı kontrol et (alarm tetiklenirken aktif tab yoktu)
  try {
    const { pendingQuizId } = await getStorage(['pendingQuizId'])
    if (pendingQuizId) {
      await setStorage({ pendingQuizId: null })
      const { quizQueue } = await getStorage([STORAGE_KEYS.QUIZ_QUEUE])
      const quiz = (quizQueue ?? []).find(q => q.id === pendingQuizId && !q.attempted)
      if (quiz) {
        chrome.tabs.sendMessage(tabId, { type: 'QUIZ_TIME', quiz }).catch(() => {})
      }
    }
  } catch (_) {}

  const session = await getActiveSession()
  if (!session) return

  if (tabId === session.focusTabId) {
    console.log('[Grimoire] Back to focus tab')
    return
  }

  let tab
  try {
    tab = await chrome.tabs.get(tabId)
  } catch {
    return
  }

  const url = tab.url ?? ''
  const isSocial = isDistraction(url)
  const trigger  = isSocial ? 'social_media' : 'tab_switch'

  console.log('[Grimoire] Distraction:', trigger, url)

  await triggerMonsterAttack({ session, trigger })
})

// ─── Tab kapatılınca ──────────────────────────────────────────────────────

chrome.tabs.onRemoved.addListener(async (tabId) => {
  const session = await getActiveSession()
  if (!session) return

  if (tabId === session.focusTabId) {
    console.log('[Grimoire] Focus tab closed, ending session')
    await endSession()
  }
})

// ─── Helper: Scroll sayısına göre Depth hesabı ─────────────────────────────

function calculateDepthFromScrolls(scrollCount) {
  for (let i = DEPTH_THRESHOLDS.length - 1; i >= 0; i--) {
    if (scrollCount >= DEPTH_THRESHOLDS[i].minScrolls) {
      return DEPTH_THRESHOLDS[i].depth
    }
  }
  return 1
}

// ─── Canavar sistemi ──────────────────────────────────────────────────────

/**
 * Tetikleyiciye ve dungeon derinliğine göre uygun canavarı seç ve saldırt.
 */
async function triggerMonsterAttack({ session, trigger }) {
  const { character } = await getStorage([STORAGE_KEYS.CHARACTER])
  const currentXP = character?.xp ?? 0

  // Derinliğe ve trigger'a uyan canavarlar
  const candidates = MONSTERS.filter(
    m => m.trigger === trigger && m.depth.includes(session.depth ?? 1)
  )

  if (candidates.length === 0) {
    console.log('[Grimoire] No monster for this depth/trigger combo')
    return
  }

  const monster = candidates[Math.floor(Math.random() * candidates.length)]

  // XP düş
  const drainRaw = Math.floor(currentXP * monster.xpDrainPct)
  const xpLost = Math.min(
    monster.maxXPDrain,
    Math.max(monster.minXPDrain, drainRaw)
  )

  const updatedChar = await drainCharacterXP(xpLost)
  console.log(`[Grimoire] Monster ${monster.id} drained ${xpLost} XP`)

  // Fokus sekmesine saldırı mesajı gönder
  try {
    await chrome.tabs.sendMessage(session.focusTabId, {
      type: MSG.MONSTER_ATTACK,
      monster,
      xpLost,
      remainingXP: updatedChar.xp,
    })
  } catch (err) {
    console.log('[Grimoire] Could not send monster attack:', err.message)
  }
}

// ─── Idle takibi ─────────────────────────────────────────────────────────

// Her dakika alarm
chrome.alarms.create('idle-check', { periodInMinutes: 1 })

// Son aktivite zamanını takip et
let lastActivityTime = Date.now()

chrome.tabs.onActivated.addListener(() => {
  lastActivityTime = Date.now()
})

chrome.tabs.onUpdated.addListener(() => {
  lastActivityTime = Date.now()
})

chrome.alarms.onAlarm.addListener(async (alarm) => {

  // ▐ Memory Palace quiz teslimatı
  if (alarm.name.startsWith('quiz-')) {
    const quizId = alarm.name.replace('quiz-', '')
    const { quizQueue } = await getStorage([STORAGE_KEYS.QUIZ_QUEUE])
    const quiz = (quizQueue ?? []).find(q => q.id === quizId && !q.attempted)
    if (!quiz) return
    const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true })
    if (!activeTab) {
      await setStorage({ pendingQuizId: quizId })
      return
    }
    chrome.tabs.sendMessage(activeTab.id, { type: 'QUIZ_TIME', quiz }).catch(async () => {
      await setStorage({ pendingQuizId: quizId })
    })
    return
  }

  if (alarm.name === 'idle-check') {
    const session = await getActiveSession()
    if (!session) return

    const idleMs = Date.now() - lastActivityTime
    if (idleMs >= IDLE_THRESHOLD_MS) {
      console.log('[Grimoire] Long idle detected, triggering notification golem')
      await triggerMonsterAttack({ session, trigger: 'long_idle' })
      lastActivityTime = Date.now()  // reset — bir kez tetiklesin
    }
    return
  }

  // Haftalık boss kontrolü
  if (alarm.name === 'weekly-boss-check') {
    await checkWeeklyBoss()
    return
  }
})

// Haftalık boss alarm'ı kur (extension install/start'ta)
chrome.runtime.onInstalled.addListener(() => {
  chrome.alarms.create('weekly-boss-check', { periodInMinutes: 60 })
  console.log('[Grimoire] Weekly boss alarm set')
})

chrome.runtime.onStartup.addListener(() => {
  chrome.alarms.create('weekly-boss-check', { periodInMinutes: 60 })
})

async function checkWeeklyBoss() {
  const now = new Date()
  if (now.getDay() !== WEEKLY_BOSS.checkDay) return
  if (now.getHours() !== WEEKLY_BOSS.checkHour) return

  // Bu hafta boss zaten tetiklendi mi?
  const { bossLastTriggered } = await getStorage(['bossLastTriggered'])
  const oneWeekMs = 7 * 24 * 60 * 60 * 1000
  if (bossLastTriggered && Date.now() - bossLastTriggered < oneWeekMs) return

  // Bu haftaki scroll sayısı
  const { grimoire, character } = await getStorage([STORAGE_KEYS.GRIMOIRE, STORAGE_KEYS.CHARACTER])
  const weeklyScrolls = (grimoire ?? []).filter(
    e => e.savedAt > Date.now() - oneWeekMs
  ).length

  const bossHP  = WEEKLY_BOSS.calcHP(weeklyScrolls)
  const winXP   = WEEKLY_BOSS.winXP(weeklyScrolls)

  await setStorage({ bossLastTriggered: Date.now() })

  console.log('[Grimoire] Weekly boss triggered! HP:', bossHP, 'weeklyScrolls:', weeklyScrolls)

  // Aktif sekmeye boss mesajı gönder
  const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true })
  if (!activeTab) return

  try {
    await chrome.tabs.sendMessage(activeTab.id, {
      type: 'WEEKLY_BOSS',
      boss: { ...WEEKLY_BOSS, hp: bossHP },
      weeklyScrolls,
      winXP,
      character,
    })
  } catch (err) {
    console.log('[Grimoire] Could not send boss to tab:', err.message)
  }
}

