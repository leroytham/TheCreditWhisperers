#!/usr/bin/env python3
"""
Portfolio Migration Script

This script migrates existing Stock_Holding data to create Portfolio documents.
It creates Portfolio entries based on unique (username, client_account_name) combinations
from the Stock_Holding collection.

Usage:
    python backend/scripts/migrate_portfolios.py [--dry-run] [--verbose]
"""

import sys
import os
from pathlib import Path
from typing import Dict, List, Any, Optional
from datetime import datetime
import argparse
import logging

# Add parent directory to path for imports
sys.path.append(str(Path(__file__).parent.parent))

from pymongo import MongoClient, errors
from pymongo.database import Database
from pymongo.collection import Collection
import certifi
from bson import ObjectId

# Import app modules
from app.core.config import settings
from app.models.portfolio_model import PortfolioModel


class PortfolioMigration:
    """Handles migration of Stock_Holding data to Portfolio collection."""

    def __init__(self, database: Database, dry_run: bool = False, verbose: bool = False):
        self.db = database
        self.dry_run = dry_run
        self.verbose = verbose
        self.logger = self._setup_logger()

        # Collections
        self.stock_holding = self.db["Stock_Holding"]
        self.portfolios = self.db["portfolios"]
        self.account_details = self.db["Account_Details"]

        # Statistics
        self.stats = {
            "total_holdings": 0,
            "unique_portfolios": 0,
            "portfolios_created": 0,
            "portfolios_updated": 0,
            "portfolios_skipped": 0,
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
                logging.FileHandler(f'portfolio_migration_{datetime.now().strftime("%Y%m%d_%H%M%S")}.log')
            ]
        )
        return logging.getLogger(__name__)

    def analyze_holdings(self) -> Dict[str, List[Dict[str, Any]]]:
        """Analyze Stock_Holding collection to identify unique portfolios."""
        self.logger.info("Analyzing Stock_Holding collection...")

        # Group holdings by (username, client_account_name)
        portfolio_map = {}
        cursor = self.stock_holding.find({})

        for holding in cursor:
            self.stats["total_holdings"] += 1

            # Extract key fields
            username = holding.get("username", "")
            account_name = holding.get("client_account_name", "")
            account_no = holding.get("account_no", "")

            if not username or not account_name:
                self.logger.warning(f"Skipping holding with missing username or account_name: {holding.get('_id')}")
                continue

            # Create portfolio key
            portfolio_key = f"{username}:{account_name}"

            if portfolio_key not in portfolio_map:
                portfolio_map[portfolio_key] = {
                    "username": username,
                    "account_name": account_name,
                    "account_no": account_no,
                    "holdings": [],
                    "tickers": set()
                }

            # Add holding info
            portfolio_map[portfolio_key]["holdings"].append({
                "symbol": holding.get("symbol"),
                "quantity": holding.get("quantity", 0),
                "purchase_price": holding.get("purchase_price", 0),
                "market_value": holding.get("market_value", 0)
            })

            if holding.get("symbol"):
                portfolio_map[portfolio_key]["tickers"].add(holding.get("symbol"))

        self.stats["unique_portfolios"] = len(portfolio_map)
        self.logger.info(f"Found {self.stats['unique_portfolios']} unique portfolios from {self.stats['total_holdings']} holdings")

        return portfolio_map

    def create_portfolio_document(self, portfolio_data: Dict[str, Any], is_first: bool = False) -> Dict[str, Any]:
        """Create a portfolio document from analyzed data."""
        # Calculate portfolio metrics
        tickers = list(portfolio_data["tickers"])
        holdings_count = len(portfolio_data["holdings"])
        total_value = sum(h.get("market_value", 0) for h in portfolio_data["holdings"])

        # Create portfolio model
        portfolio = PortfolioModel(
            username=portfolio_data["username"],
            account_name=portfolio_data["account_name"],
            portfolio_name=portfolio_data["account_name"],  # Use account_name as display name initially
            account_no=portfolio_data.get("account_no"),
            is_primary=is_first,  # First portfolio for user is primary
            is_active=True,
            holdings_count=holdings_count,
            total_value=total_value,
            tickers=tickers,
            created_at=datetime.utcnow(),
            updated_at=datetime.utcnow()
        )

        return portfolio.to_dict()

    def migrate_portfolios(self) -> None:
        """Perform the portfolio migration."""
        self.logger.info(f"Starting portfolio migration (dry_run={self.dry_run})...")

        # Analyze existing holdings
        portfolio_map = self.analyze_holdings()

        if not portfolio_map:
            self.logger.warning("No portfolios found to migrate")
            return

        # Track users for primary portfolio assignment
        user_portfolio_count = {}

        # Process each unique portfolio
        for portfolio_key, portfolio_data in portfolio_map.items():
            try:
                username = portfolio_data["username"]
                account_name = portfolio_data["account_name"]

                # Check if portfolio already exists
                existing = self.portfolios.find_one({
                    "username": username,
                    "account_name": account_name
                })

                if existing:
                    self.logger.debug(f"Portfolio already exists for {portfolio_key}")

                    # Update holdings cache if needed
                    if not self.dry_run:
                        update_data = {
                            "holdings_count": len(portfolio_data["holdings"]),
                            "total_value": sum(h.get("market_value", 0) for h in portfolio_data["holdings"]),
                            "tickers": list(portfolio_data["tickers"]),
                            "updated_at": datetime.utcnow()
                        }

                        self.portfolios.update_one(
                            {"_id": existing["_id"]},
                            {"$set": update_data}
                        )
                        self.stats["portfolios_updated"] += 1
                        self.logger.info(f"Updated portfolio cache for {portfolio_key}")
                    else:
                        self.logger.info(f"[DRY RUN] Would update portfolio cache for {portfolio_key}")
                        self.stats["portfolios_skipped"] += 1
                    continue

                # Track if this is first portfolio for user
                is_first = username not in user_portfolio_count
                if is_first:
                    user_portfolio_count[username] = 0
                user_portfolio_count[username] += 1

                # Create new portfolio document
                portfolio_doc = self.create_portfolio_document(portfolio_data, is_first)

                if not self.dry_run:
                    # Insert portfolio
                    result = self.portfolios.insert_one(portfolio_doc)
                    self.stats["portfolios_created"] += 1
                    self.logger.info(f"Created portfolio {result.inserted_id} for {portfolio_key}")
                else:
                    self.logger.info(f"[DRY RUN] Would create portfolio for {portfolio_key}")
                    self.stats["portfolios_created"] += 1

            except Exception as e:
                self.logger.error(f"Error processing portfolio {portfolio_key}: {str(e)}")
                self.stats["errors"] += 1

    def verify_migration(self) -> None:
        """Verify the migration results."""
        self.logger.info("Verifying migration...")

        # Count portfolios
        portfolio_count = self.portfolios.count_documents({})
        self.logger.info(f"Total portfolios in collection: {portfolio_count}")

        # Check primary portfolios
        pipeline = [
            {"$match": {"is_primary": True}},
            {"$group": {"_id": "$username", "count": {"$sum": 1}}}
        ]

        primary_stats = list(self.portfolios.aggregate(pipeline))
        users_with_multiple_primary = [s for s in primary_stats if s["count"] > 1]

        if users_with_multiple_primary:
            self.logger.warning(f"Users with multiple primary portfolios: {users_with_multiple_primary}")

        # Sample portfolio
        sample = self.portfolios.find_one()
        if sample:
            self.logger.info(f"Sample portfolio: {sample}")

    def print_summary(self) -> None:
        """Print migration summary."""
        print("\n" + "=" * 60)
        print("PORTFOLIO MIGRATION SUMMARY")
        print("=" * 60)
        print(f"Total holdings processed:      {self.stats['total_holdings']}")
        print(f"Unique portfolios found:       {self.stats['unique_portfolios']}")
        print(f"Portfolios created:            {self.stats['portfolios_created']}")
        print(f"Portfolios updated:            {self.stats['portfolios_updated']}")
        print(f"Portfolios skipped:            {self.stats['portfolios_skipped']}")
        print(f"Errors encountered:            {self.stats['errors']}")
        print(f"Dry run mode:                  {self.dry_run}")
        print("=" * 60)


def main():
    """Main migration script entry point."""
    parser = argparse.ArgumentParser(description="Migrate Stock_Holding data to Portfolio collection")
    parser.add_argument("--dry-run", action="store_true", help="Run without making changes")
    parser.add_argument("--verbose", action="store_true", help="Enable verbose logging")
    parser.add_argument("--verify-only", action="store_true", help="Only verify existing migration")

    args = parser.parse_args()

    # Connect to MongoDB
    print(f"Connecting to MongoDB at {settings.MONGO_URI}...")
    client = MongoClient(
        settings.MONGO_URI,
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
        migration = PortfolioMigration(db, dry_run=args.dry_run, verbose=args.verbose)

        if args.verify_only:
            # Only run verification
            migration.verify_migration()
        else:
            # Run migration
            migration.migrate_portfolios()
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