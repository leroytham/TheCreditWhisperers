// __tests__/app.test.js
const request = require("supertest");

// DEPRECATED - MongoDB and bcrypt are no longer used (Microsoft Auth only)
// No need to set MONGO_URI or mock bcrypt/mongodb anymore

// Mock msal
jest.mock("@azure/msal-node", () => ({
  ConfidentialClientApplication: jest.fn(() => ({
    getAuthCodeUrl: jest.fn().mockResolvedValue("http://fake-ms-login.com"),
    acquireTokenByCode: jest.fn().mockResolvedValue({
      account: { username: "mock@user.com" }
    })
  }))
}));

const app = require("../index");
const fs = require("fs");
const path = require("path");

// Create a variable we can change inside each test
let mockOutput = "";
let mockExitCode = 0;
let mockError = "";

// Mock child_process spawn (for Python scripts)
jest.mock("child_process", () => {
  return {
    spawn: jest.fn(() => {
      const { EventEmitter } = require("events");
      const emitter = new EventEmitter();
      emitter.stdout = new EventEmitter();
      emitter.stderr = new EventEmitter();

      process.nextTick(() => {
        if (mockError) {
          emitter.stderr.emit("data", mockError);
        }
        emitter.stdout.emit("data", mockOutput);
        emitter.emit("close", mockExitCode);
      });

      return emitter;
    })
  };
});

// Mock fs for tickers.csv
jest.mock("fs", () => ({
  readFileSync: jest.fn(() => {
    return `symbol,name,quoteType,exchange
AAPL,Apple Inc.,EQUITY,NASDAQ
MSFT,Microsoft Corp.,EQUITY,NASDAQ
TSLA,Tesla Inc.,EQUITY,NASDAQ
GOOGL,Alphabet Inc.,EQUITY,NASDAQ
AMZN,Amazon.com Inc.,EQUITY,NASDAQ
NVDA,NVIDIA Corp.,EQUITY,NASDAQ
CRM,Salesforce Inc.,EQUITY,NYSE
META,Meta Platforms,EQUITY,NASDAQ
JPM,JPMorgan Chase & Co.,EQUITY,NYSE
V, Visa Inc.,EQUITY,NYSE`;
  })
}));

// Reset mocks before each test
beforeEach(() => {
  mockOutput = "";
  mockExitCode = 0;
  mockError = "";
  jest.clearAllMocks();
});

// Clean up after all tests to prevent Jest warnings
afterAll((done) => {
  // Give background processes time to complete
  setTimeout(() => {
    done();
  }, 100);
});

describe("API Routes", () => {
  // ==================== EXISTING TESTS (UNCHANGED) ====================
  test("GET / should return backend connected", async () => {
    const res = await request(app).get("/");
    expect(res.statusCode).toBe(200);
    expect(res.text).toMatch(/Backend connected/);
  });

  test("GET /login should redirect to Azure URL", async () => {
    const res = await request(app).get("/login");
    expect(res.statusCode).toBe(302);
    expect(res.headers.location).toBe("http://fake-ms-login.com");
  });

  test("GET /auth/callback should redirect to dashboard on success", async () => {
    const res = await request(app).get("/auth/callback?code=fake-code");
    expect(res.statusCode).toBe(302);
    expect(res.headers.location).toContain("financial_dashboard?user=mock%40user.com");
  });

  test("GET /articles should return mocked article", async () => {
    mockOutput = JSON.stringify([{ title: "Mock Article" }]);

    const res = await request(app).get(
      "/articles?ticker=AAPL&start_date=2023-01-01&end_date=2023-02-01"
    );

    expect(res.statusCode).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.articles[0].title).toBe("Mock Article");
  });

  test("GET /api/price should return mocked price data", async () => {
    mockOutput = JSON.stringify({
      prices: [{ date: "2023-01-01", close: 150.0 }]
    });

    const res = await request(app).get("/api/price?ticker=AAPL&timeframe=1M");
    expect(res.statusCode).toBe(200);
    expect(res.body.prices[0].close).toBe(150.0);
  });

  test("GET /api/news should return mocked news data", async () => {
    mockOutput = JSON.stringify({
      news: [{ headline: "Mock News", sentiment_label: "positive", sentiment_score: 0.9 }],
      avg_score: 0.9
    });

    const res = await request(app).get("/api/news?ticker=AAPL");
    expect(res.statusCode).toBe(200);
    expect(res.body.news[0].headline).toBe("Mock News");
    expect(res.body.avg_score).toBe(0.9);
  });

  // ==================== NEW TESTS FOR /api/search-ticker ====================
  describe("GET /api/search-ticker", () => {
    test("should return empty array for queries less than 2 characters", async () => {
      const res = await request(app).get("/api/search-ticker?q=A");
      expect(res.statusCode).toBe(200);
      expect(res.body.quotes).toEqual([]);
    });

    test("should return empty array for empty query", async () => {
      const res = await request(app).get("/api/search-ticker?q=");
      expect(res.statusCode).toBe(200);
      expect(res.body.quotes).toEqual([]);
    });

    test("should return in-memory matches for valid query (symbol match)", async () => {
      const res = await request(app).get("/api/search-ticker?q=AAP");
      expect(res.statusCode).toBe(200);
      expect(res.body.quotes.length).toBeGreaterThan(0);
      expect(res.body.quotes[0].symbol).toBe("AAPL");
    });

    test("should return in-memory matches for valid query (name match)", async () => {
      const res = await request(app).get("/api/search-ticker?q=Apple");
      expect(res.statusCode).toBe(200);
      expect(res.body.quotes.length).toBeGreaterThan(0);
      expect(res.body.quotes[0].symbol).toBe("AAPL");
    });

    test("should be case-insensitive", async () => {
      const res = await request(app).get("/api/search-ticker?q=apple");
      expect(res.statusCode).toBe(200);
      expect(res.body.quotes.length).toBeGreaterThan(0);
      expect(res.body.quotes[0].symbol).toBe("AAPL");
    });

    test("should fallback to Python when no in-memory matches found", async () => {
      mockOutput = JSON.stringify({
        quotes: [{ symbol: "UNKNOWN", shortname: "Unknown Corp", quoteType: "EQUITY" }]
      });

      const res = await request(app).get("/api/search-ticker?q=ZZZZZ");
      expect(res.statusCode).toBe(200);
      expect(res.body.quotes[0].symbol).toBe("UNKNOWN");
    });

    test("should limit results to 10 suggestions", async () => {
      const res = await request(app).get("/api/search-ticker?q=a");
      expect(res.statusCode).toBe(200);
      expect(res.body.quotes.length).toBeLessThanOrEqual(10);
    });

    test("should handle Python fallback errors gracefully", async () => {
      mockExitCode = 1;
      mockError = "Python search failed";

      const res = await request(app).get("/api/search-ticker?q=ZZZZZ");
      expect(res.statusCode).toBe(200);
      expect(res.body.quotes).toEqual([]);
      expect(res.body.error).toBeDefined();
    });
  });

  // ==================== NEW TESTS FOR /articles ERROR HANDLING ====================
  describe("GET /articles - Error Handling", () => {
    test("should return 400 when ticker is missing", async () => {
      const res = await request(app).get("/articles?start_date=2023-01-01&end_date=2023-02-01");
      expect(res.statusCode).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toContain("ticker");
    });

    test("should return 400 when start_date is missing", async () => {
      const res = await request(app).get("/articles?ticker=AAPL&end_date=2023-02-01");
      expect(res.statusCode).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toContain("start_date");
    });

    test("should return 400 when end_date is missing", async () => {
      const res = await request(app).get("/articles?ticker=AAPL&start_date=2023-01-01");
      expect(res.statusCode).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toContain("end_date");
    });

    test("should handle Python script failure", async () => {
      mockExitCode = 1;
      mockError = "Python script error";

      const res = await request(app).get("/articles?ticker=INVALID&start_date=2023-01-01&end_date=2023-02-01");
      expect(res.statusCode).toBe(500);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toContain("Python script failed");
    });

    test("should handle malformed JSON from Python", async () => {
      mockOutput = "not valid json{";

      const res = await request(app).get("/articles?ticker=AAPL&start_date=2023-01-01&end_date=2023-02-01");
      expect(res.statusCode).toBe(500);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toContain("Failed to parse Python output");
    });
  });

  // ==================== NEW TESTS FOR /api/price ERROR HANDLING ====================
  describe("GET /api/price - Error Handling & Edge Cases", () => {
    test("should use default values when no parameters provided", async () => {
      mockOutput = JSON.stringify({
        prices: [{ date: "2023-01-01", close: 150.0 }],
        company_name: "Apple Inc.",
        currency: "USD"
      });

      const res = await request(app).get("/api/price");
      expect(res.statusCode).toBe(200);
      expect(res.body.prices).toBeDefined();
    });

    test("should handle Python script failure", async () => {
      mockExitCode = 1;
      mockError = "Failed to fetch price data";

      const res = await request(app).get("/api/price?ticker=INVALID&timeframe=1M");
      expect(res.statusCode).toBe(500);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toBeDefined();
    });

    test("should handle JSON with extra non-JSON content", async () => {
      mockOutput = "Some warning message\n" + JSON.stringify({
        prices: [{ date: "2023-01-01", close: 150.0 }],
        company_name: "Apple Inc.",
        currency: "USD"
      }) + "\nExtra content";

      const res = await request(app).get("/api/price?ticker=AAPL&timeframe=1M");
      expect(res.statusCode).toBe(200);
      expect(res.body.prices[0].close).toBe(150.0);
    });

    test("should return error JSON when Python returns error", async () => {
      mockOutput = JSON.stringify({ error: "Failed to get data" });

      const res = await request(app).get("/api/price?ticker=INVALID&timeframe=1M");
      expect(res.statusCode).toBe(200);
      expect(res.body.error).toBe("Failed to get data");
    });

    test("should handle different timeframes", async () => {
      const timeframes = ['5D', '1M', '3M', '6M', 'YTD', '1Y'];
      
      for (const tf of timeframes) {
        mockOutput = JSON.stringify({
          prices: [{ date: "2023-01-01", close: 150.0 }],
          company_name: "Apple Inc.",
          currency: "USD"
        });

        const res = await request(app).get(`/api/price?ticker=AAPL&timeframe=${tf}`);
        expect(res.statusCode).toBe(200);
        expect(res.body.prices).toBeDefined();
      }
    });
  });

  // ==================== NEW TESTS FOR /api/news ERROR HANDLING ====================
  describe("GET /api/news - Error Handling & Edge Cases", () => {
    test("should use default ticker when not provided", async () => {
      mockOutput = JSON.stringify({
        news: [{ headline: "Default News" }],
        avg_score: 0.5
      });

      const res = await request(app).get("/api/news");
      expect(res.statusCode).toBe(200);
      expect(res.body.news).toBeDefined();
    });

    test("should handle Python script failure", async () => {
      mockExitCode = 1;
      mockError = "Failed to fetch news";

      const res = await request(app).get("/api/news?ticker=INVALID");
      expect(res.statusCode).toBe(500);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toBeDefined();
    });

    test("should handle malformed JSON response", async () => {
      mockOutput = "not a json response";

      const res = await request(app).get("/api/news?ticker=AAPL");
      expect(res.statusCode).toBe(500);
      expect(res.body.error).toBeDefined();
    });

    test("should handle JSON with extra content", async () => {
      mockOutput = "Warning: some message\n" + JSON.stringify({
        news: [{ 
          title: "Test News",
          sentiment_label: "positive",
          sentiment_score: 0.8
        }],
        avg_score: 0.8
      });

      const res = await request(app).get("/api/news?ticker=AAPL");
      expect(res.statusCode).toBe(200);
      expect(res.body.news[0].title).toBe("Test News");
    });

    test("should handle empty news array", async () => {
      mockOutput = JSON.stringify({
        news: [],
        avg_score: 0
      });

      const res = await request(app).get("/api/news?ticker=AAPL");
      expect(res.statusCode).toBe(200);
      expect(res.body.news).toEqual([]);
      expect(res.body.avg_score).toBe(0);
    });

    test("should handle error JSON from Python", async () => {
      mockOutput = JSON.stringify({ error: "Failed to get news" });

      const res = await request(app).get("/api/news?ticker=INVALID");
      expect(res.statusCode).toBe(200);
      expect(res.body.error).toBe("Failed to get news");
    });

    test("should return news with sentiment data", async () => {
      mockOutput = JSON.stringify({
        news: [
          { 
            title: "Positive News",
            sentiment_label: "positive",
            sentiment_score: 0.9,
            publish_date: "2023-01-01",
            provider: "Reuters"
          },
          { 
            title: "Negative News",
            sentiment_label: "negative",
            sentiment_score: -0.7,
            publish_date: "2023-01-02",
            provider: "Bloomberg"
          }
        ],
        avg_score: 0.1
      });

      const res = await request(app).get("/api/news?ticker=AAPL");
      expect(res.statusCode).toBe(200);
      expect(res.body.news).toHaveLength(2);
      expect(res.body.news[0].sentiment_label).toBe("positive");
      expect(res.body.news[1].sentiment_label).toBe("negative");
      expect(res.body.avg_score).toBe(0.1);
    });
  });

  // ==================== AZURE AUTH ERROR HANDLING ====================
  // Note: Error handling tests for Azure auth are skipped because the CCA instance
  // is created globally in index.js, making it difficult to mock failures without
  // refactoring the production code. The happy path is tested above.

  // ==================== INTEGRATION TESTS ====================
  describe("Integration Tests", () => {
    test("should handle multiple concurrent requests to /api/price", async () => {
      mockOutput = JSON.stringify({
        prices: [{ date: "2023-01-01", close: 150.0 }],
        company_name: "Apple Inc.",
        currency: "USD"
      });

      const requests = [
        request(app).get("/api/price?ticker=AAPL&timeframe=1M"),
        request(app).get("/api/price?ticker=MSFT&timeframe=1M"),
        request(app).get("/api/price?ticker=TSLA&timeframe=1M")
      ];

      const responses = await Promise.all(requests);
      responses.forEach(res => {
        expect(res.statusCode).toBe(200);
        expect(res.body.prices).toBeDefined();
      });
    });

    test("should handle multiple concurrent requests to /api/news", async () => {
      mockOutput = JSON.stringify({
        news: [{ headline: "Test" }],
        avg_score: 0.5
      });

      const requests = [
        request(app).get("/api/news?ticker=AAPL"),
        request(app).get("/api/news?ticker=MSFT"),
        request(app).get("/api/news?ticker=GOOGL")
      ];

      const responses = await Promise.all(requests);
      responses.forEach(res => {
        expect(res.statusCode).toBe(200);
        expect(res.body.news).toBeDefined();
      });
    });
  });
});