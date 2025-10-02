require('dotenv').config();
const express = require('express');
const fs = require('fs');
const path = require('path');
const cors = require('cors');
const { MongoClient, ObjectId } = require('mongodb');
const bcrypt = require('bcrypt');
const { spawn } = require('child_process');  
const msal = require('@azure/msal-node'); 
const PORT = process.env.PORT || 8000;


const app = express();
// --- Load tickers.csv into memory ---
let tickerList = [];
const tickerCsvPath = path.join(__dirname, 'tickers.csv');
try {
  const csvData = fs.readFileSync(tickerCsvPath, 'utf8');
  const lines = csvData.split('\n').filter(Boolean);
  const header = lines[0].split(',').map(h => h.trim());
  tickerList = lines.slice(1).map(line => {
    const cols = line.split(',');
    return {
      symbol: cols[0]?.trim(),
      shortname: cols[1]?.trim(),
      longname: cols[1]?.trim(), // Use name for both shortname and longname
      quoteType: cols[2]?.trim() || 'EQUITY',
      exchange: cols[3]?.trim() || ''
    };
  }).filter(t => t.symbol && t.shortname);
  console.log(`Loaded ${tickerList.length} tickers into memory.`);
} catch (err) {
  console.error('Failed to load tickers.csv:', err.message);
}
app.use(cors());
app.use(express.json());

// --- API endpoint: Search ticker suggestions (calls Python)
app.get('/api/search-ticker', (req, res) => {
  const { q } = req.query;
  const startTime = Date.now();
  if (!q || q.length < 2) {
    return res.json({ quotes: [] });
  }

  // Fast in-memory search
  const query = q.trim().toLowerCase();
  const matches = tickerList.filter(t =>
    t.symbol.toLowerCase().includes(query) ||
    t.shortname.toLowerCase().includes(query) ||
    t.longname.toLowerCase().includes(query)
  ).slice(0, 10); // Limit to 10 suggestions

  if (matches.length > 0) {
    const endTime = Date.now();
    const duration = endTime - startTime;
    console.log(`[search-ticker] Query: '${q}' took ${duration} ms (Node.js in-memory)`);
    return res.json({ quotes: matches });
  }

  // If no matches, call Python search_ticker for Yahoo Finance suggestions
  const py = spawn(PYTHON_PATH, ['data_processing.py', 'search_ticker', q], {
    cwd: __dirname,
    env: { ...process.env, PYTHONUNBUFFERED: '1' }
  });
  let data = '';
  let error = '';
  py.stdout.on('data', chunk => { data += chunk.toString(); });
  py.stderr.on('data', chunk => { error += chunk.toString(); });
  py.on('close', code => {
    if (code !== 0) {
      console.error(`[search-ticker] Python error:`, error);
      return res.json({ quotes: [], error: error });
    }
    try {
      const result = JSON.parse(data);
      const endTime = Date.now();
      const duration = endTime - startTime;
      console.log(`[search-ticker] Query: '${q}' took ${duration} ms (Python fallback)`);
      res.json(result);
    } catch (err) {
      console.error(`[search-ticker] JSON parse error:`, err.message);
      res.json({ quotes: [], error: 'Failed to parse Python output' });
    }
  });
});

const uri = process.env.MONGO_URI;
const client = new MongoClient(uri);

// PYTHON_PATH=/'opt/anaconda3/bin/python';
// const PYTHON_PATH = '/opt/anaconda3/bin/python';
const PYTHON_PATH = process.env.PYPATH || '/opt/anaconda3/bin/python';  // Default to 'python3' if PYPATH is not set

// const PYTHON_PATH = 'C:\\Users\\User\\anaconda3\\python.exe';


const msalConfig = {
  auth: {
    clientId: process.env.Application_ID,
    authority: "https://login.microsoftonline.com/common", 
    clientSecret: process.env.CLIENT_SECRET,
  },
};
const cca = new msal.ConfidentialClientApplication(msalConfig);

app.get('/', (req, res) => {
  res.send('Backend connected 🚀');
});

app.post('/signup', async (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({ success: false, message: "Missing username or password" });
  }

  try {
    await client.connect();
    const db = client.db("NewsIngestion");

    const existingUser = await db.collection("Users").findOne({ username });
    if (existingUser) {
      return res.status(400).json({ success: false, message: "Username already exists" });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const result = await db.collection("Users").insertOne({
      username,
      password: hashedPassword,
      createdAt: new Date()
    });

    res.json({ success: true, message: "Signup successful", userId: result.insertedId });
  } catch (err) {
    console.error("Signup error:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
});

app.post('/LoginAdmin', async (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({ success: false, message: "Missing username or password" });
  }

  try {
    await client.connect();
    const db = client.db("NewsIngestion");

    const user = await db.collection("Users").findOne({ username });
    if (!user) {
      return res.status(401).json({ success: false, message: "Invalid username or password" });
    }

    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      return res.status(401).json({ success: false, message: "Invalid username or password" });
    }

    res.json({ success: true, message: "Login successful", user: { id: user._id, username: user.username } });
  } catch (err) {
    console.error("Login error:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
});

app.get('/login', (req, res) => {
  const authCodeUrlParameters = {
    scopes: ["user.read"], 
    redirectUri: "http://localhost:8000/auth/callback", 
  };

  cca.getAuthCodeUrl(authCodeUrlParameters)
    .then((url) => res.redirect(url))
    .catch((err) => res.status(500).send(err));
});

app.get('/auth/callback', async (req, res) => {
  const tokenRequest = {
    code: req.query.code,
    scopes: ["user.read"],
    redirectUri: "http://localhost:8000/auth/callback",
  };

  try {
    const response = await cca.acquireTokenByCode(tokenRequest);
    console.log("Azure Login Success:", response.account);

    res.redirect(
      `http://localhost:3000/financial_dashboard?user=${encodeURIComponent(response.account.username)}`
    );
  } catch (err) {
    console.error("Azure login error:", err);
    res.redirect(`http://localhost:3000/login?error=azure_failed`);
  }
});

app.get('/articles', (req, res) => {
  const { ticker, start_date, end_date } = req.query;

  if (!ticker || !start_date || !end_date) {
    return res.status(400).json({ success: false, message: "ticker, start_date, and end_date are required" });
  }

  const py = spawn(PYTHON_PATH, ['ArticleCategorisation.py', ticker, start_date, end_date]);

  let data = "";
  let error = "";

  py.stdout.on('data', (chunk) => {
    data += chunk.toString();
  });

  py.stderr.on('data', (chunk) => {
    error += chunk.toString();
  });

  py.on('close', (code) => {
    if (code !== 0) {
      console.error("Python error:", error);
      return res.status(500).json({ success: false, message: "Python script failed", error });
    }
    try {
      const result = JSON.parse(data);
      res.json({ success: true, articles: result });
    } catch (err) {
      console.error("JSON parse error:", err);
      res.status(500).json({ success: false, message: "Failed to parse Python output" });
    }
  });
});

// --- API endpoint: Get price data ---
// --- In-memory cache for price data ---
const priceCache = {};
const PRICE_CACHE_TTL = 5 * 60 * 1000; // 5 minutes

// --- Scheduled cache refresh for all tickers ---
function refreshAllTickerCache() {
  tickerList.forEach(tickerObj => {
    const ticker = tickerObj.symbol;
    // Only refresh if not already fresh
    const cacheKey = `${ticker}-1Y`;
    const now = Date.now();
    if (priceCache[cacheKey] && (now - priceCache[cacheKey].timestamp < PRICE_CACHE_TTL)) {
      return;
    }
    // Spawn Python to get data for each ticker
    const pyCode = `
import sys
import os
import json
import warnings
warnings.filterwarnings('ignore')
os.environ['TF_CPP_MIN_LOG_LEVEL'] = '3'
from data_processing import get_data, filter_data
ticker = "${ticker}"
timeframe = "1Y"
try:
  df, company_name, currency = get_data(ticker)
  if df is None:
    print(json.dumps({"error": "Failed to get data"}))
    sys.exit(1)
  df_filtered = filter_data(df, timeframe)
  prices = [{"date": str(idx.date()), "close": float(row["Close"])} for idx, row in df_filtered.iterrows()]
  print(json.dumps({"prices": prices, "company_name": company_name, "currency": currency}))
except Exception as e:
  print(json.dumps({"error": str(e)}))
  sys.exit(1)
`;
    const py = spawn(PYTHON_PATH, ['-c', pyCode], {
      cwd: __dirname,
      env: { ...process.env, PYTHONUNBUFFERED: '1' }
    });
    let data = '';
    py.stdout.on('data', chunk => { data += chunk.toString(); });
    py.on('close', code => {
      if (code === 0) {
        try {
          let cleanData = data.trim();
          const jsonStart = cleanData.indexOf('{');
          if (jsonStart !== -1) cleanData = cleanData.substring(jsonStart);
          let braceCount = 0, jsonEnd = -1;
          for (let i = 0; i < cleanData.length; i++) {
            if (cleanData[i] === '{') braceCount++;
            if (cleanData[i] === '}') {
              braceCount--;
              if (braceCount === 0) { jsonEnd = i + 1; break; }
            }
          }
          if (jsonEnd > 0) cleanData = cleanData.substring(0, jsonEnd);
          const result = JSON.parse(cleanData);
          priceCache[cacheKey] = { data: result, timestamp: Date.now() };
        } catch {}
      }
      // After each ticker refresh, log cache status
      if (Object.keys(priceCache).length > 0) {
        console.log('--- Price Cache Status ---');
        Object.entries(priceCache).forEach(([key, val]) => {
          const age = ((Date.now() - val.timestamp) / 1000).toFixed(1);
          console.log(`  ${key}: ${val.timestamp} (age: ${age}s)`);
        });
        console.log('--------------------------');
      }
    });
  });
}

// Initial cache load and schedule refresh every 5 minutes
setTimeout(refreshAllTickerCache, 2000); // Delay to allow tickers to load
setInterval(refreshAllTickerCache, PRICE_CACHE_TTL);

app.get('/api/price', async (req, res) => {
  const { ticker = 'AAPL', timeframe = '1M' } = req.query;
  const cacheKey = `${ticker}-${timeframe}`;
  const now = Date.now();

  // Check cache
  if (priceCache[cacheKey] && (now - priceCache[cacheKey].timestamp < PRICE_CACHE_TTL)) {
    return res.json(priceCache[cacheKey].data);
  }

  // Fetch fresh data from Python
  const pyCode = `
import sys
import os
import json
import warnings
warnings.filterwarnings('ignore')
os.environ['TF_CPP_MIN_LOG_LEVEL'] = '3'

from data_processing import get_data, filter_data

ticker = "${ticker}"
timeframe = "${timeframe}"

try:
  df, company_name, currency = get_data(ticker)
  if df is None:
    print(json.dumps({"error": "Failed to get data"}))
    sys.exit(1)
  df_filtered = filter_data(df, timeframe)
  prices = [{"date": str(idx.date()), "close": float(row["Close"])} for idx, row in df_filtered.iterrows()]
  print(json.dumps({"prices": prices, "company_name": company_name, "currency": currency}))
except Exception as e:
  print(json.dumps({"error": str(e)}))
  sys.exit(1)
`;

  const py = spawn(PYTHON_PATH, ['-c', pyCode], { 
    cwd: __dirname,
    env: { ...process.env, PYTHONUNBUFFERED: '1' }
  });

  let data = '';
  let error = '';
  let responseSent = false;

  py.stdout.on('data', chunk => {
    data += chunk.toString();
  });

  py.stderr.on('data', chunk => { 
    error += chunk.toString();
  });

  py.on('error', err => {
    console.error('Failed to start Python process:', err);
    if (!responseSent) {
      responseSent = true;
      return res.status(500).json({ 
        success: false, 
        error: 'Failed to start Python process', 
        details: err.message 
      });
    }
  });

  py.on('close', code => {
    if (responseSent) return;
    responseSent = true;

    if (code !== 0) {
      console.error('Python stderr:', error);
      return res.status(500).json({ 
        success: false, 
        error: error || 'Script failed',
        stdout: data
      });
    }

    try {
      let cleanData = data.trim();
      const jsonStart = cleanData.indexOf('{');
      if (jsonStart !== -1) {
        cleanData = cleanData.substring(jsonStart);
      }

      let braceCount = 0;
      let jsonEnd = -1;
      for (let i = 0; i < cleanData.length; i++) {
        if (cleanData[i] === '{') braceCount++;
        if (cleanData[i] === '}') {
          braceCount--;
          if (braceCount === 0) {
            jsonEnd = i + 1;
            break;
          }
        }
      }

      if (jsonEnd > 0) {
        cleanData = cleanData.substring(0, jsonEnd);
      }

      const result = JSON.parse(cleanData);
      // Store in cache
      priceCache[cacheKey] = { data: result, timestamp: Date.now() };
      res.json(result);
    } catch (err) {
      console.error('JSON parse error:', err.message);
      console.error('Raw data:', data);
      res.status(500).json({ 
        success: false, 
        error: `Failed to parse JSON: ${err.message}`, 
        raw: data
      });
    }
  });
});
// --- API endpoint: Get news with sentiment ---
app.get('/api/news', async (req, res) => {
  const { ticker = 'AAPL' } = req.query;
  
  console.log('=== NEWS REQUEST ===');
  console.log('Ticker:', ticker);
  
  const pyCode = `
import sys
import os
import json
import warnings
warnings.filterwarnings('ignore')
os.environ['TF_CPP_MIN_LOG_LEVEL'] = '3'

from data_processing import get_ticker_news, analyze_sentiment

ticker = "${ticker}"

try:
    news_articles = get_ticker_news(ticker, count=50)
    if news_articles is None:
        print(json.dumps({"error": "Failed to get news"}))
        sys.exit(1)
    
    results, avg_score, _, _ = analyze_sentiment(news_articles)
    
    for article in results:
        article['sentiment_label'] = article.get('sentiment_label', '')
        article['sentiment_score'] = float(article.get('sentiment_score', 0))
    
    print(json.dumps({"news": results, "avg_score": float(avg_score)}))
except Exception as e:
    print(json.dumps({"error": str(e)}))
    sys.exit(1)
`;

  const py = spawn(PYTHON_PATH, ['-c', pyCode], { 
    cwd: __dirname,
    env: { ...process.env, PYTHONUNBUFFERED: '1' }
  });
  
  let data = '';
  let error = '';
  let responseSent = false;
  
  py.stdout.on('data', chunk => {
    data += chunk.toString();
  });
  
  py.stderr.on('data', chunk => { 
    error += chunk.toString();
  });
  
  py.on('error', err => {
    console.error('Failed to start Python process:', err);
    if (!responseSent) {
      responseSent = true;
      return res.status(500).json({ 
        success: false, 
        error: 'Failed to start Python process', 
        details: err.message 
      });
    }
  });
  
  py.on('close', code => {
    if (responseSent) return;
    responseSent = true;
    
    console.log('Exit code:', code);
    console.log('Has data:', data.length > 0);
    
    if (code !== 0) {
      console.error('Python stderr:', error);
      return res.status(500).json({ 
        success: false, 
        error: error || 'Script failed', 
        stdout: data 
      });
    }
    
    try {
      let cleanData = data.trim();
      const jsonStart = cleanData.indexOf('{');
      if (jsonStart !== -1) {
        cleanData = cleanData.substring(jsonStart);
      }
      
      const result = JSON.parse(cleanData);
      res.json(result);
    } catch (err) {
      console.error('JSON parse error:', err.message);
      console.error('Raw data:', data);
      res.status(500).json({ 
        success: false, 
        error: err.message, 
        raw: data
      });
    }
  });
});

// app.listen(PORT, () => console.log(`API running on http://localhost:${PORT}`));

if (require.main === module) {
  app.listen(PORT, () => console.log(`API running on http://localhost:${PORT}`));
}

module.exports = app;
