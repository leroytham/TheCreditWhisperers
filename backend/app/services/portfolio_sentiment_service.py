# app/services/portfolio_sentiment_service.py
"""
Backward compatibility stub for portfolio sentiment service.

This module re-exports from the new portfolio_sentiment package for backward compatibility.
All new code should import directly from app.services.portfolio_sentiment.
"""

from app.services.portfolio_sentiment import PortfolioSentimentService, portfolio_sentiment_service

__all__ = ['PortfolioSentimentService', 'portfolio_sentiment_service']
