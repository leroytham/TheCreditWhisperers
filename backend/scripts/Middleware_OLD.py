from sentence_transformers import SentenceTransformer, util
import json

# Canonical GICS sectors (your dropdown options)
canonical_sectors = [
    "Energy",
    "Materials",
    "Industrials",
    "Consumer Discretionary",
    "Consumer Staples",
    "Healthcare",
    "Financials",
    "Information Technology",
    "Communication Services",
    "Utilities",
    "Real Estate"
]

# Load embedding model
model = SentenceTransformer("all-mpnet-base-v2")

# Precompute embeddings for canonical sectors
canon_embeddings = model.encode(canonical_sectors, convert_to_tensor=True)

def normalize_sector(raw_sector: str):
    """Map a raw sector string to the closest canonical GICS sector."""
    raw_embedding = model.encode(raw_sector, convert_to_tensor=True)
    similarities = util.cos_sim(raw_embedding, canon_embeddings)
    best_idx = similarities.argmax().item()
    best_sector = canonical_sectors[best_idx]
    return best_sector, float(similarities[0][best_idx])

# Example raw sectors from different APIs
yahoo_sectors = ["Technology", "Healthcare", "Financial Services"]
finnhub_sectors = ["Information Technology", "Health Care", "Banks"]
alpha_vantage_sectors = ["blockchain"]
newsapi_sector = ["Business", "Entertainment", "General", "Health", "Science", "Sports", "Technology"]

# Build lookup table
lookup_table = {}

def add_to_lookup(api_name, raw_list):
    """Normalize each raw sector from an API and store in lookup table."""
    for raw in raw_list:
        norm, score = normalize_sector(raw)
        if norm not in lookup_table:
            lookup_table[norm] = {}
        lookup_table[norm][api_name] = raw

# Process all APIs
add_to_lookup("yahoo", yahoo_sectors)
add_to_lookup("finnhub", finnhub_sectors)
add_to_lookup("alpha_vantage", alpha_vantage_sectors)

# Save to JSON (optional)
with open("sector_mapping.json", "w") as f:
    json.dump(lookup_table, f, indent=2)

# Pretty print result
print(json.dumps(lookup_table, indent=2))
