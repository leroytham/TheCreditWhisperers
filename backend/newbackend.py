from yahooquery import Ticker

newsTickerOverrides = {
    '^SP500-25': 'XLY',   # Consumer Discretionary
    '^SP500-30': 'XLP',   # Consumer Staples
    '^SP500-35': 'XLV',   # Health Care
    '^SP500-40': 'XLF',   # Financials
    '^SP500-45': 'XLK',   # Tech
    '^SP500-50': 'XLC',   # Communication Services
    '^SP500-55': 'XLU',   # Utilities
    '^SP500-60': 'XLRE',  # Real Estate
    '^SP500-15': 'XLB',   # Materials
    '^SP500-20': 'XLI',   # Industrials
    '^GSPE': 'XLE',       # Energy
}

def get_top_constituents(sector_ticker):
    if sector_ticker not in newsTickerOverrides:
        print("Invalid sector ticker.")
        return []

    etf_ticker = newsTickerOverrides[sector_ticker]
    print(f"\nFetching top constituents for {sector_ticker} ({etf_ticker})...")

    etf = Ticker(etf_ticker)
    holdings_data = etf.fund_holding_info

    if not holdings_data or "holdings" not in holdings_data.get(etf_ticker, {}):
        print("No holdings data found for this ETF.")
        return []

    holdings = holdings_data[etf_ticker]["holdings"]

    # Take top 10 holdings
    top_symbols = [h.get("symbol") for h in holdings[:10] if h.get("symbol")]

    # Batch request for faster price lookup
    price_data = Ticker(top_symbols).price

    top_constituents = []
    for h in holdings[:10]:
        symbol = h.get("symbol")
        if not symbol:
            continue

        p = price_data.get(symbol, {})
        reg_price = p.get("regularMarketPrice")
        change_pct = p.get("regularMarketChangePercent")
        name = p.get("shortName") or h.get("holdingName")

        top_constituents.append({
            "symbol": symbol,
            "name": name,
            "price": reg_price,
            "percentChange": change_pct,
            "percentOfAssets": h.get("holdingPercent"),
        })

    return top_constituents


if __name__ == "__main__":
    sector = input("Enter sector ticker (e.g. ^SP500-45 for Tech): ").strip()
    results = get_top_constituents(sector)

    if results:
        print("\nTop Constituents:")
        for i, r in enumerate(results, 1):
            print(f"{i}. {r['name']} ({r['symbol']})")
            print(f"   Price: ${r['price']}, Day Change: {r['percentChange']}%, Weight: {r['percentOfAssets']}%")
