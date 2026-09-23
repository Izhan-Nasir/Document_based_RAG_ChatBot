# Oracle — Intelligent Document Assistant

Oracle is a lightning-fast Retrieval-Augmented Generation (RAG) chatbot that allows users to upload documents and ask questions about their content. Built with a clean, minimalist interface, Oracle accurately cites its sources and ensures answers are strictly grounded in your data.

## Features
- **Multi-format Support:** Upload and process PDF, DOCX, TXT, and CSV files.
- **RAG Architecture:** Embeds documents into a vector database to provide highly accurate, context-aware answers without hallucinations.
- **Source Citations:** Every answer includes exact citations linking back to the relevant document excerpts used by the AI.
- **Minimalist UI:** A premium, modern interface featuring markdown rendering, dark/light modes, and sliding side panels.

## Tech Stack
- **Backend:** Node.js, Express
- **Frontend:** Vanilla JavaScript, HTML5, CSS3, Bootstrap 5 (Customized)
- **LLM:** Groq API (`qwen/qwen3.8-27b`) for ultra-fast chat completions
- **Embeddings:** Google Gemini API (`gemini-embedding-001`)
- **Vector Database:** Qdrant Cloud

## Setup & Installation

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Configure Environment Variables:**
   Rename `.env.example` to `.env` and fill in your API keys:
   ```bash
   cp .env.example .env
   ```
   *Note: You will need free API keys from [Groq](https://console.groq.com/), [Google AI Studio](https://aistudio.google.com/), and [Qdrant Cloud](https://cloud.qdrant.io/).*

3. **Run the server:**
   ```bash
   npm start
   ```

4. **Open the app:**
   Navigate to `http://localhost:3000` in your web browser.

## License
This project is open-source and available under the MIT License.
