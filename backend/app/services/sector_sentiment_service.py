# app/services/sector_sentiment_service.py
"""
Backward compatibility stub for sector sentiment service.

This module re-exports from the new sector package for backward compatibility.
All new code should import directly from app.services.sector.
"""

from app.services.sector import SectorSentimentService, sector_sentiment_service

__all__ = ['SectorSentimentService', 'sector_sentiment_service']
