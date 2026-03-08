import os
import json
import glob
import threading
import queue
from flask import Flask, request, jsonify, send_from_directory, Response, stream_with_context
from agent import create_agent
from langchain_core.messages import HumanMessage, SystemMessage

app = Flask(__name__, static_folder='frontend', static_url_path='')

SYSTEM_PROMPT = (
    "You are a professional Equity Research Analyst. Your job is to research stocks, "
    "analyze the financial data and recent news, and produce a professional 'Buy/Hold/Sell' "
    "research report. Always use the provided tools to gather recent pricing, historical data, "
    "and current news before making your recommendation."
)

def build_prompt(company_query: str) -> str:
    return f"""
Please provide a comprehensive equity research report for '{company_query}'.

1. First, find its proper stock ticker if you were only given a name.
2. Then, fetch its current stock price and key financial metrics (like P/E).
3. Look at its historical price trend over the last 1-3 months.
4. Search the web for the latest breaking news related to the company.
5. Synthesize all this information into a final report using the following markdown format:

# Equity Research Report: [Company Name] ([Ticker])

## 1. Financial Snapshot
[Include price, P/E, market cap, and short-term trend]

## 2. Recent News & Sentiment
[Summarize the key events from the web search]

## 3. Analysis & Recommendation
[Your analytical reasoning]

**Final Rating:** [BUY / HOLD / SELL]
"""

def run_agent_stream(company_query: str, out_q: queue.Queue):
    """Runs the agent in a thread, pushing SSE-formatted strings into out_q."""
    try:
        agent_executor = create_agent(provider="gemini")
    except Exception:
        try:
            agent_executor = create_agent(provider="groq")
        except Exception as e:
            out_q.put(f"data: {json.dumps({'type': 'error', 'content': str(e)})}\n\n")
            out_q.put(None)
            return

    messages_payload = {
        "messages": [
            SystemMessage(content=SYSTEM_PROMPT),
            HumanMessage(content=build_prompt(company_query))
        ]
    }

    full_response = ""
    provider_used = "gemini"

    def _stream(executor, prov):
        nonlocal full_response, provider_used
        provider_used = prov
        for chunk in executor.stream(messages_payload):
            # LangGraph stream yields dicts with node names as keys
            for node_name, node_output in chunk.items():
                msgs = node_output.get("messages", [])
                for msg in msgs:
                    content = msg.content
                    if isinstance(content, list):
                        content = "".join(
                            part.get("text", "") if isinstance(part, dict) else str(part)
                            for part in content
                        )
                    if content:
                        full_response = content  # keep latest full message
                        out_q.put(
                            f"data: {json.dumps({'type': 'token', 'content': content})}\n\n"
                        )

    try:
        _stream(agent_executor, "gemini")
    except Exception as e:
        err = str(e).lower()
        if any(k in err for k in ["429", "quota", "exhausted", "rate limit", "resource", "invalid"]):
            out_q.put(f"data: {json.dumps({'type': 'status', 'content': 'Gemini quota hit — switching to Groq...'})}\n\n")
            full_response = ""
            try:
                groq_executor = create_agent(provider="groq")
                _stream(groq_executor, "groq")
            except Exception as e2:
                out_q.put(f"data: {json.dumps({'type': 'error', 'content': str(e2)})}\n\n")
                out_q.put(None)
                return
        else:
            out_q.put(f"data: {json.dumps({'type': 'error', 'content': str(e)})}\n\n")
            out_q.put(None)
            return

    # Save the final report
    if full_response:
        filename = f"{company_query.strip().replace(' ', '_')}_report.md"
        filepath = os.path.join(os.path.dirname(__file__), filename)
        try:
            with open(filepath, "w", encoding="utf-8") as f:
                f.write(full_response)
            out_q.put(f"data: {json.dumps({'type': 'saved', 'filename': filename})}\n\n")
        except Exception as e:
            out_q.put(f"data: {json.dumps({'type': 'warning', 'content': f'Could not save report: {e}'})}\n\n")

    out_q.put(f"data: {json.dumps({'type': 'done'})}\n\n")
    out_q.put(None)  # sentinel


# ────────────────────────────────────────────────────────────
# Routes
# ────────────────────────────────────────────────────────────

@app.route('/')
def index():
    return send_from_directory('frontend', 'index.html')

@app.route('/api/analyze', methods=['POST'])
def analyze():
    data = request.get_json(force=True)
    query = (data or {}).get('query', '').strip()
    if not query:
        return jsonify({'error': 'No query provided'}), 400

    out_q = queue.Queue()
    t = threading.Thread(target=run_agent_stream, args=(query, out_q), daemon=True)
    t.start()

    def generate():
        while True:
            item = out_q.get()
            if item is None:
                break
            yield item

    return Response(
        stream_with_context(generate()),
        mimetype='text/event-stream',
        headers={
            'Cache-Control': 'no-cache',
            'X-Accel-Buffering': 'no',
        }
    )

@app.route('/api/reports', methods=['GET'])
def list_reports():
    base = os.path.dirname(__file__)
    files = sorted(
        glob.glob(os.path.join(base, '*_report.md')),
        key=os.path.getmtime,
        reverse=True
    )
    reports = []
    for f in files:
        name = os.path.basename(f)
        company = name.replace('_report.md', '').replace('_', ' ')
        mtime = os.path.getmtime(f)
        reports.append({'filename': name, 'company': company, 'mtime': mtime})
    return jsonify(reports)

@app.route('/api/reports/<path:filename>', methods=['GET'])
def get_report(filename):
    base = os.path.dirname(__file__)
    filepath = os.path.join(base, filename)
    if not os.path.isfile(filepath) or not filename.endswith('_report.md'):
        return jsonify({'error': 'Report not found'}), 404
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()
    return jsonify({'filename': filename, 'content': content})


@app.route('/api/chart/<path:ticker>', methods=['GET'])
def get_chart(ticker):
    """Return price history for Chart.js rendering. Resolves full names → tickers."""
    import yfinance as yf
    period = request.args.get('period', '3mo')

    # Common Indian stock name → NSE ticker map
    KNOWN = {
        "infosys": "INFY.NS", "tcs": "TCS.NS", "wipro": "WIPRO.NS",
        "hdfc bank": "HDFCBANK.NS", "hdfc": "HDFCBANK.NS",
        "icici bank": "ICICIBANK.NS", "icici": "ICICIBANK.NS",
        "reliance": "RELIANCE.NS", "sbi": "SBIN.NS",
        "bajaj finance": "BAJFINANCE.NS", "hcl": "HCLTECH.NS",
        "adani": "ADANIENT.NS", "siemens": "SIEMENS.NS",
        "morepen": "MOREPEN.NS", "bharti airtel": "BHARTIARTL.NS",
        "airtel": "BHARTIARTL.NS", "axis bank": "AXISBANK.NS",
        "kotak": "KOTAKBANK.NS", "maruti": "MARUTI.NS",
        "tesla": "TSLA", "apple": "AAPL", "microsoft": "MSFT",
        "google": "GOOGL", "amazon": "AMZN", "meta": "META",
        "nvidia": "NVDA", "netflix": "NFLX",
    }

    def try_ticker(sym):
        try:
            s = yf.Ticker(sym)
            h = s.history(period=period)
            return (s, h) if not h.empty else (None, None)
        except Exception:
            return None, None

    # 1. Check known map first
    key = ticker.strip().lower()
    if key in KNOWN:
        stock, hist = try_ticker(KNOWN[key])
        if stock and not hist.empty:
            ticker = KNOWN[key]
        else:
            stock, hist = None, None
    else:
        stock, hist = None, None

    # 2. Try raw ticker
    if stock is None or hist is None or hist.empty:
        stock, hist = try_ticker(ticker)

    # 3. Try .NS and .BO suffixes
    if (stock is None or hist is None or hist.empty) and '.' not in ticker:
        for suffix in ['.NS', '.BO']:
            stock, hist = try_ticker(ticker + suffix)
            if stock and not hist.empty:
                ticker = ticker + suffix
                break

    # 4. Try yfinance search to resolve full company names
    if (stock is None or hist is None or hist.empty):
        try:
            results = yf.Search(ticker, max_results=3).quotes
            for r in results:
                sym = r.get('symbol', '')
                if sym:
                    stock, hist = try_ticker(sym)
                    if stock and not hist.empty:
                        ticker = sym
                        break
        except Exception:
            pass

    if stock is None or hist is None or hist.empty:
        return jsonify({'error': f'No price data found for "{ticker}". Try the exact ticker symbol (e.g. INFY.NS, TSLA).'}), 404

    labels = [str(d.date()) for d in hist.index]
    prices = [round(float(p), 2) for p in hist['Close'].tolist()]
    return jsonify({'ticker': ticker, 'labels': labels, 'prices': prices})



def run_compare_stream(tickers: list, out_q: queue.Queue):
    """Runs single-stock agent for each ticker sequentially, streaming progress via SSE."""
    def sse(obj):
        return f"data: {json.dumps(obj)}\n\n"

    def invoke_agent(query):
        """Try Gemini, fall back to Groq, return final markdown or raise."""
        messages_payload = {
            "messages": [
                SystemMessage(content=SYSTEM_PROMPT),
                HumanMessage(content=build_prompt(query))
            ]
        }
        def _try(provider):
            executor = create_agent(provider=provider)
            result = executor.invoke(messages_payload)
            raw = result["messages"][-1].content
            if isinstance(raw, list):
                return "".join(p.get("text", "") if isinstance(p, dict) else str(p) for p in raw)
            return str(raw)

        try:
            return _try("gemini")
        except Exception as e:
            err = str(e).lower()
            if any(k in err for k in ["429", "quota", "exhausted", "rate limit", "resource", "invalid"]):
                return _try("groq")
            raise

    for i, ticker in enumerate(tickers):
        out_q.put(sse({'type': 'compare_status', 'ticker': ticker,
                        'index': i, 'total': len(tickers)}))
        try:
            report = invoke_agent(ticker)
            # save report
            filename = f"{ticker.strip().replace(' ', '_')}_report.md"
            try:
                with open(os.path.join(os.path.dirname(__file__), filename), 'w', encoding='utf-8') as f:
                    f.write(report)
            except Exception:
                pass
            out_q.put(sse({'type': 'compare_result', 'ticker': ticker,
                            'report': report, 'filename': filename}))
        except Exception as e:
            out_q.put(sse({'type': 'compare_error', 'ticker': ticker, 'error': str(e)}))

    out_q.put(sse({'type': 'compare_done'}))
    out_q.put(None)


@app.route('/api/compare', methods=['POST'])
def compare():
    data = request.get_json(force=True) or {}
    tickers = [t.strip() for t in data.get('tickers', []) if t.strip()]
    if not tickers or len(tickers) < 2:
        return jsonify({'error': 'Provide at least 2 tickers'}), 400
    if len(tickers) > 3:
        tickers = tickers[:3]

    out_q = queue.Queue()
    t = threading.Thread(target=run_compare_stream, args=(tickers, out_q), daemon=True)
    t.start()

    def generate():
        while True:
            item = out_q.get()
            if item is None:
                break
            yield item

    return Response(
        stream_with_context(generate()),
        mimetype='text/event-stream',
        headers={'Cache-Control': 'no-cache', 'X-Accel-Buffering': 'no'}
    )


if __name__ == '__main__':
    print("Starting AlphaAgent API server at http://localhost:5000")
    app.run(debug=False, port=5000, threaded=True)

