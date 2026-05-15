import { MSG, MAX_INPUT_CHARS, XP_CONFIG, DISTRACTION_DOMAINS } from '../shared/constants.js'
import { t } from '../shared/i18n.js'

let UI_LANG = 'tr'
chrome.storage.local.get(['settings'], ({ settings }) => {
  UI_LANG = settings?.appLanguage || 'tr'
})
chrome.storage.onChanged.addListener((changes) => {
  if (changes.settings?.newValue?.appLanguage) {
    UI_LANG = changes.settings.newValue.appLanguage
  }
})

console.log('[Grimoire] Content script loaded:', window.location.href)

// ─── Background'dan gelen mesajları dinle ─────────────────────────────────

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  console.log('[Grimoire CS] Message received:', msg.type)

  if (msg.type === MSG.MONSTER_ATTACK) {
    handleMonsterAttack(msg)
    sendResponse({ ok: true })
  }

  if (msg.type === 'WEEKLY_BOSS') {
    handleWeeklyBoss(msg)
    sendResponse({ ok: true })
  }

  if (msg.type === 'QUIZ_TIME') {
    handleMemoryPalaceQuiz(msg.quiz)
    sendResponse({ ok: true })
  }

  return true
})

// ─── Canavar saldırı UI ───────────────────────────────────────────────────

function handleMonsterAttack(msg) {
  // Mevcut saldırı varsa kaldır
  document.getElementById('gr-monster')?.remove()

  const { monster, xpLost, remainingXP } = msg

  const overlay = document.createElement('div')
  overlay.id = 'gr-monster'
  overlay.innerHTML = `
    <div class="gr-monster-inner">
      <div class="gr-monster-eyebrow">${UI_LANG === 'en' ? (monster.titleEn || monster.title) : monster.title}</div>
      <div class="gr-monster-name">${UI_LANG === 'en' ? (monster.nameEn || monster.name) : monster.name}</div>
      <div class="gr-monster-msg">${UI_LANG === 'en' ? (monster.messageEn || monster.message) : monster.message}</div>
      <div class="gr-monster-xp">
        <span class="gr-xp-lost">−${xpLost} XP</span>
        <span class="gr-xp-remaining">${UI_LANG === 'en' ? 'Remaining' : 'Kalan'}: ${remainingXP} XP</span>
      </div>
      <div class="gr-monster-hp-wrap">
        <div class="gr-monster-hp-bar" id="gr-hp-bar"></div>
      </div>
      <button class="gr-monster-dismiss" id="gr-monster-ok">
        ${t('content.gotIt', UI_LANG)}
      </button>
    </div>
  `

  document.body.appendChild(overlay)

  // HP bar dolum animasyonu
  requestAnimationFrame(() => {
    const bar = document.getElementById('gr-hp-bar')
    if (bar) bar.style.width = '100%'
  })

  // 10 saniye sonra otomatik kapat
  const timer = setTimeout(() => {
    overlay.classList.add('gr-monster-leaving')
    setTimeout(() => overlay.remove(), 300)
  }, 10000)

  document.getElementById('gr-monster-ok').addEventListener('click', () => {
    clearTimeout(timer)
    overlay.classList.add('gr-monster-leaving')
    setTimeout(() => overlay.remove(), 300)
  }, { once: true })
}

// ─── Haftalık boss UI ─────────────────────────────────────────────────────

function handleWeeklyBoss(msg) {
  const { boss, weeklyScrolls, winXP } = msg

  const overlay = document.createElement('div')
  overlay.id = 'gr-boss'
  overlay.innerHTML = `
    <div class="gr-boss-inner">
      <div class="gr-boss-label">${t('content.weeklyBoss', UI_LANG)}</div>
      <div class="gr-boss-name">${UI_LANG === 'en' ? (boss.nameEn || boss.name) : boss.name}</div>
      <div class="gr-boss-stats">
        ${UI_LANG === 'en' ? `You completed ${weeklyScrolls} scrolls this week.` : `Bu hafta ${weeklyScrolls} scroll tamamladın.`}
        <br/>Boss HP: ${boss.hp}/100
      </div>
      <div class="gr-boss-hp-track">
        <div class="gr-boss-hp-fill" style="width:${boss.hp}%"></div>
      </div>
      <div class="gr-boss-actions">
        <button class="gr-boss-fight" id="gr-boss-fight">${UI_LANG === 'en' ? `Fight (+${winXP} XP)` : `Savaş (+${winXP} XP)`}</button>
        <button class="gr-boss-flee" id="gr-boss-flee">${t('content.flee', UI_LANG)}</button>
      </div>
      <div class="gr-boss-result" id="gr-boss-result" style="display:none"></div>
    </div>
  `

  document.body.appendChild(overlay)

  document.getElementById('gr-boss-fight').addEventListener('click', async () => {
    // Scroll sayısına göre kazanma şansı
    const winChance = Math.min(0.9, weeklyScrolls * 0.08 + 0.2)
    const won = Math.random() < winChance

    document.getElementById('gr-boss-fight').disabled = true
    document.getElementById('gr-boss-flee').disabled  = true

    const resultEl = document.getElementById('gr-boss-result')
    resultEl.style.display = 'block'

    if (won) {
      resultEl.innerHTML = `
        <div class="gr-boss-win">
          ${UI_LANG === 'en' ? `Victory! +${winXP} XP gained.` : `Zafer! +${winXP} XP kazandın.`}<br>
          <small>${UI_LANG === 'en' ? 'Weekly boss defeated.' : 'Haftalık boss yenildi.'}</small>
        </div>
      `
      await chrome.runtime.sendMessage({
        type: 'BOSS_RESULT',
        won: true,
        xpChange: winXP,
      })
    } else {
      resultEl.innerHTML = `
        <div class="gr-boss-loss">
          ${UI_LANG === 'en' ? 'Defeat. 20% of your XP was wiped.' : "Yenildin. XP'nin %20'si silindi."}<br>
          <small>${UI_LANG === 'en' ? 'Be stronger next week.' : 'Gelecek hafta daha güçlü ol.'}</small>
        </div>
      `
      await chrome.runtime.sendMessage({
        type: 'BOSS_RESULT',
        won: false,
        xpChange: 0,
      })
    }

    setTimeout(() => {
      overlay.classList.add('gr-monster-leaving')
      setTimeout(() => overlay.remove(), 300)
    }, 3000)
  })

  document.getElementById('gr-boss-flee').addEventListener('click', () => {
    overlay.classList.add('gr-monster-leaving')
    setTimeout(() => overlay.remove(), 300)
  })
}

// ─── Sayfa metnini çek ────────────────────────────────────────────────────

function extractPageText() {
  const selectors = [
    'article',
    'main',
    '[role="main"]',
    '.post-content',
    '.article-content',
    '.entry-content',
    '#content',
  ]

  let root = null
  for (const sel of selectors) {
    root = document.querySelector(sel)
    if (root) break
  }
  root = root ?? document.body

  const clone = root.cloneNode(true)
  const noiseSelectors = [
    'script', 'style', 'nav', 'footer', 'header',
    'aside', '.sidebar', '.ad', '.advertisement',
    '.cookie-banner', '.popup', '[aria-hidden="true"]',
  ]
  noiseSelectors.forEach(sel => {
    clone.querySelectorAll(sel).forEach(el => el.remove())
  })

  const text = (clone.innerText ?? clone.textContent ?? '')
    .replace(/\s+/g, ' ')
    .trim()

  // Dinamik makale uzunluğu: Maksimum ~100 sayfa (150.000 karakter)
  return text.slice(0, 150000)
}

// ─── Sidebar DOM ──────────────────────────────────────────────────────────

function getSidebar() {
  return document.getElementById('gr-sidebar')
}

function createSidebar() {
  if (getSidebar()) return

  const sidebar = document.createElement('div')
  sidebar.id = 'gr-sidebar'
  sidebar.innerHTML = `
    <div class="gr-sidebar-header">
      <span class="gr-sidebar-title">GRIMOIRE</span>
      <div class="gr-sidebar-header-actions">
        <button class="gr-tab-btn gr-tab-active" id="gr-tab-lore" title="${UI_LANG === 'en' ? 'Lore' : 'Lore'}">📖</button>
        <button class="gr-tab-btn" id="gr-tab-note" title="${t('content.noteTitle', UI_LANG)}">📝</button>
        <button class="gr-sidebar-close" id="gr-close" title="Kapat">×</button>
      </div>
    </div>
    <div class="gr-sidebar-body" id="gr-body">
      <div class="gr-loading" id="gr-loading">
        <div class="gr-loading-dot"></div>
        <div class="gr-loading-dot"></div>
        <div class="gr-loading-dot"></div>
      </div>
      <div class="gr-lore-text" id="gr-lore" style="display:none"></div>
      <div class="gr-error" id="gr-error" style="display:none"></div>
      <div class="gr-note-panel" id="gr-note-panel" style="display:none">
        <div class="gr-note-label">${t('content.noteTitle', UI_LANG)}</div>
        <textarea class="gr-note-textarea" id="gr-note-textarea" placeholder="${t('content.notePlaceholder', UI_LANG)}"></textarea>
        <div class="gr-note-actions">
          <button class="gr-note-save-btn" id="gr-note-save">${t('content.noteSave', UI_LANG)}</button>
        </div>
      </div>
    </div>
    <div class="gr-sidebar-footer" id="gr-footer" style="display:none">
      <div style="display:flex; gap:8px; margin-bottom:8px;">
        <button class="gr-save-btn" id="gr-save" style="flex:1">${t('content.saveGrimoire', UI_LANG)}</button>
        <button id="gr-mode-toggle" style="flex:1; background:rgba(83,74,183,.2); border:1px solid rgba(83,74,183,.4); color:#afa9ec; border-radius:7px; font-size:12px; font-weight:500; cursor:pointer;" title="${t('content.toggleTitle', UI_LANG)}">
          ${t('content.switchToFormal', UI_LANG)}
        </button>
      </div>
      <div class="gr-xp-preview" id="gr-xp-preview"></div>
    </div>
  `

  document.body.appendChild(sidebar)

  document.getElementById('gr-close').addEventListener('click', () => {
    sidebar.classList.add('gr-sidebar-closing')
    setTimeout(() => sidebar.remove(), 250)
  })

  // Sekme geçişi: Lore ↔ Not
  document.getElementById('gr-tab-lore').addEventListener('click', () => switchSidebarTab('lore'))
  document.getElementById('gr-tab-note').addEventListener('click', () => switchSidebarTab('note'))

  // Not kaydet
  document.getElementById('gr-note-save').addEventListener('click', savePageNote)

  // Mevcut notu yükle
  loadPageNote()
}

function switchSidebarTab(tab) {
  const loreBtn  = document.getElementById('gr-tab-lore')
  const noteBtn  = document.getElementById('gr-tab-note')
  const footer   = document.getElementById('gr-footer')
  const notePanel = document.getElementById('gr-note-panel')
  const loading  = document.getElementById('gr-loading')
  const loreEl   = document.getElementById('gr-lore')
  const errorEl  = document.getElementById('gr-error')

  if (tab === 'lore') {
    loreBtn.classList.add('gr-tab-active')
    noteBtn.classList.remove('gr-tab-active')
    notePanel.style.display = 'none'
    // Lore elementlerini tekrar göster
    if (loreEl && loreEl.innerHTML) loreEl.style.display = 'block'
    else if (loading) loading.style.display = 'flex'
    if (errorEl && errorEl.textContent) errorEl.style.display = 'block'
    if (footer && window.grLorePages?.some(Boolean)) footer.style.display = 'block'
  } else {
    noteBtn.classList.add('gr-tab-active')
    loreBtn.classList.remove('gr-tab-active')
    if (loading) loading.style.display = 'none'
    if (loreEl) loreEl.style.display = 'none'
    if (errorEl) errorEl.style.display = 'none'
    if (footer) footer.style.display = 'none'
    notePanel.style.display = 'flex'
  }
}

async function loadPageNote() {
  const res = await chrome.runtime.sendMessage({
    type: MSG.GET_NOTE,
    url: window.location.href,
  }).catch(() => null)

  const textarea = document.getElementById('gr-note-textarea')
  if (textarea && res?.note?.text) {
    textarea.value = res.note.text
  }
}

async function savePageNote() {
  const textarea = document.getElementById('gr-note-textarea')
  const saveBtn  = document.getElementById('gr-note-save')
  if (!textarea || !saveBtn) return

  saveBtn.textContent = '...'
  saveBtn.disabled = true

  await chrome.runtime.sendMessage({
    type: MSG.SAVE_NOTE,
    url:  window.location.href,
    text: textarea.value,
  }).catch(() => null)

  saveBtn.textContent = t('content.noteSaved', UI_LANG)
  setTimeout(() => {
    saveBtn.textContent = t('content.noteSave', UI_LANG)
    saveBtn.disabled = false
  }, 1500)
}

function showLoading() {
  document.getElementById('gr-loading').style.display = 'flex'
  document.getElementById('gr-lore').style.display   = 'none'
  document.getElementById('gr-error').style.display  = 'none'
  document.getElementById('gr-footer').style.display = 'none'
}

function showLore(loreText, xpPreview) {
  document.getElementById('gr-loading').style.display = 'none'
  document.getElementById('gr-error').style.display   = 'none'

  const loreEl = document.getElementById('gr-lore')
  loreEl.style.display = 'block'

  const paragraphs = loreText.split('\n\n').filter(Boolean)
  loreEl.innerHTML = paragraphs
    .map(p => `<p>${p.trim()}</p>`)
    .join('')

  document.getElementById('gr-footer').style.display = 'block'
  document.getElementById('gr-xp-preview').textContent = `+${xpPreview} ${t('content.xpPreview', UI_LANG)}`
}

function showError(message) {
  document.getElementById('gr-loading').style.display = 'none'
  document.getElementById('gr-lore').style.display    = 'none'

  const errEl = document.getElementById('gr-error')
  errEl.style.display = 'block'
  errEl.textContent = message
}

// ─── XP hesapla (scroll derinliğine göre) ────────────────────────────────

function calculateXPPreview() {
  const scrollable = document.body.scrollHeight - window.innerHeight
  const scrollPct = scrollable > 0
    ? Math.min(100, (window.scrollY / scrollable) * 100)
    : 50

  return Math.floor(100 + scrollPct * 3)
}

// ─── Ana dönüşüm akışı ────────────────────────────────────────────────────

let currentPageTitle = null
let pageOpenedAt = Date.now()

async function transformCurrentPage() {
  const url = window.location.href
  if (
    url.startsWith('chrome://') ||
    url.startsWith('chrome-extension://') ||
    url.startsWith('about:') ||
    url.startsWith('data:')
  ) return

  const isDistraction = DISTRACTION_DOMAINS.some(d => url.includes(d))
  if (isDistraction) return

  const { session, settings } = await chrome.storage.local.get(['session', 'settings'])
  if (!session?.isActive) return

  UI_LANG = settings?.appLanguage || 'tr'
  window.grCurrentMode = session.mode || 'lore'
  currentPageTitle = document.title.slice(0, 80)
  createSidebar()

  // 1. Önbellek (Caching) Kontrolü
  const { grimoire } = await chrome.storage.local.get(['grimoire'])
  const savedEntry = (grimoire ?? []).find(e => e.url === url)

  if (savedEntry) {
    showLore(savedEntry.loreText, 0)
    
    // Değiştir butonu
    const saveBtn = document.getElementById('gr-save')
    if (saveBtn) {
      saveBtn.textContent = t('content.alreadySaved', UI_LANG)
      saveBtn.disabled = true
      saveBtn.style.opacity = '0.5'
    }
    document.getElementById('gr-pagination')?.remove()
    return
  }

  // 2. Parçalama (Pagination)
  const text = extractPageText()
  if (text.length < 150) {
    console.log('[Grimoire] Not enough text on page.')
    return
  }

  const chunkSize = MAX_INPUT_CHARS // 1500 limit
  const chunks = []
  for (let i = 0; i < text.length; i += chunkSize) {
    chunks.push(text.slice(i, i + chunkSize))
  }

  window.grChunks = chunks
  window.grCurrentPage = 0
  window.grLorePages = []

  // Hook save
  const saveBtn = document.getElementById('gr-save')
  if (saveBtn) {
    saveBtn.textContent = t('content.saveGrimoire', UI_LANG)
    saveBtn.disabled = false
    saveBtn.style.opacity = '1'
    
    // Yalnızca eski event listener'ı temizlemek için klonla
    const newBtn = saveBtn.cloneNode(true)
    saveBtn.parentNode.replaceChild(newBtn, saveBtn)
    newBtn.addEventListener('click', saveCurrentPage)
  }

  const modeBtn = document.getElementById('gr-mode-toggle')
  if (modeBtn) {
    modeBtn.textContent = window.grCurrentMode === 'formal_summary' ? t('content.switchToLore', UI_LANG) : t('content.switchToFormal', UI_LANG)
    const newModeBtn = modeBtn.cloneNode(true)
    modeBtn.parentNode.replaceChild(newModeBtn, modeBtn)
    newModeBtn.addEventListener('click', async () => {
      window.grCurrentMode = window.grCurrentMode === 'formal_summary' ? 'lore' : 'formal_summary'
      newModeBtn.textContent = window.grCurrentMode === 'formal_summary' ? t('content.switchToLore', UI_LANG) : t('content.switchToFormal', UI_LANG)
      
      window.grLorePages = []
      document.getElementById('gr-lore').innerHTML = ''
      await transformChunk(window.grCurrentPage)
    })
  }

  await transformChunk(0)
}

async function transformChunk(pageIndex) {
  showLoading()
  document.getElementById('gr-pagination')?.remove()

  const text = window.grChunks[pageIndex]

  const res = await chrome.runtime.sendMessage({
    type: MSG.TRANSFORM_TO_LORE,
    text,
    overrideStyle: window.grCurrentMode === 'formal_summary' ? 'formal_summary' : null
  }).catch(() => null) // Catch any promise rejection from sendMessage

  if (!res || !res.ok) {
    showError(`${t('content.spellFailed', UI_LANG)} ${res?.error || chrome.runtime.lastError?.message || 'Bilinmeyen Hata'}`)
    return
  }

  window.grLorePages[pageIndex] = res.loreText
  renderCurrentPage()
}

function updatePaginationUI() {
  const footer = document.getElementById('gr-footer')
  if (!footer) return

  let pagWrap = document.getElementById('gr-pagination')
  if (!pagWrap) {
    pagWrap = document.createElement('div')
    pagWrap.id = 'gr-pagination'
    pagWrap.style.display = 'flex'
    pagWrap.style.justifyContent = 'space-between'
    pagWrap.style.alignItems = 'center'
    pagWrap.style.marginBottom = '12px'
    pagWrap.style.fontSize = '12px'
    pagWrap.style.color = '#afa9ec'
    footer.insertBefore(pagWrap, footer.firstChild)
  }

  const totalPages = window.grChunks.length
  const current = window.grCurrentPage + 1

  pagWrap.innerHTML = `
    <button id="gr-prev" style="background:none; border:1px solid rgba(175,169,236,.3); color:#afa9ec; padding:4px 8px; border-radius:4px; font-size:11px; cursor:${current <= 1 ? 'default' : 'pointer'}; opacity:${current <= 1 ? .3 : 1}">${t('content.prev', UI_LANG)}</button>
    <span style="font-style:italic">${t('content.chunk', UI_LANG)} ${current} / ${totalPages}</span>
    <button id="gr-next" style="background:none; border:1px solid rgba(175,169,236,.3); color:#afa9ec; padding:4px 8px; border-radius:4px; font-size:11px; cursor:${current >= totalPages ? 'default' : 'pointer'}; opacity:${current >= totalPages ? .3 : 1}">${t('content.next', UI_LANG)}</button>
  `

  document.getElementById('gr-prev').onclick = () => {
    if (window.grCurrentPage > 0) {
      window.grCurrentPage--
      renderCurrentPage()
    }
  }

  document.getElementById('gr-next').onclick = async () => {
    if (window.grCurrentPage < totalPages - 1) {
      window.grCurrentPage++
      if (!window.grLorePages[window.grCurrentPage]) {
        await transformChunk(window.grCurrentPage)
      } else {
        renderCurrentPage()
      }
    }
  }
}

function renderCurrentPage() {
  const loreText = window.grLorePages[window.grCurrentPage]
  
  const baseXPPreview = calculateXPPreview()
  const pageMultiplierXP = window.grLorePages.filter(Boolean).length * 10
  const totalPreviewXP = baseXPPreview + pageMultiplierXP
  
  showLore(loreText, totalPreviewXP)
  
  if (window.grChunks && window.grChunks.length > 1) {
    updatePaginationUI()
  }
}

// ─── Alt+G shortcut → sidebar aç (session olmasa da not sekmesi) ─────────

window.addEventListener('gr-open-sidebar', () => {
  if (getSidebar()) return
  createSidebar()
  // Session yoksa not sekmesini öne çıkar
  chrome.storage.local.get(['session'], ({ session }) => {
    if (!session?.isActive) switchSidebarTab('note')
  })
})

// ─── Seans durumunu kontrol et, aktifse dönüştür ─────────────────────────

// 1. Sayfa yüklendiğinde
chrome.storage.local.get(['session'], ({ session }) => {
  if (session?.isActive) setTimeout(transformCurrentPage, 800)
})

// 2. Popup aç/kapa
chrome.storage.onChanged.addListener((changes) => {
  if (changes.session && changes.session.newValue?.isActive && !changes.session.oldValue?.isActive) {
    setTimeout(transformCurrentPage, 800)
  }
})

// ─── Sayfayı kaydet ───────────────────────────────────────────────────────

async function saveCurrentPage() {
  const saveBtn = document.getElementById('gr-save')
  if (!saveBtn) return

  saveBtn.textContent = t('content.saving', UI_LANG)
  saveBtn.disabled = true

  // Tüm dönüştürülmüş chunk'ları birleştir
  const totalLoreText = (window.grLorePages || []).filter(Boolean).join('\n\n---\n\n')

  const scrollable = document.body.scrollHeight - window.innerHeight
  const scrollPct  = scrollable > 0 ? Math.min(100, (window.scrollY / scrollable) * 100) : 50
  const readSecs   = Math.floor((Date.now() - pageOpenedAt) / 1000)

  const pagesRead = (window.grLorePages || []).filter(Boolean).length
  
  let xp = XP_CONFIG.BASE_XP + Math.floor(scrollPct * XP_CONFIG.SCROLL_MULTIPLIER) + (pagesRead * 10)
  if (readSecs >= 300) xp += XP_CONFIG.LONG_READ_BONUS
  if (scrollPct >= 80) xp += XP_CONFIG.DEEP_SCROLL_BONUS
  xp = Math.min(xp, XP_CONFIG.MAX_XP_PER_SAVE * 2)

  const { character, settings } = await chrome.storage.local.get(['character', 'settings'])
  const entry = {
    id:          crypto.randomUUID(),
    title:       currentPageTitle || document.title.slice(0, 80),
    url:         window.location.href,
    loreText:    totalLoreText,
    xpEarned:    xp,
    savedAt:     Date.now(),
    scrollPct:   Math.floor(scrollPct),
    readSecs,
    prevLevel:   character?.level ?? 1,
    loreStyle:   settings?.loreStyle || 'fantasy',
    tags:        [],
    comment:     '',
    isHighlight: false,
  }

  const res = await chrome.runtime.sendMessage({
    type: MSG.SAVE_SCROLL,
    entry,
  })

  if (!res.ok) {
    if (res.reason === 'duplicate') saveBtn.textContent = t('content.alreadySaved', UI_LANG)
    else saveBtn.textContent = `${t('content.saveError', UI_LANG)} ${res.error ?? 'bilinmiyor'}`
    return
  }

  saveBtn.textContent = `+${xp} XP`
  document.getElementById('gr-xp-preview').textContent = ''

  if (res.leveledUp) {
    showLevelUpBanner(res.character.level)
  }
}

// ─── Level atlama banner'ı ────────────────────────────────────────────────

function showLevelUpBanner(newLevel) {
  const banner = document.createElement('div')
  banner.style.cssText = `
    position: fixed;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    background: #0f0e17;
    border: 2px solid #7f77dd;
    border-radius: 12px;
    padding: 24px 32px;
    z-index: 2147483647;
    text-align: center;
    font-family: Georgia, serif;
    color: #e8e6d9;
    animation: gr-level-pop .4s ease;
  `
  const levelLabel  = UI_LANG === 'en' ? `Level ${newLevel}` : `Seviye ${newLevel}`
  const subLabel    = UI_LANG === 'en' ? 'A new floor has opened.' : 'Yeni bir kat açıldı.'
  banner.innerHTML = `
    <div style="font-size:13px;color:#afa9ec;letter-spacing:.1em;margin-bottom:8px">GRIMOIRE</div>
    <div style="font-size:28px;font-weight:500;color:#7f77dd;margin-bottom:4px">${levelLabel}</div>
    <div style="font-size:14px;color:#888780">${subLabel}</div>
  `
  document.body.appendChild(banner)
  setTimeout(() => banner.remove(), 3000)
}

// ─── Highlight & Save ────────────────────────────────────────────────────

let grHighlightBtn = null

document.addEventListener('mouseup', (e) => {
  // Sidebar içindeki seçimleri yoksay
  if (document.getElementById('gr-sidebar')?.contains(e.target)) return

  const selection = window.getSelection()
  const text = selection?.toString().trim()

  if (!text || text.length < 30) {
    grHighlightBtn?.remove()
    grHighlightBtn = null
    return
  }

  // Buton zaten varsa kaldır
  grHighlightBtn?.remove()

  const range = selection.getRangeAt(0)
  const rect  = range.getBoundingClientRect()

  const popupTop  = Math.max(8, rect.bottom + 8)
  const popupLeft = Math.min(window.innerWidth - 280, Math.max(8, rect.left + rect.width / 2 - 140))

  const popup = document.createElement('div')
  popup.id = 'gr-highlight-btn'
  popup.innerHTML = `
    <div class="gr-hl-popup">
      <div class="gr-hl-popup-preview">${text.slice(0, 120)}${text.length > 120 ? '…' : ''}</div>
      <textarea
        class="gr-hl-comment"
        id="gr-hl-comment"
        placeholder="${UI_LANG === 'en' ? 'Add your comment (optional)…' : 'Yorumunu ekle (opsiyonel)…'}"
        rows="2"
      ></textarea>
      <button class="gr-hl-action" id="gr-hl-transform">
        ✨ ${t('content.highlightTransform', UI_LANG)}
      </button>
    </div>
  `
  popup.style.cssText = `
    position: fixed;
    top: ${popupTop}px;
    left: ${popupLeft}px;
    z-index: 2147483646;
    animation: gr-hl-pop .15s ease;
  `

  document.body.appendChild(popup)
  grHighlightBtn = popup
  setTimeout(() => popup.querySelector('#gr-hl-comment')?.focus(), 50)

  popup.querySelector('#gr-hl-transform').addEventListener('click', async () => {
    const selectedText = text
    const comment      = popup.querySelector('#gr-hl-comment')?.value.trim() || ''
    const pageTitle    = document.title.slice(0, 80)
    const transformBtn = popup.querySelector('#gr-hl-transform')
    transformBtn.textContent = t('content.highlightSaving', UI_LANG)
    transformBtn.disabled = true

    const combinedText = comment
      ? `${selectedText}\n\n[${UI_LANG === 'en' ? 'My note' : 'Benim notum'}: ${comment}]`
      : selectedText

    const res = await chrome.runtime.sendMessage({
      type:    MSG.TRANSFORM_HIGHLIGHT,
      text:    combinedText,
      url:     window.location.href,
      title:   `${pageTitle} — ${UI_LANG === 'en' ? 'highlight' : 'seçili metin'}`,
      comment,
    }).catch(() => null)

    popup.remove()
    grHighlightBtn = null
    selection.removeAllRanges()

    if (!res?.ok) {
      showHighlightToast(UI_LANG === 'en' ? 'Transform failed.' : 'Dönüşüm başarısız.', true)
      return
    }

    showHighlightResult(res.loreText, res.leveledUp ? res.character?.level : null)
  })
})

document.addEventListener('mousedown', (e) => {
  if (!grHighlightBtn) return
  if (!grHighlightBtn.contains(e.target)) {
    grHighlightBtn.remove()
    grHighlightBtn = null
  }
})

function showHighlightToast(message, isError = false) {
  document.getElementById('gr-hl-toast')?.remove()
  const toast = document.createElement('div')
  toast.id = 'gr-hl-toast'
  toast.textContent = message
  toast.style.cssText = `
    position: fixed;
    bottom: 32px;
    left: 50%;
    transform: translateX(-50%);
    background: ${isError ? '#e24b4a' : '#534ab7'};
    color: #fff;
    padding: 10px 20px;
    border-radius: 8px;
    font-family: -apple-system, sans-serif;
    font-size: 13px;
    z-index: 2147483647;
    animation: gr-hl-pop .2s ease;
  `
  document.body.appendChild(toast)
  setTimeout(() => toast.remove(), 3000)
}

function showHighlightResult(loreText, newLevel) {
  document.getElementById('gr-hl-result')?.remove()

  const panel = document.createElement('div')
  panel.id = 'gr-hl-result'
  panel.innerHTML = `
    <div class="gr-hl-result-inner">
      <div class="gr-hl-result-eyebrow">✨ ${UI_LANG === 'en' ? 'Highlight saved to Grimoire (+50 XP)' : 'Seçili metin Grimoire\'a kaydedildi (+50 XP)'}</div>
      ${newLevel ? `<div class="gr-hl-result-levelup">${UI_LANG === 'en' ? `Level ${newLevel}!` : `Seviye ${newLevel}!`}</div>` : ''}
      <div class="gr-hl-result-text">${loreText.slice(0, 300)}${loreText.length > 300 ? '…' : ''}</div>
      <button class="gr-hl-result-close" id="gr-hl-result-close">×</button>
    </div>
  `
  document.body.appendChild(panel)
  document.getElementById('gr-hl-result-close').addEventListener('click', () => panel.remove())
  setTimeout(() => panel.remove(), 8000)
}

// ─── Memory Palace Quiz UI ────────────────────────────────────────────────

function handleMemoryPalaceQuiz(quiz) {
  document.getElementById('gr-quiz')?.remove()

  const { questions, articleTitle, id: quizId } = quiz

  // 3 sorudan rastgele 1 seç
  const q = questions[Math.floor(Math.random() * questions.length)]
  if (!q) return

  const palaceLabel = t('quiz.palace', UI_LANG)
  const skipLabel   = t('quiz.skip',   UI_LANG)

  const overlay = document.createElement('div')
  overlay.id = 'gr-quiz'
  overlay.innerHTML = `
    <div class="gr-quiz-inner">
      <div class="gr-quiz-eyebrow">🏛️ ${palaceLabel}</div>
      <div class="gr-quiz-source">"${articleTitle}"</div>
      <div class="gr-quiz-question">${q.q}</div>
      <div class="gr-quiz-options" id="gr-quiz-opts">
        ${q.options.map((opt, i) => `
          <button class="gr-quiz-opt" data-idx="${i}">${opt}</button>
        `).join('')}
      </div>
      <div class="gr-quiz-result" id="gr-quiz-result" style="display:none"></div>
      <button class="gr-quiz-skip" id="gr-quiz-skip">${skipLabel}</button>
    </div>
  `

  document.body.appendChild(overlay)

  // Cevap seçme
  overlay.querySelectorAll('.gr-quiz-opt').forEach(btn => {
    btn.addEventListener('click', async () => {
      const chosen  = parseInt(btn.dataset.idx)
      const correct = chosen === q.correct

      overlay.querySelectorAll('.gr-quiz-opt').forEach(b => { b.disabled = true })
      btn.classList.add(correct ? 'gr-quiz-correct' : 'gr-quiz-wrong')
      if (!correct) {
        overlay.querySelector(`[data-idx="${q.correct}"]`)?.classList.add('gr-quiz-correct')
      }

      const resultEl = overlay.querySelector('#gr-quiz-result')
      resultEl.style.display = 'block'
      resultEl.innerHTML = correct
        ? `<span class="gr-quiz-win">+75 XP — ${t('quiz.correct', UI_LANG)}</span>
           <br><small style="color:#888780;font-size:11px">${q.explanation}</small>`
        : `<span class="gr-quiz-loss">${t('quiz.wrong', UI_LANG)}</span>
           <br><small style="color:#888780;font-size:11px">${q.explanation}</small>`

      // Servise gönder
      chrome.runtime.sendMessage({ type: 'QUIZ_RESULT', quizId, correct })

      // Kapat
      setTimeout(() => {
        overlay.classList.add('gr-monster-leaving')
        setTimeout(() => overlay.remove(), 300)
      }, 3500)
    })
  })

  // Geç
  overlay.querySelector('#gr-quiz-skip').addEventListener('click', () => {
    overlay.classList.add('gr-monster-leaving')
    setTimeout(() => overlay.remove(), 300)
  })
}
