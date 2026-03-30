// Grimoire — AI Katmanı  (v2.0.0 — Living World + Memory Palace)
import { LORE_STYLES, AI_PROVIDERS } from './constants.js'

/**
 * Chrome Built-in AI'ın durumunu kontrol eder
 */
export async function checkAIAvailability() {
  try {
    if (!('ai' in self) || !('languageModel' in self.ai)) return 'unavailable'
    const capabilities = await self.ai.languageModel.capabilities()
    if (capabilities.available === 'readily') return 'available'
    if (capabilities.available === 'after-download') return 'downloading'
    return 'unavailable'
  } catch (err) {
    console.warn('[Grimoire AI] Availability check failed:', err)
    return 'unavailable'
  }
}

/**
 * Kullanıcının seçtiği AI provider'a göre metni dönüştürür
 */
export async function transformToLore({ text, loreStyle = 'fantasy' }) {
  if (!text || text.trim().length < 50) {
    throw new Error('Metin çok kısa, dönüştürülemiyor.')
  }

  const { settings } = await chrome.storage.local.get(['settings'])
  const providerId = settings?.aiProvider ?? 'chrome'
  const apiKey     = settings?.apiKey ?? ''

  const style = loreStyle === 'formal_summary'
    ? {
        label: 'Resmi Özet',
        systemPrompt: `Sen son derece profesyonel, objektif ve net bir araştırmacısın. Anlatımda hiçbir şekilde hikayeleştirme, rol yapma veya kurgusal fenomen öğeler kullanma. 
Görevin: Verilen metni akademik veya profesyonel bir sadelikte, en önemli kısımlarını atlamadan, kısa paragraflar veya maddeler halinde "RESMİ BİR DİLLE" özetlemektir. Yalnızca salt temel bilgiye odaklan, asla hayal gücü kullanma.`
      }
    : (LORE_STYLES[loreStyle] ?? LORE_STYLES.fantasy)

  const trimmedText = text.slice(0, 1500)
  
  let finalSystemPrompt = style.systemPrompt
  
  finalSystemPrompt += "\n\nCRITICAL RULE 1: IGNORING JUNK. The input might contain academic references, author names, journal metadata, DOIs, report codes, etc. IGNORE them completely. Focus ONLY on the actual educational message and core facts."
  finalSystemPrompt += "\n\nCRITICAL RULE 2: PRESERVE FACTS. While changing the tone, you MUST PRESERVE ALL ORIGINAL CORE FACTS. Do not invent new facts, do not hallucinate."

  if (settings?.appLanguage === 'en') {
    finalSystemPrompt += "\n\nCRITICAL RULE 3: ABSOLUTE LANGUAGE CONSTRAINT. The final output lore MUST be written ENTIRELY in ENGLISH. NO EXCEPTIONS. Even if the input is in another language, TRANSLATE IT and write the final output exclusively in ENGLISH."
  } else {
    finalSystemPrompt += "\n\nCRITICAL RULE 3: ABSOLUTE LANGUAGE CONSTRAINT. The final output lore MUST be written ENTIRELY in TURKISH. NO EXCEPTIONS. Even if the input is in another language (e.g. English, Chinese, etc.), TRANSLATE IT and write the final output exclusively in TURKISH."
  }
  
  // 1. CHROME BUILT-IN AI
  if (providerId === 'chrome') {
    return runChromeAI(trimmedText, finalSystemPrompt)
  }

  // 2. BULUT (CLOUD) API'LER (OpenAI, Anthropic, Grok, Gemini)
  if (!apiKey || apiKey.trim() === '') {
    throw new Error('API Key girilmemiş. Ayarlar menüsünden ilgili sağlayıcının Key bilgisini girin.')
  }

  const providerDef = AI_PROVIDERS[providerId]
  if (!providerDef) throw new Error('Geçersiz AI Provider.')

  if (providerId === 'anthropic') {
    return runAnthropic(trimmedText, finalSystemPrompt, apiKey, providerDef, settings)
  } else if (providerId === 'gemini') {
    return runGeminiAPI(trimmedText, finalSystemPrompt, apiKey, providerDef, settings)
  } else {
    // OpenAI ve xAI (Grok) aynı endpoints formatını destekler
    return runOpenAICompat(trimmedText, finalSystemPrompt, apiKey, providerDef, settings)
  }
}

// --- Alt Fonksiyonlar ---

async function runChromeAI(text, systemPrompt) {
  const status = await checkAIAvailability()
  if (status === 'unavailable') throw new Error('Chrome Built-in AI desteklenmiyor (Chrome 127+ gerekir veya Nano inmemiştir). Lütfen Cloud tabanlı (Grok/OpenAI vs.) bir sağlayıcı seçin.')
  if (status === 'downloading') throw new Error('AI modeli indiriliyor. Birkaç dakika sonra tekrar deneyin veya başka sağlayıcı seçin.')

  let session
  try {
    session = await self.ai.languageModel.create({ systemPrompt })
    const result = await session.prompt(`Aşağıdaki metni dönüştür:\n\n${text}`)
    return result.trim()
  } finally {
    session?.destroy()
  }
}

async function runOpenAICompat(text, systemPrompt, apiKey, providerDef, settings) {
  const model = settings?.customModel?.trim() || providerDef.model
  const res = await fetch(providerDef.url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey.trim()}`
    },
    body: JSON.stringify({
      model: model,
      stream: false,
      temperature: 0.7,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: `Aşağıdaki metni dönüştür:\n\n${text}` }
      ]
    })
  })

  if (!res.ok) {
    let errText = ''
    try {
      const err = await res.json()
      errText = err?.error?.message || JSON.stringify(err)
    } catch (e) {
      errText = 'JSON çevrilemedi'
    }
    throw new Error(`${providerDef.label} Hatası: ${res.status} - ${errText}`)
  }

  const data = await res.json()
  const content = data?.choices?.[0]?.message?.content
  if (!content) throw new Error(`${providerDef.label} boş yanıt döndürdü.`)
  return content.trim()
}

async function runAnthropic(text, systemPrompt, apiKey, providerDef, settings) {
  const model = settings?.customModel?.trim() || providerDef.model
  const res = await fetch(providerDef.url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey.trim(),
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true'
    },
    body: JSON.stringify({
      model: model,
      max_tokens: 1024,
      system: systemPrompt,
      messages: [
        { role: 'user', content: `Aşağıdaki metni dönüştür:\n\n${text}` }
      ]
    })
  })

  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(`Anthropic Hatası: ${err?.error?.message ?? res.status}`)
  }

  const data = await res.json()
  const content = data?.content?.[0]?.text
  if (!content) throw new Error(`Anthropic boş yanıt döndürdü.`)
  return content.trim()
}

async function runGeminiAPI(text, systemPrompt, apiKey, providerDef, settings) {
  const model = settings?.customModel?.trim() || providerDef.model
  const url = providerDef.url.replace('{model}', model) + `?key=${apiKey.trim()}`
  
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: systemPrompt }] },
      contents: [{ parts: [{ text: `Aşağıdaki metni dönüştür:\n\n${text}` }] }]
    })
  })

  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(`Gemini Hatası: ${err?.error?.message ?? res.status}`)
  }

  const data = await res.json()
  const content = data?.candidates?.[0]?.content?.parts?.[0]?.text
  if (!content) throw new Error('Gemini boş yanıt döndürdü.')
  return content.trim()
}

// ─── Shared internal provider caller ─────────────────────────────────────────
// transformToLore'un aksine bu helper doğrudan çağrılabilir ve sistem içi
// World + Quiz işlemlerinde kullanılır.

async function callProvider(systemPrompt, userContent) {
  const { settings } = await chrome.storage.local.get(['settings'])
  const providerId = settings?.aiProvider ?? 'chrome'
  const apiKey     = settings?.apiKey ?? ''

  if (providerId === 'chrome') return runChromeAI(userContent, systemPrompt)

  if (!apiKey || apiKey.trim() === '') {
    throw new Error('API Key girilmemiş. Lütfen Ayarlar\'dan bir Cloud provider seçin.')
  }

  const providerDef = AI_PROVIDERS[providerId]
  if (!providerDef) throw new Error('Geçersiz AI Provider.')

  if (providerId === 'anthropic') return runAnthropic(userContent, systemPrompt, apiKey, providerDef, settings)
  if (providerId === 'gemini')    return runGeminiAPI(userContent, systemPrompt, apiKey, providerDef, settings)
  return runOpenAICompat(userContent, systemPrompt, apiKey, providerDef, settings)
}

// ─── Living World ─────────────────────────────────────────────────────────────

/**
 * Bir lore metninden fantasy dünya entitesi çıkarır.
 * Mevcut dünya varlıklarına bakarak bağlantı kurmaya çalışır.
 */
export async function extractWorldEntry(loreText, existingEntries = []) {
  const worldContext = existingEntries.slice(0, 8)
    .map(e => `- "${e.title}" (${e.type}): ${e.summary}`)
    .join('\n')

  const systemPrompt = `You are a fantasy world builder. A lore text will be given to you.
Your task: extract one world entity from it and integrate it with the existing world.

EXISTING WORLD ENTITIES:
${worldContext || 'The world is empty — you are building it from scratch.'}

Reply with ONLY valid JSON (absolutely no extra text before or after):
{"title":"Fantasy name for this entity","type":"place|event|character|era|artifact","realm":"Region or era this belongs to","themes":["theme1","theme2"],"summary":"2-3 sentences. If the existing world has related entities, reference them."}`

  const raw = await callProvider(systemPrompt, loreText.slice(0, 800))
  const match = raw.match(/\{[\s\S]*\}/)
  if (!match) throw new Error('World entry JSON parse failed')
  return JSON.parse(match[0])
}

/**
 * Tüm dünya varlıklarını epik bir kronik anlatıya dönüştürür.
 */
export async function generateWorldChronicle(entries, lang = 'tr') {
  const entrySummaries = entries
    .map(e => `[${e.type.toUpperCase()}] "${e.title}" (${e.realm}) — ${e.summary}`)
    .join('\n\n')

  const systemPrompt = lang === 'en'
    ? `You are a legendary chronicle writer. Weave all the world entities below into one cohesive, epic narrative.
Write as flowing prose — not a list. Build causal connections between entities. Where possible, show how events influenced each other.
3-5 paragraphs, 400-600 words. Write entirely in English.`
    : `Sen efsanevi bir kronik yazarısın. Aşağıdaki tüm dünya varlıklarını tek, tutarlı ve epik bir anlatıda birleştir.
Akıcı bir düzyazı olarak yaz — liste değil, hikaye. Varlıklar arasında nedensellik bağları kur. Olayların birbirini nasıl etkilediğini göster.
3-5 paragraf, 400-600 kelime. Tamamen Türkçe yaz.`

  return await callProvider(systemPrompt, entrySummaries)
}

// ─── Memory Palace ────────────────────────────────────────────────────────────

/**
 * Bir lore metninden 3 çoktan seçmeli quiz sorusu üretir.
 */
export async function generateQuizQuestions(loreText, lang = 'tr') {
  const systemPrompt = lang === 'en'
    ? `You are a quiz master. Based on the lore text, generate exactly 3 multiple-choice questions that test understanding of the core ideas.
Return ONLY a valid JSON array — no extra text, no markdown, no explanation outside the JSON:
[{"q":"Question?","options":["Option A","Option B","Option C","Option D"],"correct":0,"explanation":"Why this answer is correct"}]`
    : `Sen bir bilgi yarışması ustasısın. Aşağıdaki lore metninden tam olarak 3 çoktan seçmeli soru üret. Temel fikirleri test et.
SADECE geçerli JSON array döndür — JSON dışında hiçbir şey yazma, markdown kullanma:
[{"q":"Soru?","options":["Seçenek A","Seçenek B","Seçenek C","Seçenek D"],"correct":0,"explanation":"Bu cevabın doğru olmasının nedeni"}]`

  const raw = await callProvider(systemPrompt, loreText.slice(0, 1000))
  const match = raw.match(/\[[\s\S]*\]/)
  if (!match) throw new Error('Quiz JSON parse failed')
  return JSON.parse(match[0])
}
