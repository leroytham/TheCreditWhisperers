require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { MongoClient, ObjectId } = require('mongodb');
const bcrypt = require('bcrypt');
const { spawn } = require('child_process');  
const msal = require('@azure/msal-node'); 
const PORT = process.env.PORT || 5050;





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

// const PORT = 5050;
app.listen(PORT, () => console.log(`API running on http://localhost:${PORT}`));
