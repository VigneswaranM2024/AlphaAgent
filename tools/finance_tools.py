import requests
from bs4 import BeautifulSoup
import yfinance as yf
from langchain_core.tools import tool

@tool
def get_stock_price(ticker: str) -> str:
    """Fetch the current stock price and standard financial metrics for a given ticker symbol. Use this to get live quotes, P/E ratio, and basic company information."""
    try:
        stock = yf.Ticker(ticker)
        info = stock.info
        
        current_price = info.get("currentPrice", info.get("regularMarketPrice", "N/A"))
        currency = info.get("currency", "USD")
        pe_ratio = info.get("trailingPE", "N/A")
        market_cap = info.get("marketCap", "N/A")
        industry = info.get("industry", "N/A")
        
        return f"Ticker: {ticker}\\nCurrent Price: {current_price} {currency}\\nP/E Ratio: {pe_ratio}\\nMarket Cap: {market_cap}\\nIndustry: {industry}"
    except Exception as e:
        return f"Error retrieving data for {ticker}: {str(e)}"

@tool
def get_historical_prices(ticker: str, period: str = "1mo") -> str:
    """Fetch historical stock prices for a given ticker. Period can be: 1d, 5d, 1mo, 3mo, 6mo, 1y, 2y, 5y, 10y, ytd, max."""
    try:
        stock = yf.Ticker(ticker)
        hist = stock.history(period=period)
        if hist.empty:
            return f"No historical data found for {ticker} over period {period}."
        
        # Format the output tightly to save context window space
        return hist[['Close']].to_string()
    except Exception as e:
        return f"Error retrieving historical data for {ticker}: {str(e)}"

@tool
def get_balance_sheet(ticker: str) -> str:
    """Fetch the latest balance sheet for a given ticker symbol. Use this to get information about a company's assets, liabilities, and equity."""
    try:
        stock = yf.Ticker(ticker)
        bs = stock.balance_sheet
        if bs is None or bs.empty:
            return f"No balance sheet data found for {ticker}."
        
        # Return stringified dataframe, limiting characters
        return bs.to_string()
    except Exception as e:
        return f"Error retrieving balance sheet for {ticker}: {str(e)}"

@tool
def get_google_finance_quote(ticker: str, exchange: str = "") -> str:
    """Fetch the current stock price and basic info from Google Finance. Provide an exchange if known (e.g. 'NASDAQ', 'NSE', 'BOM'), or leave empty for guessing."""
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
            if price_div:
                return f"Google Finance Quote for {ticker} ({exch or 'Unknown'}):\\nPrice: {price_div.text}"
        except Exception as e:
            continue
            
    return f"Could not find Google Finance quote for {ticker}."

@tool
def get_comprehensive_stock_info(ticker: str) -> dict:
    """
    Fetch comprehensive details for a given stock ticker including:
    - Financial Snapshot (Current Stock Price, Trailing P/E Ratio, Market Capitalization)
    - Short-term Price Trends (1-month percentage change)
    - Recent News (Titles and links of latest articles)
    """
    def fetch_data(symbol):
        stock = yf.Ticker(symbol)
        try:
            info = stock.info
            # Check if valid info was returned
            if info and ('currentPrice' in info or 'regularMarketPrice' in info or 'previousClose' in info):
                return stock, info
        except Exception:
            pass
        return None, None

    stock, info = fetch_data(ticker)

    # Handle potentially missing Indian suffixes
    if not stock and "." not in ticker:
        stock, info = fetch_data(ticker + ".NS")
        if stock:
            ticker = ticker + ".NS"
        else:
            stock, info = fetch_data(ticker + ".BO")
            if stock:
                ticker = ticker + ".BO"

    if not stock:
        return {"Error": f"Could not retrieve data for {ticker}. Please verify the ticker symbol."}
        
    result = {
        "Ticker": ticker,
        "Financial Snapshot": {
            "Current Stock Price": "N/A",
            "Trailing P/E Ratio": "N/A",
            "Market Capitalization": "N/A"
        },
        "Short-term Price Trends": {
            "1-Month Percentage Change": "N/A"
        },
        "Recent News": []
    }

    try:
        result["Financial Snapshot"]["Current Stock Price"] = info.get("currentPrice", info.get("regularMarketPrice", "N/A"))
        result["Financial Snapshot"]["Trailing P/E Ratio"] = info.get("trailingPE", "N/A")
        result["Financial Snapshot"]["Market Capitalization"] = info.get("marketCap", "N/A")
    except Exception:
        pass

    try:
        hist = stock.history(period="1mo")
        if not hist.empty and len(hist) >= 2:
            start_price = hist['Close'].iloc[0]
            end_price = hist['Close'].iloc[-1]
            pct_change = ((end_price - start_price) / start_price) * 100
            result["Short-term Price Trends"]["1-Month Percentage Change"] = f"{pct_change:.2f}%"
    except Exception:
        pass

    try:
        news = stock.news
        if news:
            # Get latest 5 news articles
            for article in news[:5]:
                # yfinance >= 0.2.x struct
                content = article.get("content", {})
                title = content.get("title", article.get("title", "N/A"))
                
                click_url = content.get("clickThroughUrl") or content.get("canonicalUrl") or {}
                link = click_url.get("url", article.get("link", "N/A"))
                
                result["Recent News"].append({
                    "Title": title,
                    "Link": link
                })
        if not result["Recent News"]:
            result["Recent News"] = "N/A"
    except Exception:
        result["Recent News"] = "N/A"

    return result
