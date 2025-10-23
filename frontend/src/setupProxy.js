/**
 * setupProxy.js - Create React App Proxy Configuration
 *
 * Industry best practice for proxying API requests in development.
 * This file is automatically loaded by Create React App and doesn't need to be imported.
 *
 * Features:
 * - Proxies REST API requests to backend server
 * - Handles WebSocket connections for real-time notifications
 * - Configures CORS properly
 * - Provides detailed logging in development
 *
 * Documentation: https://create-react-app.dev/docs/proxying-api-requests-in-development/
 */

const { createProxyMiddleware } = require('http-proxy-middleware');

module.exports = function(app) {
  // API Proxy - Route all /api/* requests to backend server
  app.use(
    '/api',
    createProxyMiddleware({
      target: process.env.REACT_APP_BACKEND_URL || 'http://localhost:8000',
      changeOrigin: true,
      logLevel: 'debug',
      onProxyReq: (proxyReq, req, res) => {
        // Log proxied requests in development
        console.log(`[Proxy] ${req.method} ${req.path} -> ${proxyReq.protocol}//${proxyReq.host}${proxyReq.path}`);
      },
      onError: (err, req, res) => {
        console.error('[Proxy Error]', err);
        res.status(500).json({
          error: 'Proxy error',
          message: err.message,
          target: process.env.REACT_APP_BACKEND_URL || 'http://localhost:8000',
        });
      },
    })
  );

  // WebSocket Proxy - Route WebSocket connections for real-time notifications
  app.use(
    '/ws',
    createProxyMiddleware({
      target: process.env.REACT_APP_WS_URL || 'ws://localhost:8000',
      ws: true, // Enable WebSocket proxying
      changeOrigin: true,
      logLevel: 'debug',
      onProxyReqWs: (proxyReq, req, socket, options, head) => {
        console.log(`[WebSocket Proxy] ${req.url} -> ${options.target.href}${req.url}`);
      },
      onError: (err, req, res) => {
        console.error('[WebSocket Proxy Error]', err);
      },
      onClose: (res, socket, head) => {
        console.log('[WebSocket] Connection closed');
      },
    })
  );

  console.log('\n✅ Proxy Configuration Loaded:');
  console.log(`   API: /api/* -> ${process.env.REACT_APP_BACKEND_URL || 'http://localhost:8000'}`);
  console.log(`   WebSocket: /ws/* -> ${process.env.REACT_APP_WS_URL || 'ws://localhost:8000'}`);
  console.log('');
};
