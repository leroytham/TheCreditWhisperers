// __tests__/app.test.js
const request = require("supertest");
const app = require("../index");

// Mock msal
jest.mock("@azure/msal-node", () => ({
  ConfidentialClientApplication: jest.fn(() => ({
    getAuthCodeUrl: jest.fn().mockResolvedValue("http://fake-ms-login.com"),
    acquireTokenByCode: jest.fn().mockResolvedValue({
      account: { username: "mock@user.com" }
    })
  }))
}));

// Create a variable we can change inside each test
let mockOutput = "";

// Mock child_process spawn (for Python scripts)
jest.mock("child_process", () => {
  return {
    spawn: jest.fn(() => {
      const { EventEmitter } = require("events");
      const emitter = new EventEmitter();
      emitter.stdout = new EventEmitter();
      emitter.stderr = new EventEmitter();

      process.nextTick(() => {
        emitter.stdout.emit("data", mockOutput);
        emitter.emit("close", 0);
      });

      return emitter;
    })
  };
});

describe("API Routes", () => {
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
    // ✅ only emit the array, backend wraps it
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
});
