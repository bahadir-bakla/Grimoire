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

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  console.log('[Grimoire CS] Message received:', msg.type)

  if (msg.type === MSG.MONSTER_ATTACK) {
    handleMonsterAttack(msg)
    sendResponse({ ok: true })
  }

  if (msg.type === 'WEEKLY_BOSS') {
    handleWeeklyBoss(msg)
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

  document.getElementById('gr-monster-ok').addEventListener('click', () => {
    overlay.classList.add('gr-monster-leaving')
    setTimeout(() => overlay.remove(), 300)
  })

  // 10 saniye sonra otomatik kapat
  const timer = setTimeout(() => {
    overlay.classList.add('gr-monster-leaving')
    setTimeout(() => overlay.remove(), 300)
  }, 10000)

  document.getElementById('gr-monster-ok').addEventListener('click', () => {
    clearTimeout(timer)
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
      <button class="gr-sidebar-close" id="gr-close" title="Kapat">×</button>
    </div>
    <div class="gr-sidebar-body" id="gr-body">
      <div class="gr-loading" id="gr-loading">
        <div class="gr-loading-dot"></div>
        <div class="gr-loading-dot"></div>
        <div class="gr-loading-dot"></div>
      </div>
      <div class="gr-lore-text" id="gr-lore" style="display:none"></div>
      <div class="gr-error" id="gr-error" style="display:none"></div>
    </div>
    <div class="gr-sidebar-footer" id="gr-footer" style="display:none">
      <div style="display:flex; gap:8px; margin-bottom:8px;">
        <button class="gr-save-btn" id="gr-save" style="flex:1">${t('content.saveGrimoire', UI_LANG)}</button>
        <button id="gr-mode-toggle" style="flex:1; background:rgba(83,74,183,.2); border:1px solid rgba(83,74,183,.4); color:#afa9ec; border-radius:7px; font-size:12px; font-weight:500; cursor:pointer;" title="Hikaye ve Resmi Özet arasında geçiş yap">
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
  document.getElementById('gr-xp-preview').textContent = `+${xpPreview} XP kazanacaksın`
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

  const { session } = await chrome.storage.local.get(['session'])
  if (!session?.isActive) return

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
  })

  if (!res.ok) {
    showError(`${t('content.spellFailed', UI_LANG)} ${res.error}`)
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
  const totalLoreText = (window.grLorePages || []).filter(Boolean).join('\\n\\n---\\n\\n')

  const scrollable = document.body.scrollHeight - window.innerHeight
  const scrollPct  = scrollable > 0 ? Math.min(100, (window.scrollY / scrollable) * 100) : 50
  const readSecs   = Math.floor((Date.now() - pageOpenedAt) / 1000)

  const pagesRead = (window.grLorePages || []).filter(Boolean).length
  
  let xp = XP_CONFIG.BASE_XP + Math.floor(scrollPct * XP_CONFIG.SCROLL_MULTIPLIER) + (pagesRead * 10)
  if (readSecs >= 300) xp += XP_CONFIG.LONG_READ_BONUS
  if (scrollPct >= 80) xp += XP_CONFIG.DEEP_SCROLL_BONUS
  xp = Math.min(xp, XP_CONFIG.MAX_XP_PER_SAVE * 2)

  const { character } = await chrome.storage.local.get(['character'])
  const entry = {
    id:        crypto.randomUUID(),
    title:     currentPageTitle || document.title.slice(0, 80),
    url:       window.location.href,
    loreText:  totalLoreText,
    xpEarned:  xp,
    savedAt:   Date.now(),
    scrollPct: Math.floor(scrollPct),
    readSecs,
    prevLevel: character?.level ?? 1,
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
  banner.innerHTML = `
    <div style="font-size:13px;color:#afa9ec;letter-spacing:.1em;margin-bottom:8px">GRİMOİR</div>
    <div style="font-size:28px;font-weight:500;color:#7f77dd;margin-bottom:4px">Seviye ${newLevel}</div>
    <div style="font-size:14px;color:#888780">Yeni bir kat açıldı.</div>
  `
  document.body.appendChild(banner)
  setTimeout(() => banner.remove(), 3000)
}
