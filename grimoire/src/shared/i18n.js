export const t = (key, lang = 'tr') => {
  const keys = key.split('.')
  let res = dict[lang] || dict['tr']
  for (const k of keys) {
    if (!res) return key
    res = res[k]
  }
  return res || key
}

const dict = {
  tr: {
    // Popup App
    tabs: { seans: 'Seans', grimoire: 'Grimoire', ayarlar: 'Ayarlar' },
    
    // Character Card
    char: {
      level: 'Lv.',
      full: '% dolu',
      floorActive: 'kat aktif',
      noSession: 'Seans yok',
      xpRemaining: 'XP kaldı',
      totalScrolls: 'Toplam scroll',
      thisWeek: 'Bu hafta'
    },
    
    // Session Control
    session: {
      focusTime: 'fokus süresi',
      reward: 'XP (Odak Ödülü)',
      endSession: 'Seans Bitti',
      enterDungeon: "Dungeon'a Gir (Lore Modu)",
      formalSummary: 'Ciddi Özet Çıkar'
    },
    
    // Grimoire List
    list: {
      loading: 'Yükleniyor...',
      empty1: 'Grimoire boş.',
      empty2: 'Seans başlat, bir sayfa oku ve kaydet.',
      deleteConfirm: 'Bu kaydı Grimoire hafızasından silmek istediğine emin misin?'
    },
    
    // Settings
    settings: {
      titleSettings: 'Ayarlar',
      loreStyle: 'Lore Stili (Metin Dönüşümü)',
      monsterDiff: 'Canavar Zorluğu',
      easy: 'Kolay (Az zarar)',
      normal: 'Normal',
      hard: 'Zor (Acımasız)',
      provider: 'AI Sağlayıcısı',
      appLang: 'Hikaye / Çıktı Dili',
      showKey: 'göster',
      hideKey: 'gizle',
      hintOpenAI: 'İpucu: OpenAI key genellikle sk-proj- ile başlar.',
      hintAnthropic: 'İpucu: Anthropic key genellikle sk-ant- ile başlar.',
      hintGrok: 'İpucu: Grok key genellikle xai- ile başlar.',
      hintGemini: "İpucu: Gemini key Google AI Studio'dan (aistudio.google.com) alınır.",
      localWarn: 'Bu veri sadece lokal tarayıcınızda saklanır, sunucuya gönderilmez.',
      customModel: 'Özel Model Adı (Opsiyonel)',
      customHint: 'Boş bırakırsanız varsayılan model kullanılır. Sağlayıcının modeli değişirse buraya yazabilirsiniz.',
      dataManagement: 'Veri Yönetimi',
      resetData: 'Tüm XP, Grimoire ve Kayıtları Sıfırla',
      resetConfirm: 'Tüm ilerlemen, kitabelerin ve seviyen Tılsım gibi yok olacak. Emin misin?'
    },

    // Content Script
    content: {
      saveGrimoire: "Grimoire'a Kaydet",
      switchToFormal: 'Resmi Özete Geç',
      switchToLore: "Lore'a Dön",
      alreadySaved: "Zaten Grimoire'da",
      saving: 'Kaydediliyor...',
      xpGained: 'XP kazandın!',
      saveError: 'Hata:',
      prev: '◄ Önceki',
      next: 'Sonraki ►',
      chunk: 'Kitabe',
      spellFailed: 'Büyü bozuldu:',
      gotIt: 'Anladım, geri dönüyorum',
      weeklyBoss: 'HAFTALIK YÜZLEŞME',
      thisWeekScrolls: 'Bu hafta {count} scroll tamamladın.',
      fight: 'Savaş (+{xp} XP)',
      flee: 'Kaç',
      victory: 'Zafer! +{xp} XP kazandın.',
      defeat: "Yenildin. XP'nin %20'si silindi."
    }
  },

  en: {
    // Popup App
    tabs: { seans: 'Session', grimoire: 'Grimoire', ayarlar: 'Settings' },
    
    // Character Card
    char: {
      level: 'Lv.',
      full: '% full',
      floorActive: 'floor active',
      noSession: 'No active session',
      xpRemaining: 'XP left',
      totalScrolls: 'Total scrolls',
      thisWeek: 'This week'
    },
    
    // Session Control
    session: {
      focusTime: 'focus time',
      reward: 'XP (Focus Reward)',
      endSession: 'End Session',
      enterDungeon: 'Enter Dungeon (Lore)',
      formalSummary: 'Extract Formal Summary'
    },
    
    // Grimoire List
    list: {
      loading: 'Loading...',
      empty1: 'Grimoire is empty.',
      empty2: 'Start a session, read a page and save.',
      deleteConfirm: 'Are you sure you want to delete this record from Grimoire?'
    },
    
    // Settings
    settings: {
      titleSettings: 'Settings',
      loreStyle: 'Lore Style (Text Conversion)',
      monsterDiff: 'Monster Difficulty',
      easy: 'Easy (Low damage)',
      normal: 'Normal',
      hard: 'Hard (Ruthless)',
      provider: 'AI Provider',
      appLang: 'App & Output Language',
      showKey: 'show',
      hideKey: 'hide',
      hintOpenAI: 'Hint: OpenAI keys usually start with sk-proj-',
      hintAnthropic: 'Hint: Anthropic keys usually start with sk-ant-',
      hintGrok: 'Hint: Grok keys usually start with xai-',
      hintGemini: "Hint: Gemini keys are obtained from Google AI Studio.",
      localWarn: 'This data is exclusively stored locally in your browser.',
      customModel: 'Custom Model ID (Optional)',
      customHint: 'Leave empty for default. If the provider model changes, enter it here.',
      dataManagement: 'Data Management',
      resetData: 'Erase All XP, Grimoire and User Data',
      resetConfirm: 'All progress, scrolls, and levels will be wiped permanently. Are you sure?'
    },

    // Content Script
    content: {
      saveGrimoire: "Save to Grimoire",
      switchToFormal: 'Formal Summary',
      switchToLore: 'Back to Lore',
      alreadySaved: "Already Saved",
      saving: 'Saving...',
      xpGained: 'XP Gained!',
      saveError: 'Error:',
      prev: '◄ Prev',
      next: 'Next ►',
      chunk: 'Scroll',
      spellFailed: 'Spell Failed:',
      gotIt: 'Got it, returning',
      weeklyBoss: 'WEEKLY CONFRONTATION',
      thisWeekScrolls: 'You completed {count} scrolls this week.',
      fight: 'Fight (+{xp} XP)',
      flee: 'Flee',
      victory: 'Victory! You gained +{xp} XP.',
      defeat: "Defeat. 20% of your XP was wiped."
    }
  }
}
