#!/usr/bin/env python3
"""
Script to clear sector cache collections in MongoDB.
Clears both sector_news_cache and sector_daily_sentiment collections.
"""

import os
import sys
from pathlib import Path
from datetime import datetime
import certifi
from pymongo import MongoClient
from pymongo.errors import ConnectionFailure, OperationFailure
from dotenv import load_dotenv

# Add backend to path to use existing configuration
backend_path = Path(__file__).parent.parent
sys.path.insert(0, str(backend_path))

# Load environment variables
load_dotenv(backend_path / '.env')


def connect_to_mongodb():
    """Establish connection to MongoDB using configuration from environment."""
    mongo_uri = os.getenv('MONGO_URI', 'mongodb://localhost:27017')

    try:
        # Use the same connection pattern as your existing code
        client = MongoClient(
            mongo_uri,
            tls=True,
            tlsCAFile=certifi.where(),
            serverSelectionTimeoutMS=5000
        )

        # Test connection
        client.admin.command('ping')
        print(f"✓ Successfully connected to MongoDB")
        return client

    except ConnectionFailure as e:
        print(f"✗ Failed to connect to MongoDB: {e}")
        return None
    except Exception as e:
        print(f"✗ Unexpected error connecting to MongoDB: {e}")
        return None


def clear_collection(db, collection_name):
    """Clear a specific collection and return the number of deleted documents."""
    try:
        collection = db[collection_name]

        # Count documents before deletion
        count_before = collection.count_documents({})

        if count_before == 0:
            print(f"  → {collection_name}: Already empty (0 documents)")
            return 0

        # Delete all documents
        result = collection.delete_many({})
        deleted_count = result.deleted_count

        # Verify deletion
        count_after = collection.count_documents({})

        if count_after == 0:
            print(f"  ✓ {collection_name}: Cleared {deleted_count:,} documents successfully")
        else:
            print(f"  ⚠ {collection_name}: Deleted {deleted_count:,} documents, but {count_after:,} remain")

        return deleted_count

    except OperationFailure as e:
        print(f"  ✗ Failed to clear {collection_name}: {e}")
        return 0
    except Exception as e:
        print(f"  ✗ Unexpected error clearing {collection_name}: {e}")
        return 0


def get_collection_stats(db, collection_name):
    """Get statistics for a collection before clearing."""
    try:
        collection = db[collection_name]
        stats = {
            'count': collection.count_documents({}),
            'estimated_size': 0
        }

        # Try to get collection stats (may require additional permissions)
        try:
            coll_stats = db.command('collStats', collection_name)
            stats['estimated_size'] = coll_stats.get('size', 0)
        except:
            pass

        return stats
    except:
        return {'count': 0, 'estimated_size': 0}


def format_size(bytes):
    """Format bytes to human readable size."""
    for unit in ['B', 'KB', 'MB', 'GB']:
        if bytes < 1024.0:
            return f"{bytes:.2f} {unit}"
        bytes /= 1024.0
    return f"{bytes:.2f} TB"


def main():
    """Main execution function."""
    print("\n" + "="*60)
    print("MongoDB Sector Cache Cleaner")
    print("="*60)
    print(f"Timestamp: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print(f"Environment: {os.getenv('ENV', 'development')}")

    # Connect to MongoDB
    print("\nConnecting to MongoDB...")
    client = connect_to_mongodb()

    if not client:
        print("\n✗ Cannot proceed without database connection")
        return 1

    # Use the FYP database (as configured in your app)
    db = client["FYP"]
    print(f"✓ Using database: FYP")

    # Collections to clear
    collections_to_clear = [
        "sector_news_cache",
        "sector_daily_sentiment"
    ]

    # Show current statistics
    print("\n" + "-"*60)
    print("Current Collection Statistics:")
    print("-"*60)

    total_docs = 0
    total_size = 0

    for collection_name in collections_to_clear:
        stats = get_collection_stats(db, collection_name)
        total_docs += stats['count']
        total_size += stats['estimated_size']

        print(f"  {collection_name}:")
        print(f"    Documents: {stats['count']:,}")
        if stats['estimated_size'] > 0:
            print(f"    Size: {format_size(stats['estimated_size'])}")

    if total_docs == 0:
        print("\n✓ All collections are already empty!")
        return 0

    print(f"\n  Total documents to clear: {total_docs:,}")
    if total_size > 0:
        print(f"  Total size to free: {format_size(total_size)}")

    # Ask for confirmation
    print("\n" + "-"*60)
    print("⚠ WARNING: This action will DELETE all cached sector data!")
    print("  Collections to be cleared:")
    for collection_name in collections_to_clear:
        print(f"    - {collection_name}")
    print("-"*60)

    response = input("\nAre you sure you want to proceed? (yes/no): ").strip().lower()

    if response not in ['yes', 'y']:
        print("\n✗ Operation cancelled by user")
        return 0

    # Clear collections
    print("\n" + "-"*60)
    print("Clearing Collections:")
    print("-"*60)

    total_deleted = 0
    for collection_name in collections_to_clear:
        deleted = clear_collection(db, collection_name)
        total_deleted += deleted

    # Also clear related collections if requested
    print("\n" + "-"*60)
    response = input("Do you also want to clear the news_articles_master collection? (yes/no): ").strip().lower()

    if response in ['yes', 'y']:
        print("\nClearing news_articles_master collection...")
        deleted = clear_collection(db, "news_articles_master")
        total_deleted += deleted

    # Summary
    print("\n" + "="*60)
    print("Summary:")
    print("="*60)
    print(f"✓ Total documents deleted: {total_deleted:,}")
    print(f"✓ Operation completed at: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")

    # Close connection
    client.close()
    print("\n✓ Database connection closed")

    return 0


if __name__ == "__main__":
    try:
        exit_code = main()
        sys.exit(exit_code)
    except KeyboardInterrupt:
        print("\n\n✗ Operation cancelled by user (Ctrl+C)")
        sys.exit(1)
    except Exception as e:
        print(f"\n✗ Unexpected error: {e}")
        sys.exit(1)