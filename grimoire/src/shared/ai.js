// Grimoire — AI Katmanı
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
