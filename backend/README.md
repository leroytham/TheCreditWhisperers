# Backend — The Credit Whisperers

This is the backend API for The Credit Whisperers, built with Node.js, Express, and MongoDB.

## Tech Stack
- Node.js
- Express
- MongoDB
- Mongoose (ODM)
- JWT (auth)

## Features
- User registration and login endpoints
- Entity/ticker search API
- News API with sentiment scores
- Protected dashboard route
- Swagger API docs at `/api-docs`

## Getting Started

1. **Install dependencies**
   ```sh
   npm install
   ```
2. **Set up environment variables**
   - Create a `.env` file in the backend root:
     ```
     MONGO_URI=mongodb://localhost:27017
     JWT_SECRET=your_super_secret_key
     ```
3. **Start the server**
   ```sh
   node index.js
   ```
4. **API Endpoints**
   - `POST /api/auth/register` — Register a new user
   - `POST /api/auth/login` — Login and get JWT
   - `GET /api/auth/dashboard` — Protected route (requires JWT)
   - `GET /api/entity/search` — Search for companies/tickers
   - `GET /api/news` — Get news for tickers/sectors
   - `GET /api-docs` — Swagger API documentation

## Project Structure
- `src/controllers/` — Auth and business logic
- `src/models/` — Mongoose models
- `src/routes/` — Express routes
- `src/middleware/` — Auth middleware

## Notes
- Make sure MongoDB is running locally or update `MONGO_URI`.
- Use a strong `JWT_SECRET` in production.

---

See the main [README](../README.md) for full project setup.

This is the backend API for The Credit Whisperers, built with Node.js, Express, and MongoDB.

## Tech Stack
- Node.js
- Express
- MongoDB
- Mongoose (ODM)
- JWT (auth)

## Features
- User registration and login endpoints
- Entity/ticker search API
- News API with sentiment scores
- Protected dashboard route
- Swagger API docs at `/api-docs`

## Getting Started

1. **Install dependencies**
   ```sh
   npm install
   ```
2. **Set up environment variables**
   - Create a `.env` file in the backend root:
     ```
     MONGO_URI=mongodb://localhost:27017
     JWT_SECRET=your_super_secret_key
     ```
3. **Start the server**
   ```sh
   node index.js
   ```
4. **API Endpoints**
   - `POST /api/auth/register` — Register a new user
   - `POST /api/auth/login` — Login and get JWT
   - `GET /api/auth/dashboard` — Protected route (requires JWT)
   - `GET /api/entity/search` — Search for companies/tickers
   - `GET /api/news` — Get news for tickers/sectors
   - `GET /api-docs` — Swagger API documentation

## Project Structure
- `src/controllers/` — Auth and business logic
- `src/models/` — Mongoose models
- `src/routes/` — Express routes
- `src/middleware/` — Auth middleware

## Notes
- Make sure MongoDB is running locally or update `MONGO_URI`.
- Use a strong `JWT_SECRET` in production.

---

See the main [README](../README.md) for full project setup.
