#!/usr/bin/env python3
"""
Script to check the status of sector cache collections in MongoDB.
Shows document counts, recent entries, and cache effectiveness.
"""

import os
import sys
from pathlib import Path
from datetime import datetime, timedelta
import certifi
from pymongo import MongoClient, DESCENDING
from dotenv import load_dotenv
from tabulate import tabulate

# Add backend to path
backend_path = Path(__file__).parent.parent
sys.path.insert(0, str(backend_path))

# Load environment variables
load_dotenv(backend_path / '.env')


def connect_to_mongodb():
    """Connect to MongoDB."""
    mongo_uri = os.getenv('MONGO_URI', 'mongodb://localhost:27017')

    client = MongoClient(
        mongo_uri,
        tls=True,
        tlsCAFile=certifi.where(),
        serverSelectionTimeoutMS=5000
    )

    # Test connection
    client.admin.command('ping')
    return client


def format_size(bytes):
    """Format bytes to human readable size."""
    for unit in ['B', 'KB', 'MB', 'GB']:
        if bytes < 1024.0:
            return f"{bytes:.2f} {unit}"
        bytes /= 1024.0
    return f"{bytes:.2f} TB"


def check_sector_news_cache(db):
    """Check sector_news_cache collection status."""
    collection = db['sector_news_cache']

    stats = {
        'total_documents': collection.count_documents({}),
        'expired_documents': 0,
        'active_documents': 0,
        'sectors': set(),
        'timeframes': set(),
        'recent_entries': []
    }

    now = datetime.utcnow()

    # Count expired vs active
    stats['expired_documents'] = collection.count_documents({'expires_at': {'$lt': now}})
    stats['active_documents'] = collection.count_documents({'expires_at': {'$gte': now}})

    # Get unique sectors and timeframes
    for doc in collection.find({}, {'sector_key': 1, 'timeframe': 1}):
        stats['sectors'].add(doc.get('sector_key', 'unknown'))
        stats['timeframes'].add(doc.get('timeframe', 'unknown'))

    # Get recent entries
    for doc in collection.find().sort('created_at', DESCENDING).limit(5):
        stats['recent_entries'].append({
            'sector': doc.get('sector_key', 'unknown'),
            'timeframe': doc.get('timeframe', 'unknown'),
            'articles': doc.get('unique_articles', 0),
            'created': doc.get('created_at', datetime.min),
            'expires': doc.get('expires_at', datetime.max)
        })

    return stats


def check_sector_daily_sentiment(db):
    """Check sector_daily_sentiment collection status."""
    collection = db['sector_daily_sentiment']

    stats = {
        'total_documents': collection.count_documents({}),
        'sectors': set(),
        'date_range': {'oldest': None, 'newest': None},
        'recent_entries': [],
        'coverage': {}  # Days with data per sector
    }

    # Get unique sectors
    for doc in collection.find({}, {'sector_key': 1}):
        stats['sectors'].add(doc.get('sector_key', 'unknown'))

    # Get date range
    oldest = collection.find_one(sort=[('date', 1)])
    newest = collection.find_one(sort=[('date', -1)])

    if oldest:
        stats['date_range']['oldest'] = oldest.get('date', 'unknown')
    if newest:
        stats['date_range']['newest'] = newest.get('date', 'unknown')

    # Calculate coverage per sector
    for sector in stats['sectors']:
        count = collection.count_documents({'sector_key': sector})
        stats['coverage'][sector] = count

    # Get recent entries
    for doc in collection.find().sort('created_at', DESCENDING).limit(5):
        stats['recent_entries'].append({
            'sector': doc.get('sector_key', 'unknown'),
            'date': doc.get('date', 'unknown'),
            'sentiment': doc.get('sentiment_score', 0),
            'articles': doc.get('article_count', 0),
            'created': doc.get('created_at', datetime.min)
        })

    return stats


def check_news_articles_master(db):
    """Check news_articles_master collection status."""
    collection = db['news_articles_master']

    stats = {
        'total_articles': collection.count_documents({}),
        'unique_providers': set(),
        'date_range': {'oldest': None, 'newest': None},
        'recent_articles': []
    }

    # Get unique providers
    for doc in collection.find({}, {'provider': 1}).limit(1000):
        stats['unique_providers'].add(doc.get('provider', 'unknown'))

    # Get date range
    oldest = collection.find_one(sort=[('publish_date', 1)])
    newest = collection.find_one(sort=[('publish_date', -1)])

    if oldest:
        stats['date_range']['oldest'] = oldest.get('publish_date', 'unknown')
    if newest:
        stats['date_range']['newest'] = newest.get('publish_date', 'unknown')

    # Get recent articles
    for doc in collection.find().sort('created_at', DESCENDING).limit(5):
        stats['recent_articles'].append({
            'title': doc.get('title', 'unknown')[:50] + '...' if len(doc.get('title', '')) > 50 else doc.get('title', 'unknown'),
            'provider': doc.get('provider', 'unknown'),
            'publish_date': doc.get('publish_date', 'unknown'),
            'sentiment': doc.get('overall_sentiment_label', 'unknown')
        })

    return stats


def main():
    """Main execution function."""
    print("\n" + "="*80)
    print("MongoDB Sector Cache Status Report")
    print("="*80)
    print(f"Timestamp: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print(f"Environment: {os.getenv('ENV', 'development')}")

    # Connect to MongoDB
    print("\nConnecting to MongoDB...")
    try:
        client = connect_to_mongodb()
        print("✓ Connected to MongoDB")
    except Exception as e:
        print(f"✗ Failed to connect: {e}")
        return 1

    db = client["FYP"]

    # Check sector_news_cache
    print("\n" + "-"*80)
    print("1. SECTOR NEWS CACHE")
    print("-"*80)

    try:
        news_stats = check_sector_news_cache(db)
        print(f"Total Documents: {news_stats['total_documents']:,}")
        print(f"Active Caches: {news_stats['active_documents']:,}")
        print(f"Expired Caches: {news_stats['expired_documents']:,}")
        print(f"Unique Sectors: {len(news_stats['sectors'])}")
        print(f"Timeframes: {', '.join(sorted(news_stats['timeframes']))}")

        if news_stats['recent_entries']:
            print("\nRecent Entries:")
            table_data = []
            for entry in news_stats['recent_entries']:
                expires_in = entry['expires'] - datetime.utcnow()
                status = "Active" if expires_in.total_seconds() > 0 else "Expired"
                table_data.append([
                    entry['sector'],
                    entry['timeframe'],
                    entry['articles'],
                    entry['created'].strftime('%Y-%m-%d %H:%M'),
                    status
                ])
            print(tabulate(table_data, headers=['Sector', 'Timeframe', 'Articles', 'Created', 'Status']))

    except Exception as e:
        print(f"✗ Error checking sector_news_cache: {e}")

    # Check sector_daily_sentiment
    print("\n" + "-"*80)
    print("2. SECTOR DAILY SENTIMENT")
    print("-"*80)

    try:
        sentiment_stats = check_sector_daily_sentiment(db)
        print(f"Total Documents: {sentiment_stats['total_documents']:,}")
        print(f"Unique Sectors: {len(sentiment_stats['sectors'])}")

        if sentiment_stats['date_range']['oldest'] and sentiment_stats['date_range']['newest']:
            print(f"Date Range: {sentiment_stats['date_range']['oldest']} to {sentiment_stats['date_range']['newest']}")

        if sentiment_stats['coverage']:
            print("\nData Coverage by Sector:")
            coverage_data = [[sector, count] for sector, count in sorted(sentiment_stats['coverage'].items(), key=lambda x: x[1], reverse=True)]
            print(tabulate(coverage_data[:10], headers=['Sector', 'Days of Data']))

        if sentiment_stats['recent_entries']:
            print("\nRecent Sentiment Entries:")
            table_data = []
            for entry in sentiment_stats['recent_entries']:
                sentiment_emoji = "📈" if entry['sentiment'] > 0.05 else "📉" if entry['sentiment'] < -0.05 else "➖"
                table_data.append([
                    entry['sector'],
                    entry['date'],
                    f"{sentiment_emoji} {entry['sentiment']:.3f}",
                    entry['articles'],
                    entry['created'].strftime('%Y-%m-%d %H:%M')
                ])
            print(tabulate(table_data, headers=['Sector', 'Date', 'Sentiment', 'Articles', 'Created']))

    except Exception as e:
        print(f"✗ Error checking sector_daily_sentiment: {e}")

    # Check news_articles_master
    print("\n" + "-"*80)
    print("3. NEWS ARTICLES MASTER")
    print("-"*80)

    try:
        master_stats = check_news_articles_master(db)
        print(f"Total Articles: {master_stats['total_articles']:,}")
        print(f"Unique Providers: {len(master_stats['unique_providers'])}")

        if master_stats['date_range']['oldest'] and master_stats['date_range']['newest']:
            print(f"Article Date Range: {master_stats['date_range']['oldest']} to {master_stats['date_range']['newest']}")

        if master_stats['recent_articles']:
            print("\nRecent Articles:")
            table_data = []
            for article in master_stats['recent_articles']:
                sentiment_emoji = "🟢" if article['sentiment'] == 'Bullish' else "🔴" if article['sentiment'] == 'Bearish' else "⚪"
                table_data.append([
                    article['title'],
                    article['provider'],
                    article['publish_date'],
                    f"{sentiment_emoji} {article['sentiment']}"
                ])
            print(tabulate(table_data, headers=['Title', 'Provider', 'Date', 'Sentiment']))

    except Exception as e:
        print(f"✗ Error checking news_articles_master: {e}")

    # Collection sizes
    print("\n" + "-"*80)
    print("COLLECTION SIZES")
    print("-"*80)

    try:
        collections_info = []
        for coll_name in ['sector_news_cache', 'sector_daily_sentiment', 'news_articles_master']:
            try:
                stats = db.command('collStats', coll_name)
                collections_info.append([
                    coll_name,
                    stats.get('count', 0),
                    format_size(stats.get('size', 0)),
                    format_size(stats.get('avgObjSize', 0))
                ])
            except:
                collections_info.append([coll_name, 'N/A', 'N/A', 'N/A'])

        print(tabulate(collections_info, headers=['Collection', 'Documents', 'Total Size', 'Avg Doc Size']))

    except Exception as e:
        print(f"✗ Error getting collection sizes: {e}")

    print("\n" + "="*80)
    print("✓ Status check complete")

    client.close()
    return 0


if __name__ == "__main__":
    try:
        sys.exit(main())
    except KeyboardInterrupt:
        print("\n\n✗ Operation cancelled by user")
        sys.exit(1)
    except Exception as e:
        print(f"\n✗ Unexpected error: {e}")
        sys.exit(1)