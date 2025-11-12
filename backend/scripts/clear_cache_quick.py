#!/usr/bin/env python3
"""
Quick script to clear sector cache collections without prompts.
Useful for automated scripts or development workflows.
"""

import os
import sys
from pathlib import Path
from datetime import datetime
import certifi
from pymongo import MongoClient
from dotenv import load_dotenv

# Add backend to path
backend_path = Path(__file__).parent.parent
sys.path.insert(0, str(backend_path))

# Load environment variables
load_dotenv(backend_path / '.env')


def clear_caches(include_master=False):
    """Clear sector cache collections quickly without prompts."""
    mongo_uri = os.getenv('MONGO_URI', 'mongodb://localhost:27017')

    # Connect to MongoDB
    client = MongoClient(
        mongo_uri,
        tls=True,
        tlsCAFile=certifi.where(),
        serverSelectionTimeoutMS=5000
    )

    db = client["FYP"]

    # Collections to clear
    collections = ["sector_news_cache", "sector_daily_sentiment"]
    if include_master:
        collections.append("news_articles_master")

    results = {}
    for collection_name in collections:
        try:
            collection = db[collection_name]
            count_before = collection.count_documents({})
            result = collection.delete_many({})
            results[collection_name] = {
                'before': count_before,
                'deleted': result.deleted_count
            }
        except Exception as e:
            results[collection_name] = {'error': str(e)}

    client.close()
    return results


if __name__ == "__main__":
    import argparse

    parser = argparse.ArgumentParser(description='Quick clear MongoDB sector caches')
    parser.add_argument('--include-master', action='store_true',
                        help='Also clear news_articles_master collection')
    parser.add_argument('--silent', action='store_true',
                        help='Run silently without output')

    args = parser.parse_args()

    if not args.silent:
        print(f"[{datetime.now().strftime('%Y-%m-%d %H:%M:%S')}] Clearing sector caches...")

    results = clear_caches(include_master=args.include_master)

    if not args.silent:
        for collection, result in results.items():
            if 'error' in result:
                print(f"  ✗ {collection}: Error - {result['error']}")
            else:
                print(f"  ✓ {collection}: Deleted {result['deleted']} of {result['before']} documents")

    # Exit with error code if any collection failed
    sys.exit(1 if any('error' in r for r in results.values()) else 0)