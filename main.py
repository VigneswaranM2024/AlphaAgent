import sys
import traceback
from agent import create_agent
from langchain_core.messages import HumanMessage, SystemMessage

def main():
    if len(sys.argv) < 2:
        print('Usage: python main.py "<Stock_Name_or_Ticker>"')
        print('Example: python main.py "Tata Motors"')
        return

    company_query = sys.argv[1]
    print(f"\\n--- Initiating AlphaAgent for: {company_query} ---\\n")
    
    # Agent initialization is deferred until execution time for gracefully handling fallbacks
    system_prompt = "You are a professional Equity Research Analyst. Your job is to research stocks, analyze the financial data and recent news, and produce a professional 'Buy/Hold/Sell' research report. Always use the provided tools to gather recent pricing, historical data, and current news before making your recommendation."
    
    prompt = f"""
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

    print("Agent is thinking... (this may take a minute or two as it searches and analyzes)\\n")
    
    try:
        agent_executor = create_agent(provider="gemini")
        # LangGraph invoke passes a state dict with messages
        messages_payload = {
            "messages": [
                SystemMessage(content=system_prompt),
                HumanMessage(content=prompt)
            ]
        }
        result = agent_executor.invoke(messages_payload)
        
    except Exception as e:
        error_msg = str(e).lower()
        if "429" in error_msg or "resource" in error_msg or "exhausted" in error_msg or "rate limit" in error_msg or "quota" in error_msg or "invalid" in error_msg:
            print(f"\\n[Fallback] Gemini API encountered an error (Rate Limit/Quota/Invalid Key): {e}")
            print("Falling back to Groq (llama-3.3-70b-versatile)...")
            try:
                agent_executor_groq = create_agent(provider="groq")
                result = agent_executor_groq.invoke(messages_payload)
            except Exception as e_fallback:
                print(f"\\nAn error occurred during fallback Groq agent execution: {e_fallback}")
                traceback.print_exc()
                return
        else:
            print(f"\\nAn error occurred during agent execution: {e}")
            traceback.print_exc()
            return
            
    try:
        # The final message is the agent's response
        raw_content = result["messages"][-1].content
        if isinstance(raw_content, list):
            # Gemini 2.5 sometimes returns a list of parts
            response = "".join(part.get("text", "") if isinstance(part, dict) else str(part) for part in raw_content)
        else:
            response = str(raw_content)
        
        print("\\n=======================================================\\n")
        print("FINAL REPORT:")
        print("=======================================================\\n")
        try:
            print(response)
        except UnicodeEncodeError:
            print(response.encode("ascii", errors="replace").decode("ascii"))
        
        filename = f"{company_query.replace(' ', '_')}_report.md"
        with open(filename, "w", encoding="utf-8") as f:
            f.write(response)
        print(f"\\nReport saved to {filename}")

    except Exception as e:
        print(f"\\nAn error parsing or saving the report: {e}")
        traceback.print_exc()

if __name__ == "__main__":
    main()
