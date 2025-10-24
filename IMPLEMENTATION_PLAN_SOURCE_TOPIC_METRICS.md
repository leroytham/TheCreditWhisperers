# Implementation Plan: Source & Topic Analysis Metrics

## Executive Summary
This plan adds **3 contextual metrics** to understand the **sources and topics** driving sentiment scores. These complement the existing 6-dimensional sentiment system (Score, Direction, Confidence, Quantity, Breadth, Shock) by answering: "**Where is the news coming from?**" and "**What is it about?**"

---

## ✅ Current State Analysis

### What's Already Implemented
1. **Backend (`sentiment_service.py`)**:
   - ✅ 6-dimension sentiment analysis (Score, Momentum, Volatility, Volume, Breadth, Z-Score)
   - ✅ Exponential decay weighting (Fast 7h, Slow 24h)
   - ✅ `CombinedWeight` calculation (relevance × recency_weight)
   - ✅ Bull/Bear counting mechanism (breadth)
   - ✅ In-memory Z-Score calculation

2. **Data Availability**:
   - ✅ **Provider/Source field**: `article.get("provider")` or `article.get("source")` available from Alpha Vantage
   - ❓ **Topics array**: According to Alpha Vantage docs, `topics` parameter exists for filtering but need to verify if returned in article data
   - ⚠️ **Gap**: Topics array NOT currently extracted in `news_service.py` line 171

### Discrepancies Found

#### 1. **Missing Topics Extraction** 🔴
**Location**: `/backend/app/services/news_service.py` line ~171
**Current Code**:
```python
news_list.append({
    "title": article.get("title"),
    "link": article.get("url"),
    "provider": article.get("source"),  # ✅ Source exists
    "publish_date": pub_date,
    # ...
    "ticker_sentiment_score": ticker_sentiment_score,
    "ticker_sentiment_label": ticker_sentiment_label,
    "ticker_relevance_score": ticker_relevance_score,
    "image": article.get("banner_image")
    # ❌ Topics array NOT extracted
})
```

**Expected Alpha Vantage Response Structure** (per documentation):
```json
{
  "feed": [
    {
      "title": "...",
      "url": "...",
      "time_published": "...",
      "authors": [...],
      "summary": "...",
      "source": "Benzinga",
      "topics": [
        {
          "topic": "Earnings",
          "relevance_score": "0.999"
        },
        {
          "topic": "Technology",
          "relevance_score": "0.75"
        }
      ],
      "ticker_sentiment": [...]
    }
  ]
}
```

**Available Topics** (from Alpha Vantage docs):
- `blockchain`, `earnings`, `ipo`, `mergers_and_acquisitions`
- `financial_markets`, `economy_fiscal`, `economy_monetary`, `economy_macro`
- `energy_transportation`, `finance`, `life_sciences`, `manufacturing`
- `real_estate`, `retail_wholesale`, `technology`

#### 2. **No Source Concentration Metric** 🔴
- HHI (Herfindahl-Hirschman Index) not calculated
- No visibility into whether sentiment is dominated by single source vs diverse

#### 3. **No Topic Analysis** 🔴
- Cannot identify what's driving sentiment (e.g., "Earnings" vs "Legal")
- Missing diagnostic capability for conflicting topics (bullish earnings, bearish legal)

---

## 📋 Proposed Metrics

### 1️⃣ Source Concentration (HHI) 🏢

**Purpose**: Measures whether sentiment comes from diverse sources or single outlet domination.

**Calculation**:
```python
def _calculate_source_concentration_hhi(self, articles_with_metadata: list[dict]) -> dict:
    """
    Calculate Herfindahl-Hirschman Index (HHI) for source diversity.
    
    Returns:
        {
            "source_concentration_hhi": float (0-10000),
            "concentration_interpretation": str ("Low/Moderate/High Concentration"),
            "top_sources": [{source, weight, percentage}, ...]  # Top 5
        }
    """
    # 1. Aggregate TotalWeight per source
    source_weights = defaultdict(float)
    for article in articles_with_metadata:
        source = article.get("provider", "Unknown")
        combined_weight = article.get("combined_weight", 0)
        source_weights[source] += combined_weight
    
    # 2. Calculate grand total
    grand_total = sum(source_weights.values())
    
    # 3. Calculate HHI = sum((share^2) * 10000)
    hhi = 0.0
    for source, weight in source_weights.items():
        share = weight / grand_total if grand_total > 0 else 0
        hhi += (share ** 2) * 10000
    
    # 4. Interpret
    if hhi < 1500:
        interpretation = "Low Concentration"  # Diverse, healthy
    elif hhi < 2500:
        interpretation = "Moderate Concentration"  # Few sources dominant
    else:
        interpretation = "High Concentration"  # Single source bias risk
    
    # 5. Top 5 sources
    sorted_sources = sorted(source_weights.items(), key=lambda x: x[1], reverse=True)[:5]
    top_sources = [
        {
            "source": source,
            "weight": weight,
            "percentage": (weight / grand_total * 100) if grand_total > 0 else 0
        }
        for source, weight in sorted_sources
    ]
    
    return {
        "source_concentration_hhi": hhi,
        "concentration_interpretation": interpretation,
        "top_sources": top_sources
    }
```

**Thresholds**:
- **HHI < 1500**: Low Concentration (Healthy diversity) ✅
- **1500 ≤ HHI < 2500**: Moderate Concentration (Caution) ⚠️
- **HHI ≥ 2500**: High Concentration (Single source dominance) 🔴

---

### 2️⃣ Dominant Sentiment Topic 🏷️

**Purpose**: Identifies the most influential topic driving sentiment using weighted mode.

**Calculation**:
```python
def _calculate_dominant_topic(self, articles_with_metadata: list[dict]) -> dict:
    """
    Find dominant topic using weighted mode calculation.
    
    Returns:
        {
            "dominant_topic": str or None,
            "dominant_topic_weight": float,
            "dominant_topic_percentage": float,
            "topic_count": int  # Total unique topics
        }
    """
    topic_weights = defaultdict(float)
    grand_total = 0.0
    
    for article in articles_with_metadata:
        topics = article.get("topics", [])
        combined_weight = article.get("combined_weight", 0)
        
        # Add weight to each topic this article mentions
        for topic in topics:
            # Handle both string topics and dict topics
            topic_name = topic if isinstance(topic, str) else topic.get("topic", "Unknown")
            topic_weights[topic_name] += combined_weight
            grand_total += combined_weight
    
    if not topic_weights:
        return {
            "dominant_topic": None,
            "dominant_topic_weight": 0.0,
            "dominant_topic_percentage": 0.0,
            "topic_count": 0
        }
    
    # Find topic with highest weight
    dominant_topic, dominant_weight = max(topic_weights.items(), key=lambda x: x[1])
    
    return {
        "dominant_topic": dominant_topic,
        "dominant_topic_weight": dominant_weight,
        "dominant_topic_percentage": (dominant_weight / grand_total * 100) if grand_total > 0 else 0,
        "topic_count": len(topic_weights)
    }
```

---

### 3️⃣ Sentiment by Topic (Breakdown) 🔬

**Purpose**: Calculates weighted average sentiment score for **each topic** to reveal conflicts.

**Calculation**:
```python
def _calculate_sentiment_by_topic(self, articles_with_metadata: list[dict]) -> dict:
    """
    Calculate full weighted sentiment score breakdown by topic.
    Similar to main score calculation but grouped by topic.
    
    Returns:
        {
            "sentiment_by_topic": {
                "Earnings": 0.45,
                "Technology": 0.15,
                "Legal": -0.60,
                ...
            },
            "topic_weights": {
                "Earnings": 5.2,
                "Technology": 3.1,
                "Legal": 1.8
            }
        }
    """
    topic_weighted_sentiment_sum = defaultdict(float)
    topic_total_weight_sum = defaultdict(float)
    
    for article in articles_with_metadata:
        topics = article.get("topics", [])
        combined_weight = article.get("combined_weight", 0)
        sentiment_score = article.get("sentiment_score_raw", 0.0)
        
        # Add to each topic's weighted sum
        for topic in topics:
            topic_name = topic if isinstance(topic, str) else topic.get("topic", "Unknown")
            topic_weighted_sentiment_sum[topic_name] += sentiment_score * combined_weight
            topic_total_weight_sum[topic_name] += combined_weight
    
    # Calculate final scores
    sentiment_by_topic = {}
    topic_weights = {}
    
    for topic in topic_weighted_sentiment_sum.keys():
        total_weight = topic_total_weight_sum[topic]
        if total_weight > 0:
            sentiment_by_topic[topic] = topic_weighted_sentiment_sum[topic] / total_weight
            topic_weights[topic] = total_weight
    
    return {
        "sentiment_by_topic": sentiment_by_topic,
        "topic_weights": topic_weights
    }
```

---

## 🔧 Implementation Steps

### **Phase 1: Backend Data Extraction** (30 mins)

#### Step 1.1: Update `news_service.py` to Extract Topics
**File**: `/backend/app/services/news_service.py` ~line 171

**Action**: Add topics extraction from Alpha Vantage response

```python
# In get_ticker_news_alpha_vantage method
news_list.append({
    "title": article.get("title"),
    "link": article.get("url"),
    "provider": article.get("source"),
    "publish_date": pub_date,
    "publish_timestamp": pub_datetime.isoformat(),
    "body": body_content,
    "ticker_sentiment_score": ticker_sentiment_score,
    "ticker_sentiment_label": ticker_sentiment_label,
    "ticker_relevance_score": ticker_relevance_score,
    "image": article.get("banner_image"),
    "topics": article.get("topics", [])  # ✅ NEW: Extract topics array
})
```

#### Step 1.2: Add Metric Calculations to `sentiment_service.py`
**File**: `/backend/app/services/sentiment_service.py`

**Action 1**: Add 3 new methods (after `_calculate_z_score_from_articles`)
- `_calculate_source_concentration_hhi(articles_with_metadata)`
- `_calculate_dominant_topic(articles_with_metadata)`
- `_calculate_sentiment_by_topic(articles_with_metadata)`

**Action 2**: Integrate into `analyze_sentiment_with_momentum` (after line ~750)

```python
# After Z-Score calculation
source_concentration_data = self._calculate_source_concentration_hhi(articles_with_metadata_slow)
dominant_topic_data = self._calculate_dominant_topic(articles_with_metadata_slow)
sentiment_by_topic_data = self._calculate_sentiment_by_topic(articles_with_metadata_slow)
```

**Action 3**: Add to return dictionary (after line ~850)

```python
return {
    # ... existing fields ...
    "sentiment_z_score": z_score_data.get("z_score"),
    "z_score_interpretation": z_score_data.get("interpretation"),
    # ... other Z-Score fields ...
    
    # ✅ NEW: Source & Topic Metrics
    "source_concentration_hhi": source_concentration_data.get("source_concentration_hhi"),
    "concentration_interpretation": source_concentration_data.get("concentration_interpretation"),
    "top_sources": source_concentration_data.get("top_sources", []),
    "dominant_topic": dominant_topic_data.get("dominant_topic"),
    "dominant_topic_weight": dominant_topic_data.get("dominant_topic_weight"),
    "dominant_topic_percentage": dominant_topic_data.get("dominant_topic_percentage"),
    "topic_count": dominant_topic_data.get("topic_count", 0),
    "sentiment_by_topic": sentiment_by_topic_data.get("sentiment_by_topic", {}),
    "topic_weights": sentiment_by_topic_data.get("topic_weights", {})
}
```

---

### **Phase 2: API Exposure** (15 mins)

#### Step 2.1: Update `/api/news` Endpoint
**File**: `/backend/app/api/routes.py`

**Action**: The fields will automatically be exposed since sentiment_results is spread into response

**Verify**: Check that `/api/news` response includes:
```json
{
  "ticker": "NVDA",
  "source_concentration_hhi": 1234.56,
  "concentration_interpretation": "Low Concentration",
  "top_sources": [...],
  "dominant_topic": "Earnings",
  "dominant_topic_percentage": 45.2,
  "sentiment_by_topic": {
    "Earnings": 0.45,
    "Technology": 0.15,
    "Legal": -0.60
  },
  ...
}
```

---

### **Phase 3: Frontend Integration** (2 hours)

#### Step 3.1: Update `useNewsData.js` Hook
**File**: `/frontend/src/features/entity/hooks/useNewsData.js`

**Action**: Extract new fields from API response (after line ~80)

```javascript
// Extract source concentration metrics
const sourceConcentrationHHI = newsData.source_concentration_hhi || null;
const concentrationInterpretation = newsData.concentration_interpretation || 'No Data';
const topSources = newsData.top_sources || [];

// Extract topic metrics
const dominantTopic = newsData.dominant_topic || null;
const dominantTopicPercentage = newsData.dominant_topic_percentage || 0;
const topicCount = newsData.topic_count || 0;
const sentimentByTopic = newsData.sentiment_by_topic || {};
const topicWeights = newsData.topic_weights || {};

// ... add to return object
```

#### Step 3.2: Create `SourceConcentrationCard.jsx`
**File**: `/frontend/src/features/shared/components/SourceConcentrationCard.jsx`

**Features**:
- Display HHI score with color-coded interpretation badge
- Visual bar chart showing top 5 sources with percentages
- Warning icon for High Concentration (HHI > 2500)
- Diversity indicator for Low Concentration

**Layout**:
```
┌─────────────────────────────────────┐
│ Source Concentration (HHI)          │
│                                     │
│ 1,234  [Low Concentration ✓]       │
│                                     │
│ Top News Sources:                   │
│ ██████████████████░░░ Benzinga 45% │
│ ██████████░░░░░░░░░░░ Reuters  25%  │
│ ████████░░░░░░░░░░░░░ Bloomberg 20% │
│ ████░░░░░░░░░░░░░░░░░ Zacks     10% │
│                                     │
│ ℹ️ Sentiment from diverse sources   │
└─────────────────────────────────────┘
```

#### Step 3.3: Create `SentimentByTopicCard.jsx`
**File**: `/frontend/src/features/shared/components/SentimentByTopicCard.jsx`

**Features**:
- Display dominant topic prominently with percentage
- Table breakdown of all topics with sentiment scores
- Color-coded sentiment bars (green positive, red negative)
- Conflict detection: highlight when topics have opposing sentiments
- Sort by weight (most influential first)

**Layout**:
```
┌─────────────────────────────────────┐
│ Sentiment by Topic                  │
│                                     │
│ 🏆 Dominant: Earnings (45%)         │
│                                     │
│ Topic Breakdown:                    │
│ Earnings      +0.45 ████████░░  45% │
│ M&A           +0.30 █████░░░░░  30% │
│ Technology    +0.15 ███░░░░░░░  15% │
│ Legal         -0.60 ▓▓▓▓░░░░░░  10% │
│                                     │
│ ⚠️ Conflict: Legal (-0.60) vs        │
│    Earnings (+0.45)                 │
└─────────────────────────────────────┘
```

#### Step 3.4: Integrate into `PerformanceView.jsx`
**File**: `/frontend/src/features/entity/components/PerformanceView/PerformanceView.jsx`

**Action**: Add to Sentiment tab layout

**New Layout**:
```jsx
<div className="sentiment-metrics-grid">
  {/* Row 1: Overview */}
  <OverallSentiment {...} />
  <MomentumCard {...} />
  
  {/* Row 2: Advanced Sentiment Analytics */}
  <SentimentBreadthCard {...} />
  <SentimentShockCard {...} />
  
  {/* Row 3: Source & Topic Context */}
  <SourceConcentrationCard {...} />
  <SentimentByTopicCard {...} />
  
  {/* Row 4: Distribution */}
  <SentimentMetricsCard {...} />
</div>
```

---

## 📊 Expected Output Examples

### Example 1: Diverse Sources, Single Topic
```json
{
  "source_concentration_hhi": 1200,
  "concentration_interpretation": "Low Concentration",
  "top_sources": [
    {"source": "Benzinga", "percentage": 25},
    {"source": "Reuters", "percentage": 20},
    {"source": "Bloomberg", "percentage": 20},
    {"source": "Zacks", "percentage": 18},
    {"source": "Motley Fool", "percentage": 17}
  ],
  "dominant_topic": "Earnings",
  "dominant_topic_percentage": 80.0,
  "sentiment_by_topic": {
    "Earnings": 0.45,
    "Technology": 0.10
  }
}
```
**Interpretation**: Reliable bullish sentiment from diverse sources, primarily earnings-driven.

### Example 2: Single Source, Conflicting Topics
```json
{
  "source_concentration_hhi": 9800,
  "concentration_interpretation": "High Concentration",
  "top_sources": [
    {"source": "Benzinga", "percentage": 98},
    {"source": "Reuters", "percentage": 2}
  ],
  "dominant_topic": "Earnings",
  "dominant_topic_percentage": 60.0,
  "sentiment_by_topic": {
    "Earnings": 0.65,
    "Legal": -0.70,
    "Technology": 0.20
  }
}
```
**Interpretation**: ⚠️ Single source bias risk. Conflicting topics: excellent earnings (+0.65) vs terrible legal news (-0.70).

---

## 🎯 Success Criteria

### Backend
- ✅ Topics array extracted from Alpha Vantage API
- ✅ HHI calculation returns 0-10000 with correct thresholds
- ✅ Dominant topic correctly identifies highest weighted topic
- ✅ Sentiment by topic returns accurate weighted averages
- ✅ All new fields exposed in `/api/news` endpoint

### Frontend
- ✅ `SourceConcentrationCard` displays HHI with visual source breakdown
- ✅ `SentimentByTopicCard` shows dominant topic and conflict detection
- ✅ Cards integrated into Sentiment tab with proper grid layout
- ✅ Loading states and error handling for missing data
- ✅ Responsive design (mobile-friendly)

### User Experience
- ✅ Users can immediately see if sentiment is from diverse sources
- ✅ Users can identify what topics drive sentiment (e.g., "It's the earnings")
- ✅ Conflict alerts highlight when topics have opposing sentiments
- ✅ HHI > 2500 triggers visual warning for single-source bias

---

## 🔍 Testing Plan

### Unit Tests
1. **Backend**:
   - Test HHI calculation with known distributions
   - Test dominant topic with tie-breaking scenarios
   - Test sentiment-by-topic with missing topics array

2. **Frontend**:
   - Test SourceConcentrationCard with various HHI values
   - Test SentimentByTopicCard conflict detection
   - Test null/undefined handling

### Integration Tests
1. Fetch real data from Alpha Vantage API with topics
2. Verify topics array structure matches expectations
3. Validate HHI calculation across different tickers

### Manual QA
1. Load NVDA (high volume, diverse sources expected)
2. Load small-cap ticker (likely single-source, high HHI)
3. Verify conflict detection with mixed topic sentiments

---

## 📦 Deliverables

1. **Backend Changes**:
   - Modified `news_service.py` (topics extraction)
   - 3 new methods in `sentiment_service.py`
   - Updated `analyze_sentiment_with_momentum` return

2. **Frontend Changes**:
   - Updated `useNewsData.js` (9 new extracted fields)
   - New `SourceConcentrationCard.jsx` (~200 lines)
   - New `SentimentByTopicCard.jsx` (~250 lines)
   - Updated `PerformanceView.jsx` (layout integration)

3. **Documentation**:
   - This implementation plan
   - Code comments explaining HHI formula
   - JSDoc for new React components

---

## ⏱️ Time Estimates

| Phase | Task | Estimated Time |
|-------|------|----------------|
| Phase 1 | Backend data extraction & calculations | 45 mins |
| Phase 2 | API endpoint updates | 15 mins |
| Phase 3 | Frontend hook updates | 15 mins |
| Phase 3 | SourceConcentrationCard component | 45 mins |
| Phase 3 | SentimentByTopicCard component | 45 mins |
| Phase 3 | Layout integration | 15 mins |
| **TOTAL** | | **3 hours** |

---

## 🚀 Next Steps

1. **Verify Alpha Vantage Topics**: Run test API call to confirm topics array structure
2. **Begin Phase 1**: Extract topics in news_service.py
3. **Implement Backend Metrics**: Add 3 calculation methods
4. **Test with Real Data**: Validate with NVDA ticker
5. **Build Frontend Components**: Create visualization cards
6. **Integration**: Add to Sentiment tab layout
7. **QA & Refinement**: Test edge cases, polish UI

---

## 💡 Key Insights This Unlocks

### Before (6 Dimensions):
- "Sentiment is +0.40 (Bullish)"
- "News volume is high"
- "Bull/bear ratio is 3:1"

### After (9 Dimensions):
- "Sentiment is +0.40 (Bullish)"
- "News volume is high"
- "Bull/bear ratio is 3:1"
- **"BUT it's all from Benzinga (HHI=9800) ⚠️"** ← Source bias warning
- **"Driven by Earnings (+0.65) 🏆"** ← Topic clarity
- **"Conflicting Legal news (-0.70) 📉"** ← Hidden risk revealed

This provides **complete sentiment context**: not just _what_ the sentiment is, but _where it comes from_ and _why it exists_.
