# 🤖 AlphaAgent — AI Equity Research

![AlphaAgent Banner](https://img.shields.io/badge/AlphaAgent-AI%20Equity%20Research-6366f1?style=for-the-badge&logo=Chart.js&logoColor=white)
![Python](https://img.shields.io/badge/Python-3.10%2B-blue?style=flat-square&logo=python)
![Flask](https://img.shields.io/badge/Flask-3.x-black?style=flat-square&logo=flask)
![LangGraph](https://img.shields.io/badge/LangGraph-ReAct%20Agent-green?style=flat-square)
![License](https://img.shields.io/badge/License-MIT-yellow?style=flat-square)

> **AlphaAgent** is a professional AI-powered equity research tool that generates comprehensive **BUY / HOLD / SELL** reports for any stock in seconds — with live market data, news analysis, price charts, a personal watchlist, and multi-stock comparison.

---

## ✨ Features

| Feature | Description |
|---------|-------------|
| 🤖 **AI Agent** | LangGraph ReAct agent powered by Gemini 2.0 Flash (auto-falls back to Llama 3.3 via Groq) |
| 📊 **Live Data** | Real-time price, P/E ratio, market cap via Yahoo Finance |
| 📰 **News Search** | Latest company news crawled via DuckDuckGo |
| 📈 **Price Charts** | Interactive 3-month price history (Chart.js) with 1M/3M/6M/1Y period selector |
| ⭐ **Watchlist** | Save favorite stocks and re-analyze with one click |
| ⚖ **Compare Mode** | Analyze 2 stocks side-by-side with BUY/HOLD/SELL tab badges |
| 💾 **Auto-Save** | Every report saved as a `.md` file and shown in history sidebar |
| 🌐 **Web UI** | Premium dark-mode single-page app — no npm/build step needed |

---

## 🖥 Screenshot

> *(Add your own screenshot here)*

---

## 🚀 Quick Start

### 1. Clone the repo
```bash
git clone https://github.com/YOUR_USERNAME/AlphaAgent.git
cd AlphaAgent
```

### 2. Create a virtual environment
```bash
python -m venv venv

# Windows
.\venv\Scripts\activate

# Mac/Linux
source venv/bin/activate
```

### 3. Install dependencies
```bash
pip install -r requirements.txt
```

### 4. Set up your API keys
```bash
# Copy the example file
cp .env.example .env
```

Then open `.env` and fill in your keys:
```env
GEMINI_API_KEY="your_gemini_api_key_here"
GROQ_API_KEY="your_groq_api_key_here"
```

- 🔑 **Gemini key** → [aistudio.google.com/apikey](https://aistudio.google.com/apikey) *(Free)*
- 🔑 **Groq key** → [console.groq.com/keys](https://console.groq.com/keys) *(Free, used as fallback)*

### 5. Run the app
```bash
python api.py
```

Open your browser at **http://localhost:5000** 🎉

---

## 🛠 Project Structure

```
AlphaAgent/
├── api.py               # Flask API server (SSE streaming, chart, compare endpoints)
├── agent.py             # LangGraph ReAct agent setup (Gemini + Groq)
├── main.py              # CLI runner (alternative to web UI)
├── tools/
│   ├── finance_tools.py # yfinance + Google Finance data tools
│   └── search_tools.py  # DuckDuckGo + Google Finance news tools
├── frontend/
│   ├── index.html       # Single-page web app
│   ├── style.css        # Premium dark-mode design
│   └── app.js           # Chart.js, watchlist, SSE streaming logic
├── requirements.txt
├── .env.example         # Template — copy to .env and add your keys
└── .gitignore
```

---

## ⚙️ How It Works

```
User Input → Flask API → LangGraph ReAct Agent
                              ↓
                    Tool 1: get_stock_price()       ← Yahoo Finance
                    Tool 2: get_historical_prices() ← Yahoo Finance
                    Tool 3: get_stock_news()        ← DuckDuckGo
                    Tool 4: get_google_finance_quote()
                              ↓
                    LLM synthesizes all data
                              ↓
                    Final Report (BUY/HOLD/SELL) streamed to UI
```

**LLM Fallback:**
- Primary: **Gemini 2.0 Flash** (Google)
- Fallback: **Llama 3.3 70B** (Groq) — auto-switches if Gemini quota is exceeded

---

## 📦 Dependencies

```
langchain, langchain-core, langchain-google-genai
langchain-groq, langgraph
yfinance, ddgs
flask, python-dotenv
requests, beautifulsoup4
```

---

## ⚠️ Important

- **Never commit your `.env` file** — it contains your private API keys
- The free Gemini tier has daily limits; Groq fallback handles this automatically
- Analysis takes 60–90 seconds per stock (the agent makes multiple real API calls)

---

## 📄 License

MIT License — free to use, modify, and distribute.

---

## 🙏 Built With

- [LangGraph](https://github.com/langchain-ai/langgraph) — Agent framework
- [Google Gemini](https://aistudio.google.com) — Primary LLM
- [Groq](https://groq.com) — Fallback LLM (Llama 3.3)
- [yfinance](https://github.com/ranaroussi/yfinance) — Market data
- [Chart.js](https://www.chartjs.org) — Price charts
- [Flask](https://flask.palletsprojects.com) — Web server
