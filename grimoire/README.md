# Grimoire: Gamified AI Reading & Focus Assistant

![Grimoire Extension](public/icons/icon128.png)

Grimoire is a powerful Chrome Extension (Manifest V3) that transforms boring, lengthy web articles into engaging, immersive RPG-style "Lore" or professional summaries using various AI models (Gemini, Claude, OpenAI, Grok). It also gamifies your focus time, keeping you engaged and penalizing you with "Monster Attacks" when you get distracted by social media.

## 🚀 Key Features
- **AI-Powered Transformations:** Read the web your way. Turn Wikipedia pages into Cyberpunk data cores, Lovecraftian cosmic horror, Fantasy epics, or straightforward formal summaries.
- **Multiple AI Providers:** Choose between Chrome's cutting-edge Built-in AI (Gemini Nano) for absolute offline privacy, or plug in your cloud keys for Google Gemini API, OpenAI, Anthropic (Claude), or xAI (Grok). 
- **Custom Models:** Future-proof architecture allows users to define custom/new model endpoints directly via the UI (e.g. `gpt-4o-max`).
- **Gamified Focus System:** Earn XP and level up by reading and staying focused. Switch to a distraction site (like Twitter/X, Instagram, or YouTube)? A monster will attack and drain your XP! (Service-worker-driven background alarms).
- **Infinite Pagination:** Handles massive documents effortlessly. Extracts up to 150,000 characters from a single page and paginates it seamlessly via AI.
- **Bilingual Interface:** Fully supports both English and Turkish application UI and AI output.

## 🛠️ Stack & Technologies
- **Frontend:** React 18 & Vite
- **Extension Architecture:** Chrome Extensions API (Manifest V3), Service Workers, Content Scripts
- **State Management:** `chrome.storage.local` with complex synchronization
- **Styling:** Vanilla CSS (Custom dark-mode aesthetic with interactive micro-animations)
- **AI:** Fetch API (REST implementations for LLMs) & `window.ai`

## 📦 Installation & Developer Setup

1. Clone the repository:
   ```bash
   git clone https://github.com/yourusername/grimoire.git
   cd grimoire
   ```
2. Install dependencies:
   ```bash
   npm install
   ```
3. Build the project:
   ```bash
   npm run build
   ```
4. Load the extension in Chrome:
   - Open Chrome and navigate to `chrome://extensions/`
   - Enable **"Developer mode"** in the top right.
   - Click **"Load unpacked"** and select the generated `/dist` directory.

## ⚙️ Security & Configuration
No hardcoded APIs exist in the source code. Grimoire operates completely securely:
- You select your preferred Cloud Provider in the **Settings** panel.
- Your API keys are strictly kept in your browser's local storage and are never sent anywhere except the official endpoint of the provider you chose.

---
*Built as a modern showcase of blending Manifest V3 architecture with real-world LLM use-cases.*
