import os
from dotenv import load_dotenv
from langchain_google_genai import ChatGoogleGenerativeAI
from langchain_groq import ChatGroq
from langgraph.prebuilt import create_react_agent
from tools.finance_tools import get_stock_price, get_historical_prices, get_balance_sheet, get_google_finance_quote, get_comprehensive_stock_info
from tools.search_tools import get_stock_news, get_google_finance_news

load_dotenv()


def create_agent(provider="gemini"):
    if provider == "gemini":
        if not os.getenv("GEMINI_API_KEY") or os.getenv("GEMINI_API_KEY") == "your_api_key_here":
            raise ValueError("Please set GEMINI_API_KEY in the .env file")
        
        llm = ChatGoogleGenerativeAI(
            model="gemini-2.0-flash", 
            temperature=0
        )
    elif provider == "groq":
        if not os.getenv("GROQ_API_KEY") or os.getenv("GROQ_API_KEY") == "your_api_key_here":
            raise ValueError("Please set GROQ_API_KEY in the .env file")
            
        llm = ChatGroq(
            model="llama-3.3-70b-versatile",
            temperature=0
        )
    else:
        raise ValueError(f"Unknown provider: {provider}")

    tools = [
        get_comprehensive_stock_info
    ]

    # create_react_agent from langgraph automatically binds tools and sets up the reasoning loop.
    agent_executor = create_react_agent(model=llm, tools=tools)
    
    return agent_executor
