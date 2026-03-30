export const VERSION = '0.1.0'

export const STORAGE_KEYS = {
  SESSION:    'session',
  CHARACTER:  'character',
  GRIMOIRE:   'grimoire',
  SETTINGS:   'settings',
  WORLD:      'world',
  QUIZ_QUEUE: 'quizQueue',
}

// Mesaj tipleri — background ↔ popup ↔ content script arası iletişim
export const MSG = {
  // Popup → Background
  START_SESSION: 'START_SESSION',
  END_SESSION:   'END_SESSION',
  GET_STATE:     'GET_STATE',

  // Background → Content Script
  MONSTER_ATTACK:   'MONSTER_ATTACK',
  SESSION_ENDED:    'SESSION_ENDED',

  // Content Script → Background
  TRANSFORM_TO_LORE: 'TRANSFORM_TO_LORE',  // Phase 2'de
  SAVE_SCROLL:       'SAVE_SCROLL',          // Phase 3'te

  // Background → Popup
  XP_UPDATE:    'XP_UPDATE',
  LEVEL_UP:     'LEVEL_UP',
}

// Sosyal medya domain listesi (genişletildi)
export const DISTRACTION_DOMAINS = [
  'twitter.com', 'x.com',
  'instagram.com',
  'tiktok.com',
  'reddit.com',
  'youtube.com',
  'facebook.com',
  'twitch.tv',
  'netflix.com',
  'discord.com',
  'telegram.org', 'web.telegram.org',
]

// ─── Canavar tanımları ────────────────────────────────────────────────────

export const MONSTERS = [
  {
    id: 'procrastination_djinn',
    name: 'Erteleme İfriti',
    nameEn: 'Djinn of Procrastination',
    title: 'Dikkatini kaybettin',
    titleEn: 'You lost your focus',
    trigger: 'tab_switch',
    xpDrainPct: 0.12,
    minXPDrain: 30,
    maxXPDrain: 120,
    depth: [1, 2, 3],
    message: 'Yolunu kaybedenlerin ruhu fısıldar: "Geri dön... hâlâ zaman var."',
    messageEn: 'The spirit of the lost whispers: "Turn back... there is still time."',
    color: '#534ab7',
  },
  {
    id: 'scroll_wraith',
    name: 'Sonsuz Kaydırma Hayaleti',
    nameEn: 'Infinite Scroll Wraith',
    title: 'Sosyal medya tuzağı!',
    titleEn: 'Social media trap!',
    trigger: 'social_media',
    xpDrainPct: 0.22,
    minXPDrain: 60,
    maxXPDrain: 200,
    depth: [2, 3, 4, 5],
    message: 'Hayalet seni sonsuz girdabına çekiyor. Her kaydırma bir XP götürüyor.',
    messageEn: 'The wraith drags you into its infinite abyss. Every scroll costs XP.',
    color: '#993c1d',
  },
  {
    id: 'notification_golem',
    name: 'Bildirim Golemi',
    nameEn: 'Notification Golem',
    title: 'Uzun süredir ayrıldın',
    titleEn: 'You have been away too long',
    trigger: 'long_idle',
    xpDrainPct: 0.08,
    minXPDrain: 20,
    maxXPDrain: 80,
    depth: [1, 2, 3, 4, 5],
    message: 'Golem hareketsizlik döneminde birikim yaptı. Varlığın onun yiyeceğiydi.',
    messageEn: 'The Golem accumulated strength during your idle time. Your presence was its food.',
    color: '#5f5e5a',
  },
  {
    id: 'video_siren',
    name: 'Video Sireni',
    nameEn: 'Video Siren',
    title: 'YouTube\'a girdin',
    titleEn: 'You entered YouTube',
    trigger: 'social_media',
    xpDrainPct: 0.18,
    minXPDrain: 50,
    maxXPDrain: 160,
    depth: [3, 4, 5],
    message: '"Sadece bir video" dedi Sireni. Üç saat sonra hâlâ oradaydın.',
    messageEn: '"Just one video" said the Siren. Three hours later you were still there.',
    color: '#993556',
  },
]

// Hareketsizlik eşiği (ms)
export const IDLE_THRESHOLD_MS = 20 * 60 * 1000  // 20 dakika

// ─── Haftalık Boss ────────────────────────────────────────────────────────

export const WEEKLY_BOSS = {
  name: 'Haftanın Gölgesi',
  nameEn: 'Shadow of the Week',
  description: 'Tüm haftanın fokus gücüyle yüzleş.',
  descriptionEn: 'Confront the focus power of the entire week.',
  // Her hafta Pazar 20:00'de kontrol
  checkDay: 0,       // 0 = Pazar
  checkHour: 20,
  // Haftalık scroll sayısına göre boss HP hesapla
  calcHP: (weeklyScrolls) => Math.max(10, 100 - weeklyScrolls * 7),
  // Boss yenilirse XP ödülü
  winXP: (weeklyScrolls) => weeklyScrolls * 25 + 100,
  // Boss kazanırsa XP cezası
  lossXPDrain: 0.20,  // toplam XP'nin %20'si
}

// Dungeon derinliği hesaplama
// Her 3 kayıtlı scroll = 1 kat aşağı
export const SCROLLS_PER_DEPTH = 3

// AI Sağlayıcıları
export const AI_PROVIDERS = {
  chrome:    { id: 'chrome',    label: 'Chrome Built-in AI', needKey: false },
  openai:    { id: 'openai',    label: 'OpenAI (ChatGPT)',   needKey: true, url: 'https://api.openai.com/v1/chat/completions', model: 'gpt-4o-mini' },
  anthropic: { id: 'anthropic', label: 'Anthropic (Claude)', needKey: true, url: 'https://api.anthropic.com/v1/messages',      model: 'claude-3-haiku-20240307' },
  grok:      { id: 'grok',      label: 'xAI (Grok)',         needKey: true, url: 'https://api.x.ai/v1/chat/completions',       model: 'grok-4-1-fast' },
  gemini:    { id: 'gemini',    label: 'Google Gemini API',  needKey: true, url: 'https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent', model: 'gemini-1.5-flash' }
}

// Lore stil tanımları
export const LORE_STYLES = {
  fantasy: {
    label: 'Fantasy Destanı',
    labelEn: 'Fantasy Epic',
    systemPrompt: `Sen bir orta çağ fantasy destanı yazarısın.
Görevin: verilen metni epik, kadim ve büyülü bir dil kullanarak yeniden yazmak.
Kurallar:
- Bilimsel kavramlar → kadim sihir ve büyü
- Kurumlar ve yapılar → kaleler, loncalar, krallıklar
- Süreçler → ritüeller, kehanetler, seferler
- Kişiler → kahramanlar, ustalar, bilgeler
- Orijinal bilgiyi koru ama dili tamamen dönüştür
- 3-4 paragraf, her paragraf en fazla 4 cümle
- Açıklama yapma, sadece dönüştürülmüş metni yaz`,
  },

  scifi: {
    label: 'Sci-Fi Teknik Raporu',
    labelEn: 'Sci-Fi Tech Report',
    systemPrompt: `Sen bir hard sci-fi evreninde teknik rapor yazan bir araştırmacısın.
Görevin: verilen metni soğuk, kesin ve gelecekçi terminoloji kullanarak yeniden yazmak.
Kurallar:
- Kavramlar → protokoller, algoritmalar, sistemler
- Kişiler → ajanlar, operatörler, koordinatörler
- Yerler → sektörler, istasyonlar, nodlar
- Sayısal ve teknik dil ön planda
- 3-4 paragraf
- Sadece dönüştürülmüş metni yaz`,
  },

  noir: {
    label: 'Noir Dedektif',
    labelEn: 'Noir Detective',
    systemPrompt: `Sen yorgun bir dedektifsin, şehrin karanlık sokak monologunu yazıyorsun.
Görevin: verilen metni sinik, şiirsel ve kasvetli bir iç ses olarak yeniden yazmak.
Kurallar:
- Her kavram bir sır, suç veya kadere teslimiyete dönüşür
- Kısa, kesik cümleler. Ara sıra uzun soluklu melankolik pasajlar.
- Şehir metaforları: yağmur, duman, neon, karanlık sokaklar
- 3-4 paragraf
- Sadece dönüştürülmüş metni yaz`,
  },

  mythology: {
    label: 'Kadim Mitoloji',
    labelEn: 'Ancient Mythology',
    systemPrompt: `Sen antik bir mitoloji anlatıcısısın.
Görevin: verilen metni Yunan-Roma mitolojisi tarzında yeniden yazmak.
Kurallar:
- Kavramlar → tanrıların armağanları veya lanetleri
- Kişiler → tanrı, yarı-tanrı, kahraman, ölümlü
- Süreçler → kader, kehanetin gerçekleşmesi, ilahi müdahale
- Epik sıfatlar ve kaderin kaçınılmazlığı hissi
- 3-4 paragraf
- Sadece dönüştürülmüş metni yaz`,
  },

  cyberpunk: {
    label: 'Cyberpunk 2077',
    labelEn: 'Cyberpunk 2077',
    systemPrompt: `Sen distopik, neon ışıklı bir cyberpunk megacity'sinde bir veri hackerısın (netrunner).
Görevin: verilen metni yüksek teknoloji, sibernetik ve şirket savaşları argosu kullanarak yeniden yazmak.
Kurallar:
- Kavramlar → protokoller, neural implantlar, glitcheler
- Kurumlar → megacorporasyonlar, yeraltı sendikaları
- Süreçler → sisteme sızmak, veriyi işlemek, firewall kırmak
- Karanlık, teknolojik ve neon-noir bir üslup kullan
- Sadece dönüştürülmüş metni yaz`,
  },

  lovecraft: {
    label: 'Kozmik Korku (Lovecraft)',
    labelEn: 'Cosmic Horror (Lovecraft)',
    systemPrompt: `Sen deliliğin sınırlarında gezinen, kadim ve akıl almaz dehşetlere tanık olmuş bir araştırmacısın.
Görevin: verilen metni kozmik bir korku ve Lovecraftiyen bir dille yeniden yazmak.
Kurallar:
- Kavramlar → yasaklı bilgiler, kadim sırlar, yıldızların ötesinden gelen fısıltılar
- Kişiler → lanetli ruhlar, tarikat üyeleri, unutulmuş tanrılar
- Üslup: tekinsiz, çıldırtıcı, bilinemezliğin korkusu
- Anlaşılamayan, boyut ötesi tasvirler kullan
- Sadece dönüştürülmüş metni yaz`,
  },

  pirate: {
    label: 'Denizci / Korsan Destanı',
    labelEn: 'Pirate / Sea Saga',
    systemPrompt: `Sen Yedi Denizler'in en kurnaz ve efsanevi korsan kaptanlarından birisin, tayfana tayın dağıtırken masal anlatıyorsun.
Görevin: verilen metni açık denizler, fırtınalar, tayfa ve hazine diliyle masalsı bir korsan efsanesi olarak yeniden yazmak.
Kurallar:
- Kavramlar → lanetli hazineler, pusulalar, kara fırtınalar
- Kişiler → tayfa, deniz canavarları, kraliyet donanması
- "Arrr, yelkenleri fora edin" veya "tayfa" benzeri denizci argoları ve macera hissi kullan
- Sadece dönüştürülmüş metni yaz`,
  },

  postapoc: {
    label: 'Kıyamet Sonrası (Fallout)',
    labelEn: 'Post-Apocalyptic (Fallout)',
    systemPrompt: `Sen nükleer kış ve çorak topraklarda hayatta kalmış deneyimli bir çöpçüsün (scavenger).
Görevin: verilen metni nükleer kıyamet, radyoaktif yıkım ve hayatta kalma mücadelesi diliyle yeniden yazmak.
Kurallar:
- Kavramlar → radyasyon, eski dünya kalıntıları, mutasyonlar
- Kişiler → çöpçüler, savaş ağaları, mutantlar
- Kurumlar → sığınaklar (vault), harabeler
- Çaresizlik, pas, hurda ve asit yağmuru tasvirleri kullan
- Sadece dönüştürülmüş metni yaz`,
  },

  samurai: {
    label: 'Uzakdoğu Samuray',
    labelEn: 'Far East Samurai',
    systemPrompt: `Sen onur ve disiplinle yoğrulmuş, efsanevi eski bir rōnin (efendisiz samuray) ya da bilgésin.
Görevin: verilen metni feodal Japonya mitolojisi, kılıç sanatı ve bushido felsefesiyle harmanlayarak yeniden yazmak.
Kurallar:
- Kavramlar → onur yolları, sakura yaprakları, kılıç darbeleri, ejderhalar
- Kişiler → klan liderleri, şogunlar, rōninler, onurlu savaşçılar
- Şiirsel, haiku tadında felsefi ama bir o kadar da keskin bir anlatım
- Sadece dönüştürülmüş metni yaz`,
  },

  twitter: {
    label: 'Twitter (Flood) Stili',
    labelEn: 'Twitter (Flood) Style',
    systemPrompt: `Sen karmaşık konuları Twitter'da (X) flood (bilgi seli) şeklinde anlatan popüler bir içerik üreticisisin.
Görevin: Verilen metnin hiçbir bilgisini eksiltmeden, aynen koruyarak onu sürükleyici, gündelik ve modern bir "Twitter Flood'u" diline dönüştürmek.
Kurallar:
- Metni KISALTMA veya ÖZETLEME. Tüm temel eğitimsel bilgileri ve detayları koru. Sadece dili ve sunum şeklini değiştir.
- Gereksiz akademik detayları (rapor kodları, referanslar, doi numaraları) metinden temizle, ancak asıl içeriğe sadık kal.
- Flood akışında hissettirmek için samimi, akıcı ve ilgi çekici bir üslup kullan. Paragraf aralıklarını dengeli bırak.
- Sadece dönüştürülmüş metni yaz.`,
  },
}

// Built-in AI için metin kırpma — Gemini Nano context window küçük
export const MAX_INPUT_CHARS = 1500

// XP hesaplama
export const XP_CONFIG = {
  BASE_XP: 100,                // minimum XP
  SCROLL_MULTIPLIER: 3,        // scroll %'si başına XP
  MAX_XP_PER_SAVE: 400,        // tek kaydın verebileceği max XP
  LONG_READ_BONUS: 50,         // 5dk+ okuma süresi bonusu
  DEEP_SCROLL_BONUS: 75,       // %80+ scroll bonusu
}

// Dungeon derinliği eşikleri
export const DEPTH_THRESHOLDS = [
  { depth: 1, minScrolls: 0 },
  { depth: 2, minScrolls: 3 },
  { depth: 3, minScrolls: 7 },
  { depth: 4, minScrolls: 12 },
  { depth: 5, minScrolls: 18 },
]
