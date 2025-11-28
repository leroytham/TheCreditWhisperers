# app/services/sentiment_service.py
"""
Backward compatibility stub for sentiment service.

This module re-exports from the new sentiment package for backward compatibility.
All new code should import directly from app.services.sentiment.
"""

from app.services.sentiment import SentimentService, sentiment_service

__all__ = ['SentimentService', 'sentiment_service']

