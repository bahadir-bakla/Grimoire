import { STORAGE_KEYS } from './constants.js'

export const STORAGE_DEFAULTS = {
  [STORAGE_KEYS.SESSION]:    null,
  [STORAGE_KEYS.CHARACTER]:  {
    level: 1,
    xp: 0,
    xpToNext: 500,
  },
  [STORAGE_KEYS.GRIMOIRE]:   [],
  [STORAGE_KEYS.SETTINGS]:   {
    loreStyle: 'fantasy',
    monsterDifficulty: 'normal',
    aiProvider: 'chrome',
    apiKey: '',
    appLanguage: 'tr',
    customModel: ''
  },
  [STORAGE_KEYS.WORLD]:      { entries: [], chronicle: '', lastChronicleUpdate: null },
  [STORAGE_KEYS.QUIZ_QUEUE]: [],
}

export async function getStorage(keys = null) {
  const k = keys ?? Object.keys(STORAGE_DEFAULTS)
  return chrome.storage.local.get(k)
}

export async function setStorage(data) {
  return chrome.storage.local.set(data)
}

export async function resetStorage() {
  await chrome.storage.local.clear()
  await setStorage(STORAGE_DEFAULTS)
  console.log('[Grimoire] Storage reset')
}

/**
 * Karaktere XP ekle, gerekirse level atla.
 * @param {number} xpDelta - eklenecek XP miktarı
 * @returns {object} güncellenmiş character objesi
 */
export async function updateCharacter(xpDelta) {
  const { character } = await getStorage([STORAGE_KEYS.CHARACTER])
  const char = { ...character }

  // NaN koruması ve fallbackler
  char.xp = isNaN(char.xp) || char.xp === null ? 0 : Number(char.xp)
  if (isNaN(char.xpToNext) || char.xpToNext <= 0) char.xpToNext = 500
  if (isNaN(char.level) || char.level <= 0) char.level = 1

  const safeDelta = isNaN(xpDelta) || xpDelta === null ? 0 : Number(xpDelta)
  char.xp += safeDelta

  // Level atlama döngüsü
  while (char.xp >= char.xpToNext) {
    char.xp -= char.xpToNext
    char.level += 1
    char.xpToNext = Math.floor(char.xpToNext * 1.45)
    console.log(`[Grimoire] Level up! Now level ${char.level}`)
  }

  await setStorage({ [STORAGE_KEYS.CHARACTER]: char })
  return char
}

/**
 * Karakterden XP düş (negatife düşürme).
 * @param {number} xpDelta - düşülecek XP miktarı
 * @returns {object} güncellenmiş character objesi
 */
export async function drainCharacterXP(xpDelta) {
  const { character } = await getStorage([STORAGE_KEYS.CHARACTER])
  const char = { ...character }
  
  char.xp = isNaN(char.xp) || char.xp === null ? 0 : Number(char.xp)
  const safeDelta = isNaN(xpDelta) || xpDelta === null ? 0 : Number(xpDelta)

  char.xp = Math.max(0, char.xp - safeDelta)
  await setStorage({ [STORAGE_KEYS.CHARACTER]: char })
  return char
}

/**
 * Grimoire'a yeni kayıt ekle.
 * @param {object} entry - { id, title, url, loreText, xpEarned, savedAt }
 * @returns {object[]} güncellenmiş grimoire array
 */
export async function addToGrimoire(entry) {
  const { grimoire } = await getStorage([STORAGE_KEYS.GRIMOIRE])
  const current = grimoire ?? []

  // Aynı URL'den zaten kayıt var mı?
  const duplicate = current.find(e => e.url === entry.url)
  if (duplicate) {
    console.log('[Grimoire] Duplicate URL, skipping save:', entry.url)
    return { saved: false, reason: 'duplicate', grimoire: current }
  }

  // Başa ekle (en yeni üstte)
  const updated = [entry, ...current]

  // Storage quota kontrolü (~5MB limit)
  const totalChars = JSON.stringify(updated).length
  if (totalChars > 4500000) {
    // En eski 30 kaydı sil
    console.warn('[Grimoire] Storage near limit, trimming old entries')
    updated.splice(updated.length - 30, 30)
  }

  // Max 200 kayıt — en eski 20'yi sil
  const trimmed = updated.length > 200
    ? updated.slice(0, 180)
    : updated

  await setStorage({ [STORAGE_KEYS.GRIMOIRE]: trimmed })
  return { saved: true, grimoire: trimmed }
}

/**
 * Grimoire'dan kayıt sil.
 * @param {string} id
 */
export async function removeFromGrimoire(id) {
  const { grimoire } = await getStorage([STORAGE_KEYS.GRIMOIRE])
  const updated = (grimoire ?? []).filter(e => e.id !== id)
  await setStorage({ [STORAGE_KEYS.GRIMOIRE]: updated })
  return updated
}
