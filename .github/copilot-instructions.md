# Copilot / AI Assistant Instructions for AlphaAgent

Purpose: Help AI coding agents be immediately productive in this repository by describing architecture, key workflows, conventions, and actionable examples.

- **Big picture:** AlphaAgent is a small equity-research assistant built around a LangChain-style agent. The main flow:
  - `main.py` prepares prompts and invokes the agent executor returned by `agent.create_agent()`.
  - `agent.py` wires a Google Gemini LLM (`ChatGoogleGenerativeAI`) into a LangGraph `create_react_agent(...)` with a set of tool functions.
  - Tool implementations live in `tools/` and are decorated with `@tool` from `langchain_core.tools` so the agent can call them.

- **Key files to inspect:**
  - [AlphaAgent/main.py](AlphaAgent/main.py) — CLI entry, example usage: `python main.py "Tata Motors"` and how response is saved to `<query>_report.md`.
  - [AlphaAgent/agent.py](AlphaAgent/agent.py) — constructs the LLM, registers tools, and returns the `agent_executor`.
  - [AlphaAgent/tools/finance_tools.py](AlphaAgent/tools/finance_tools.py) — `get_stock_price` and `get_historical_prices` (yfinance usage; historical output uses `to_string()`).
  - [AlphaAgent/tools/search_tools.py](AlphaAgent/tools/search_tools.py) — `get_stock_news` (duckduckgo-search, returns summarized title/body/date blocks).
  - [AlphaAgent/requirements.txt](AlphaAgent/requirements.txt) — install dependencies (`langchain`, `langchain-google-genai`, `yfinance`, `duckduckgo-search`, `python-dotenv`).

- **Environment & startup:**
  - A `.env` with `GEMINI_API_KEY` is required. `agent.create_agent()` raises a `ValueError` if missing.
  - Example run: `python main.py "Tata Motors"` — `main.py` constructs a `SystemMessage` and `HumanMessage` and calls `agent_executor.invoke({"messages": [...]})`.

- **Agent/tooling patterns (project-specific):**
  - Tools are Python callables decorated with `@tool` from `langchain_core.tools`. They accept primitive args and return strings (not dicts).
  - Keep tool outputs concise and machine-readable where possible; `get_historical_prices` returns a compact `pandas.DataFrame.to_string()` to limit token usage.
  - `create_react_agent(...)` in `agent.py` binds tools automatically — do not re-wrap or re-decorate tools when adding new ones.
  - The LLM is configured with `temperature=0` to favor deterministic outputs — preserve that pattern unless intentionally changing behavior.

- **Error handling and expected shapes:**
  - Tools return human-readable strings and catch exceptions, returning an error message string; agent logic expects string outputs.
  - `agent_executor.invoke(...)` returns a dict with a `messages` list; the final content may be a string or a list of parts (see `main.py` handling for Gemini 2.5).

- **Adding features / tools:**
  - Add a new tool under `tools/` and decorate with `@tool`. Keep signature simple (primitive types or small strings). Example:
    - `@tool\ndef get_income_statement(ticker: str) -> str:`
    - Return a compact text summary or CSV-like rows; avoid huge JSON blobs.
  - Register the tool by importing it in `agent.py` and adding it to the `tools = [...]` list.

- **Build / test / debug workflows:**
  - No test suite present; use local runs to validate behavior. Typical debug loop:
    1. Ensure `.env` contains `GEMINI_API_KEY`.
    2. `pip install -r requirements.txt` in a Python 3.10+ virtualenv.
    3. Run `python main.py "Some Company"` and inspect the printed output and generated `<query>_report.md`.
  - For tool-level debugging, run the function directly in the REPL or a short script to verify `yfinance`/`DDGS` outputs.

- **Conventions & constraints discovered from codebase:**
  - Tool outputs must be stringified; code depends on that.
  - Minimal state passing: the agent is stateless between runs. All context comes via LLM messages and tool outputs.
  - Filenames for saved reports: `<query>_report.md` created in the current working directory by `main.py`.

- **Integration points / external dependencies:**
  - Gemini model via `langchain-google-genai` (env var `GEMINI_API_KEY`).
  - `yfinance` for financials and historical data.
  - `duckduckgo-search` (DDGS) for quick news snippets.

- **Do not change without confirmation:**
  - The LLM configuration (`model="gemini-2.5-flash", temperature=0`) — changing model/temperature meaningfully changes output style.
  - The `@tool` signature and return type conventions — the agent assumes strings.

If any section is unclear or you'd like additional examples (unit-test skeletons, a sample `.env.example`, or a tool stub), tell me which part to expand and I will iterate.
