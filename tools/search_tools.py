import requests
from bs4 import BeautifulSoup
from ddgs import DDGS
from langchain_core.tools import tool

@tool
def get_stock_news(query: str) -> str:
    """Search DuckDuckGo for the latest news related to a stock or company. Example queries: 'Apple news', 'AAPL stock latest'. """
    try:
        results = DDGS().text(query, max_results=5)
        if not results:
            return f"No news found for query: {query}"
        
        formatted_results = []
        for r in results:
            title = r.get('title', 'No Title')
            body = r.get('body', 'No Content')
            date = r.get('date', 'Unknown Date')
            formatted_results.append(f"[{date}] {title}\\nSummary: {body}")
        
        return "\\n\\n---\\n\\n".join(formatted_results)
    except Exception as e:
         return f"Error searching news for {query}: {str(e)}"

@tool
def get_google_finance_news(ticker: str, exchange: str = "") -> str:
    """Scrape the latest news directly from Google Finance for the given ticker. Provide an exchange if known (e.g. 'NASDAQ', 'NSE', 'BOM'), or leave empty for guessing."""
    headers = {"User-Agent": "Mozilla/5.0"}
    exchanges = [exchange] if exchange else ["NASDAQ", "NYSE", "NSE", "BOM"]
    
    for exch in exchanges:
        url = f"https://www.google.com/finance/quote/{ticker}:{exch}" if exch else f"https://www.google.com/finance/quote/{ticker}"
        try:
            resp = requests.get(url, headers=headers)
            if resp.status_code != 200:
                continue
            
            soup = BeautifulSoup(resp.text, 'html.parser')
            price_div = soup.find('div', class_='YMlKec fxKbKc')
            if not price_div:
                continue # not a valid quote page
                
            news_items = soup.find_all('div', class_='Yfwt5')
            if not news_items:
               return f"No news found for {ticker} on Google Finance."
               
            formatted_news = []
            for n in news_items[:5]:
                formatted_news.append(f"- {n.text.strip()}")
                
            return f"Google Finance News for {ticker}:\\n" + "\\n".join(formatted_news)
        except Exception as e:
            continue
            
    return f"Could not find Google Finance news for {ticker}."
