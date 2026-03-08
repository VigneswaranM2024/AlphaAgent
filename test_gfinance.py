import requests
from bs4 import BeautifulSoup

def test_redirect(query):
    # Trying the search endpoint
    url = f"https://www.google.com/finance/quote/{query}"
    headers = {"User-Agent": "Mozilla/5.0"}
    resp = requests.get(url, headers=headers)
    print("URL:", url, "Status:", resp.status_code)
    
    soup = BeautifulSoup(resp.text, 'html.parser')
    price_div = soup.find('div', class_='YMlKec fxKbKc')
    print("Price:", price_div.text if price_div else "Not found")

if __name__ == "__main__":
    test_redirect("MOREPENLAB:NSE")
    test_redirect("MOREPENLAB:BOM")
    test_redirect("AAPL:NASDAQ")
