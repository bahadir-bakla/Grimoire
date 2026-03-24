# Privacy Policy for Grimoire

**Last updated: March 2026**

Thank you for choosing to be part of our community at **Grimoire**. We are committed to protecting your personal information and your right to privacy. If you have any questions or concerns about this privacy notice or our practices with regard to your personal information, please consult this document.

When you use the Grimoire Chrome Extension, we appreciate that you are trusting us with your web browsing activity and reading content. We take your privacy very seriously. In this privacy notice, we seek to explain to you in the clearest way possible what information is accessed, how it is used, and what rights you have in relation to it.

## 1. What Information Do We Collect?

**We do NOT collect, store, or transmit your personal data to our servers.**
Grimoire is designed to be a completely localized tool. All of your data, including your reading history, XP progress, level, and extension settings, are saved strictly on your local device using Chrome's `chrome.storage.local` API.

**Information accessed locally by the extension:**
*   **Website Content:** The extension extracts the text of the webpage you are currently reading only when you actively trigger a reading session. This is strictly required to transform the text using AI.
*   **User Activity (Web History / Tab State):** The extension monitors your active tab domain to determine if you have switched to a distracting website (e.g., YouTube, Twitter) while in a focus session, which triggers the gamified "Monster Attack" mechanism.

## 2. How Do We Use Your Information?

The information accessed by the extension is used strictly for the **Single Purpose** of providing the gamified AI reading assistant experience.
*   We use the extracted text to provide you with RPG lore summaries or formal summaries.
*   We use your tab state (distracting vs. safe domains) to calculate your RPG XP and apply focus penalties.

**We do NOT:**
*   Sell or transfer user data to third parties.
*   Use or transfer user data for purposes that are unrelated to the extension's core functionality.
*   Use or transfer user data to determine creditworthiness or for lending purposes.

## 3. Third-Party API Integrations

Grimoire allows you to process text using advanced cloud AI providers if you choose to enter your own API Keys (e.g., OpenAI, Anthropic, xAI, Google Gemini).
*   Your API keys are stored **locally** on your browser and are never transmitted to the developer.
*   If you choose to use a cloud API, the extracted text from your active tab will be securely transmitted directly to the API provider of your choice (e.g., OpenAI's endpoint) strictly for the purpose of fulfilling your summarization request.
*   Please refer to the privacy policies of the respective AI providers (OpenAI, Anthropic, Google) regarding how they handle the data transmitted via their APIs.
*   If you use the **Chrome Built-in AI (Gemini Nano)** option, the text processing is performed entirely locally on your machine, with absolutely zero data transmission over the internet.

## 4. Updates to This Policy

We may update this privacy notice from time to time as the extension evolves. The updated version will be indicated by an updated "Revised" date and the updated version will be effective as soon as it is accessible. 

## 5. Contact Us

Because Grimoire is a free, open-source portfolio project, there is no official corporate support. However, you can review the public source code of this extension and report any privacy concerns on our GitHub repository.
