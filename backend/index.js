require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { MongoClient, ObjectId } = require('mongodb');
const bcrypt = require('bcrypt');
const { spawn } = require('child_process');  
const msal = require('@azure/msal-node'); 
const PORT = process.env.PORT || 8000;
// const { spawn } = require('child_process');




// const pythonProcess = spawn("/opt/anaconda3/bin/python", ["ArticleCategorisation.py", ticker, startDate, endDate]);


const app = express();
app.use(cors());
app.use(express.json());

const uri = process.env.MONGO_URI;
const client = new MongoClient(uri);


const msalConfig = {
  auth: {
    clientId: process.env.Application_ID,
    // authority: `https://login.microsoftonline.com/${process.env.Directory_ID}`,
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
    redirectUri: "http://localhost:5050/auth/callback", 
  };

  cca.getAuthCodeUrl(authCodeUrlParameters)
    .then((url) => res.redirect(url))
    .catch((err) => res.status(500).send(err));
});

app.get('/auth/callback', async (req, res) => {
  const tokenRequest = {
    code: req.query.code,
    scopes: ["user.read"],
    redirectUri: "http://localhost:5050/auth/callback",
  };

  try {
    const response = await cca.acquireTokenByCode(tokenRequest);
    console.log("Azure Login Success:", response.account);

    res.redirect(
      `http://localhost:3000/article?user=${encodeURIComponent(response.account.username)}`
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

  const py = spawn('/opt/anaconda3/bin/python', ['ArticleCategorisation.py', ticker, start_date, end_date]);

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




app.get('/api/price', async (req, res) => {
  const { ticker = 'AAPL', timeframe = '1M' } = req.query;
  const py = spawn('python', ['app.py', 'price', ticker, timeframe]);
  let data = '';
  let error = '';
  
  py.stdout.on('data', chunk => {
    data += chunk.toString();
  });
  
  py.stderr.on('data', chunk => { 
    error += chunk.toString(); 
  });
  
  py.on('close', code => {
    console.log('=== DEBUG OUTPUT ===');
    console.log('Exit code:', code);
    console.log('Raw stdout:', JSON.stringify(data));
    console.log('Raw stderr:', JSON.stringify(error));
    console.log('First 100 chars:', data.substring(0, 100));
    console.log('==================');
    
    if (code !== 0) {
      return res.status(500).json({ 
        success: false, 
        error: `Script failed with code ${code}`,
        stderr: error,
        stdout: data
      });
    }
    
    try {
      // Clean the data more aggressively
      let cleanData = data.trim();
      
      // Remove everything before the first {
      const jsonStart = cleanData.indexOf('{');
      if (jsonStart === -1) {
        throw new Error('No JSON object found in output');
      }
      cleanData = cleanData.substring(jsonStart);
      
      // Find the end of the JSON object
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
      
      console.log('Cleaned data:', JSON.stringify(cleanData));
      const result = JSON.parse(cleanData);
      res.json(result);
      
    } catch (err) {
      console.error('JSON parse error:', err.message);
      res.status(500).json({ 
        success: false, 
        error: `Failed to parse JSON: ${err.message}`, 
        raw: data,
        stderr: error,
        firstChar: data.length > 0 ? data.charCodeAt(0) : 'empty'
      });
    }
  });
});

// --- API endpoint: Get news with sentiment ---
app.get('/api/news', async (req, res) => {
  const { ticker = 'AAPL' } = req.query;
  const py = spawn('python', ['app.py', 'news', ticker]);
  let data = '';
  let error = '';
  
  py.stdout.on('data', chunk => {
    data += chunk.toString();
  });
  
  py.stderr.on('data', chunk => { 
    error += chunk.toString(); 
  });
  
  py.on('close', code => {
    console.log('=== NEWS DEBUG ===');
    console.log('Raw output:', JSON.stringify(data));
    console.log('=================');
    
    if (code !== 0) {
      return res.status(500).json({ success: false, error, stderr: error, stdout: data });
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
      res.status(500).json({ 
        success: false, 
        error: err.message, 
        raw: data,
        stderr: error
      });
    }
  });
});

// --- API endpoint: Get significant price moves ---
app.get('/api/large_moves', async (req, res) => {
  const { ticker = 'AAPL', timeframe = '1M' } = req.query;
  const py = spawn('python', ['app.py', 'large_moves', ticker, timeframe]);
  let data = '';
  let error = '';
  py.stdout.on('data', chunk => {
  data += chunk.toString();
  });
  py.stderr.on('data', chunk => { error += chunk.toString(); });
  py.on('close', code => {
    // Filter out lines before the JSON
    const jsonStart = data.indexOf('{');
    if (jsonStart !== -1) {
      data = data.slice(jsonStart);
    }
    try {
      res.json(JSON.parse(data));
    } catch (err) {
      res.status(500).json({ success: false, error: err.message, raw: data });
    }
  });
});

// --- API endpoint: Get daily sentiment ---
app.get('/api/daily_sentiment', async (req, res) => {
  const { ticker = 'AAPL' } = req.query;
  const py = spawn('python', ['app.py', 'daily_sentiment', ticker]);
  let data = '';
  let error = '';
  py.stdout.on('data', chunk => {
  data += chunk.toString();
  });
  py.stderr.on('data', chunk => { error += chunk.toString(); });
  py.on('close', code => {
    // Filter out lines before the JSON
    const jsonStart = data.indexOf('{');
    if (jsonStart !== -1) {
      data = data.slice(jsonStart);
    }
    try {
      res.json(JSON.parse(data));
    } catch (err) {
      res.status(500).json({ success: false, error: err.message, raw: data });
    }
  });
});

// --- API endpoint: Get news around a date ---
app.get('/api/news_around_date', async (req, res) => {
  const { ticker = 'AAPL', date } = req.query;
  if (!date) return res.status(400).json({ success: false, error: 'Missing date' });
  const py = spawn('python', ['app.py', 'news_around_date', ticker, date]);
  let data = '';
  let error = '';
  py.stdout.on('data', chunk => {
  data += chunk.toString();
  });
  py.stderr.on('data', chunk => { error += chunk.toString(); });
  py.on('close', code => {
  // Filter out lines before the JSON
  const jsonStart = data.indexOf('{');
  if (jsonStart !== -1) {
    data = data.slice(jsonStart);
  }
  try {
    res.json(JSON.parse(data));
  } catch (err) {
    res.status(500).json({ success: false, error: err.message, raw: data });
  }
  });
});

// const PORT = 5050;
app.listen(PORT, () => console.log(`API running on http://localhost:${PORT}`));
