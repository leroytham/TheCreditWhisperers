#!/usr/bin/env python3
"""
Stock Holding Lot Migration Script

This script migrates existing Stock_Holding documents to include lot-level tracking.
It creates a single lot from the existing aggregate quantity/purchase_price/purchase_date
for holdings that don't yet have the lots array.

Usage:
    python backend/scripts/migrate_holding_lots.py [--dry-run] [--verbose]

Environment Variables Required:
    MONGO_URI - MongoDB connection string
"""

import sys
import os
from pathlib import Path
from typing import Dict, List, Any, Optional
from datetime import datetime
import argparse
import logging
import uuid

from pymongo import MongoClient, errors
from pymongo.database import Database
from pymongo.collection import Collection
import certifi
from bson import ObjectId

# Get MongoDB URI from environment variable
MONGO_URI = os.getenv("MONGO_URI", "mongodb://localhost:27017")


class HoldingLotMigration:
    """Handles migration of Stock_Holding documents to include lot-level tracking."""

    def __init__(self, database: Database, dry_run: bool = False, verbose: bool = False):
        self.db = database
        self.dry_run = dry_run
        self.verbose = verbose
        self.logger = self._setup_logger()

        # Collections
        self.stock_holding = self.db["Stock_Holding"]

        # Statistics
        self.stats = {
            "total_holdings": 0,
            "holdings_migrated": 0,
            "holdings_skipped": 0,
            "holdings_with_lots": 0,
            "errors": 0
        }

    def _setup_logger(self) -> logging.Logger:
        """Set up logging configuration."""
        level = logging.DEBUG if self.verbose else logging.INFO
        logging.basicConfig(
            level=level,
            format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
            handlers=[
                logging.StreamHandler(sys.stdout),
                logging.FileHandler(f'holding_lot_migration_{datetime.now().strftime("%Y%m%d_%H%M%S")}.log')
            ]
        )
        return logging.getLogger(__name__)

    def analyze_holdings(self) -> Dict[str, Any]:
        """Analyze Stock_Holding collection to identify holdings without lot tracking."""
        self.logger.info("Analyzing Stock_Holding collection...")

        # Count total holdings
        total = self.stock_holding.count_documents({})
        self.stats["total_holdings"] = total

        # Count holdings with lots array
        with_lots = self.stock_holding.count_documents({"lots": {"$exists": True, "$ne": []}})
        self.stats["holdings_with_lots"] = with_lots

        # Count holdings without lots array
        without_lots = total - with_lots

        self.logger.info(f"Total holdings: {total}")
        self.logger.info(f"Holdings with lots: {with_lots}")
        self.logger.info(f"Holdings without lots: {without_lots}")

        return {
            "total": total,
            "with_lots": with_lots,
            "without_lots": without_lots
        }

    def migrate_holdings(self) -> None:
        """Perform the holding lot migration."""
        self.logger.info(f"Starting holding lot migration (dry_run={self.dry_run})...")

        # Find holdings without lots array
        cursor = self.stock_holding.find({
            "$or": [
                {"lots": {"$exists": False}},
                {"lots": []}
            ]
        })

        for holding in cursor:
            try:
                holding_id = holding.get("_id")
                symbol = holding.get("symbol", "UNKNOWN")
                username = holding.get("username", "UNKNOWN")
                account_name = holding.get("client_account_name", "UNKNOWN")

                # Extract current holding data
                quantity = holding.get("quantity", 0)
                purchase_price = holding.get("purchase_price", 0)
                purchase_date = holding.get("purchase_date")

                # Skip if no quantity
                if quantity <= 0:
                    self.logger.debug(f"Skipping holding {symbol} for {username} (zero quantity)")
                    self.stats["holdings_skipped"] += 1
                    continue

                # Create a single lot from the aggregate data
                lot = {
                    "lot_id": str(uuid.uuid4()),
                    "quantity": quantity,
                    "purchase_price": purchase_price,
                    "purchase_date": purchase_date,
                    "created_at": datetime.utcnow()
                }

                if not self.dry_run:
                    # Update the holding with lots array
                    self.stock_holding.update_one(
                        {"_id": holding_id},
                        {"$set": {
                            "lots": [lot],
                            "updated_at": datetime.utcnow()
                        }}
                    )
                    self.stats["holdings_migrated"] += 1
                    self.logger.info(f"Migrated holding {symbol} for {username}/{account_name}")
                else:
                    self.logger.info(f"[DRY RUN] Would migrate holding {symbol} for {username}/{account_name}")
                    self.stats["holdings_migrated"] += 1

            except Exception as e:
                self.logger.error(f"Error processing holding {holding.get('_id')}: {str(e)}")
                self.stats["errors"] += 1

    def verify_migration(self) -> None:
        """Verify the migration results."""
        self.logger.info("Verifying migration...")

        # Count holdings with lots
        with_lots = self.stock_holding.count_documents({"lots": {"$exists": True, "$ne": []}})
        self.logger.info(f"Holdings with lots array: {with_lots}")

        # Count holdings without lots
        without_lots = self.stock_holding.count_documents({
            "$or": [
                {"lots": {"$exists": False}},
                {"lots": []}
            ]
        })
        self.logger.info(f"Holdings without lots array: {without_lots}")

        # Sample holding with lots
        sample = self.stock_holding.find_one({"lots": {"$exists": True, "$ne": []}})
        if sample:
            self.logger.info(f"Sample holding with lots: {sample.get('symbol')} - {len(sample.get('lots', []))} lot(s)")
            if self.verbose:
                self.logger.debug(f"Sample lots data: {sample.get('lots')}")

    def print_summary(self) -> None:
        """Print migration summary."""
        print("\n" + "=" * 60)
        print("HOLDING LOT MIGRATION SUMMARY")
        print("=" * 60)
        print(f"Total holdings:                {self.stats['total_holdings']}")
        print(f"Holdings already with lots:    {self.stats['holdings_with_lots']}")
        print(f"Holdings migrated:             {self.stats['holdings_migrated']}")
        print(f"Holdings skipped:              {self.stats['holdings_skipped']}")
        print(f"Errors encountered:            {self.stats['errors']}")
        print(f"Dry run mode:                  {self.dry_run}")
        print("=" * 60)


def main():
    """Main migration script entry point."""
    parser = argparse.ArgumentParser(description="Migrate Stock_Holding documents to include lot-level tracking")
    parser.add_argument("--dry-run", action="store_true", help="Run without making changes")
    parser.add_argument("--verbose", action="store_true", help="Enable verbose logging")
    parser.add_argument("--verify-only", action="store_true", help="Only verify existing migration")

    args = parser.parse_args()

    # Check if MONGO_URI is set
    if not MONGO_URI or MONGO_URI == "mongodb://localhost:27017":
        print("⚠️  Warning: MONGO_URI environment variable not set. Using default: mongodb://localhost:27017")
        print("   Set MONGO_URI to your MongoDB connection string if needed.")
        print()

    # Connect to MongoDB
    print(f"Connecting to MongoDB...")
    client = MongoClient(
        MONGO_URI,
        tls=True,
        tlsCAFile=certifi.where()
    )

    try:
        # Test connection
        client.server_info()
        print("✅ Connected to MongoDB successfully")

        # Get database
        db = client["FYP"]

        # Create migration instance
        migration = HoldingLotMigration(db, dry_run=args.dry_run, verbose=args.verbose)

        if args.verify_only:
            # Only run verification
            migration.analyze_holdings()
            migration.verify_migration()
        else:
            # Run migration
            migration.analyze_holdings()
            migration.migrate_holdings()
            migration.verify_migration()
            migration.print_summary()

    except errors.ConnectionFailure as e:
        print(f"❌ Failed to connect to MongoDB: {e}")
        sys.exit(1)
    except Exception as e:
        print(f"❌ Migration failed: {e}")
        sys.exit(1)
    finally:
        client.close()
        print("🔌 Closed MongoDB connection")


if __name__ == "__main__":
    main()
