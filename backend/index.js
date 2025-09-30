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
  // Link to app.py for price endpoint
  const py = spawn('python', ['app.py', 'price', ticker, timeframe], { cwd: __dirname });
  let data = '';
  let error = '';
  py.stdout.on('data', chunk => {
    data += chunk.toString();
  });
  py.stderr.on('data', chunk => { error += chunk.toString(); });
  py.on('close', code => {
    if (code !== 0) {
      return res.status(500).json({ success: false, error: `Script failed with code ${code}`, stderr: error, stdout: data });
    }
    try {
      const result = JSON.parse(data.trim());
      res.json(result);
    } catch (err) {
      res.status(500).json({ success: false, error: `Failed to parse JSON: ${err.message}`, raw: data, stderr: error });
    }
  });
});

// --- API endpoint: Get news with sentiment ---
app.get('/api/news', async (req, res) => {
  const { ticker = 'AAPL' } = req.query;
  // Link to app.py for news endpoint
  const py = spawn('python', ['app.py', 'news', ticker], { cwd: __dirname });
  let data = '';
  let error = '';
  py.stdout.on('data', chunk => {
    data += chunk.toString();
  });
  py.stderr.on('data', chunk => { error += chunk.toString(); });
  py.on('close', code => {
    if (code !== 0) {
      return res.status(500).json({ success: false, error, stderr: error, stdout: data });
    }
    try {
      const result = JSON.parse(data.trim());
      res.json(result);
    } catch (err) {
      res.status(500).json({ success: false, error: err.message, raw: data, stderr: error });
    }
  });
});


// --- API endpoint: Get daily sentiment ---
// app.get('/api/daily_sentiment', async (req, res) => {
//   const { ticker = 'AAPL' } = req.query;
//   // Spawn the Python script for daily sentiment
//   const py = spawn('python', ['daily_sentiment.py', ticker], { cwd: __dirname });
//   let dailyData = '';
//   let dailyError = '';
//   py.stdout.on('data', chunk => {
//     dailyData += chunk.toString();
//   });
//   py.stderr.on('data', chunk => { dailyError += chunk.toString(); });
//   py.on('close', code => {
//     // Filter out lines before the JSON
//     const jsonStart = dailyData.indexOf('{');
//     if (jsonStart !== -1) {
//       dailyData = dailyData.slice(jsonStart);
//     }
//     try {
//       res.json(JSON.parse(dailyData));
//     } catch (err) {
//       res.status(500).json({ success: false, error: err.message, raw: dailyData });
//     }
//   });
// });

// --- API endpoint: Get news around a date ---
// app.get('/api/news_around_date', async (req, res) => {
//   const { ticker = 'AAPL', date } = req.query;
//   if (!date) return res.status(400).json({ success: false, error: 'Missing date' });
//   // Spawn the Python script for news around a date
//   const py = spawn('python', ['news_around_date.py', ticker, date], { cwd: __dirname });
//   let newsDateData = '';
//   let newsDateError = '';
//   py.stdout.on('data', chunk => {
//     newsDateData += chunk.toString();
//   });
//   py.stderr.on('data', chunk => { newsDateError += chunk.toString(); });
//   py.on('close', code => {
//     // Filter out lines before the JSON
//     const jsonStart = newsDateData.indexOf('{');
//     if (jsonStart !== -1) {
//       newsDateData = newsDateData.slice(jsonStart);
//     }
//     try {
//       res.json(JSON.parse(newsDateData));
//     } catch (err) {
//       res.status(500).json({ success: false, error: err.message, raw: newsDateData });
//     }
//   });
// });
// New endpoint: /api/press_releases (calls ArticleCategorisation.py directly)
// app.get('/api/press_releases', async (req, res) => {
//   const { ticker, start_date, end_date } = req.query;
//   if (!ticker || !start_date || !end_date) {
//     return res.status(400).json({ error: 'ticker, start_date, end_date required' });
//   }
//   const py = spawn('python', ['ArticleCategorisation.py', ticker, start_date, end_date], { cwd: __dirname });
//   let data = '';
//   py.stdout.on('data', chunk => data += chunk);
//   py.stderr.on('data', err => console.error('PYTHON ERROR:', err.toString()));
//   py.on('close', code => {
//     try {
//       const result = JSON.parse(data);
//       res.json(result);
//     } catch (e) {
//       res.status(500).json({ error: 'Python script error', details: e.message });
//     }
//   });
// });
//   let data = '';
//   let error = '';
//   py.stdout.on('data', chunk => {
//   data += chunk.toString();
//   });
//   py.stderr.on('data', chunk => { error += chunk.toString(); });
//   py.on('close', code => {
//   // Filter out lines before the JSON
//   const jsonStart = data.indexOf('{');
//   if (jsonStart !== -1) {
//     data = data.slice(jsonStart);
//   }
//   try {
//     res.json(JSON.parse(data));
//   } catch (err) {
//     res.status(500).json({ success: false, error: err.message, raw: data });
//   }
//   });
// });

// const PORT = 5050;
app.listen(PORT, () => console.log(`API running on http://localhost:${PORT}`));
