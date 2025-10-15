# app/api/routes.py
from fastapi import APIRouter, HTTPException
# ... other imports

# Import the shared instance of your new service
from app.services.news_service import news_service_instance
from app.services.data_processing_service import data_service_instance

# Create an instance of the API Router. All endpoints will be attached to this.
router = APIRouter()

# --- Example of a GET endpoint for categorized news ---
@router.get("/news/{ticker}/categorized")
def get_categorized_news_for_ticker(ticker: str, start_date: str, end_date: str):
    """
    API endpoint to fetch and categorize news for a given ticker and date range.
    Example: /news/AAPL/categorized?start_date=2023-10-01&end_date=2023-10-15
    """
    try:
        # The API layer calls the service to do the heavy lifting.
        categorized_news = news_service_instance.get_categorized_news(ticker, start_date, end_date)
        
        # Convert the list of News objects into a JSON-friendly format for the response
        response_data = [
            {
                "headline": news.headline,
                "source": news.source,
                "sentiment": {
                    "value": news.sentiment_score.value,
                    "label": news.sentiment_score.label, # Using our model's property!
                    "source": news.sentiment_score.source,
                    "timestamp": news.sentiment_score.timestamp,
                }
            }
            for news in categorized_news
        ]
        return response_data
    except Exception as e:
        # Catch potential errors from yfinance or the model
        raise HTTPException(status_code=500, detail=f"An error occurred: {str(e)}")
    
@router.get("/stocks/{ticker}/historical-data")
def get_historical_stock_data(ticker: str, timeframe: str = "1M"):
    """
    API endpoint to get historical stock data for a given ticker and timeframe.
    Example: /stocks/AAPL/historical-data?timeframe=3M
    """
    try:
        # 1. Fetch 1 year of data from the service
        full_data = data_service_instance.get_stock_data(ticker)
        if full_data is None:
            raise HTTPException(status_code=404, detail=f"Data not found for ticker {ticker}")

        # 2. Filter data based on the requested timeframe
        filtered_data = data_service_instance.filter_data_by_timeframe(full_data, timeframe)
        
        # 3. Convert DataFrame to JSON for the response
        # We reset the index to make the 'Date' a regular column
        json_data = filtered_data.reset_index().to_dict(orient="records")
        return {"ticker": ticker, "timeframe": timeframe, "data": json_data}

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/stocks/{ticker}/sentiment")
def get_stock_news_and_sentiment(ticker: str):
    """
    API endpoint to get recent news and its advanced, weighted FinBERT sentiment analysis.
    Example: /stocks/TSLA/sentiment
    """
    try:
        # 1. Fetch recent news using the service
        news_articles = data_service_instance.get_ticker_news(ticker)
        if not news_articles:
            return {"ticker": ticker, "message": "No recent news found."}

        # 2. Call the NEW advanced sentiment analysis method
        sentiment_results = data_service_instance.analyze_sentiment_with_weights(news_articles)
        
        # 3. Return the rich data structure from the new method
        return {"ticker": ticker, **sentiment_results}

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    
@router.get("/sectors/{sector_ticker}/top-constituents")
def get_top_constituents_for_sector(sector_ticker: str):
    """
    API endpoint to get the top 10 constituents for a given sector.
    The sector_ticker must be URL-encoded if it contains special characters.
    Example: /sectors/%5EGSP500-45/top-constituents (for ^SP500-45)
    """
    try:
        # The API layer calls the service to perform the logic
        constituents = data_service_instance.get_sector_top_constituents(sector_ticker)
        
        if not constituents:
             return {"sector_ticker": sector_ticker, "constituents": []}
             
        return {"sector_ticker": sector_ticker, "constituents": constituents}
        
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"An internal error occurred: {str(e)}")
    
@router.get("/stocks/{ticker}/significant-events")
def get_significant_events_for_ticker(ticker: str):
    """
    API endpoint to analyze historical data for a stock, identify the top 5
    most significant price moves, and find correlated news for those events.
    Example: /stocks/NVDA/significant-events
    """
    try:
        # The API layer makes a single call to the service
        events_with_news = data_service_instance.analyze_significant_events(ticker)
        
        if not events_with_news:
            return {"ticker": ticker, "message": "No significant events found matching the criteria."}
            
        return {"ticker": ticker, "events": events_with_news}
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"An internal error occurred: {str(e)}")
