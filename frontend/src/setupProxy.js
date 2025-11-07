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
  const backendUrl = process.env.REACT_APP_BACKEND_URL || 'http://localhost:8000';

  // API Proxy - Route all /api/* requests to backend server
  app.use(
    '/api',
    createProxyMiddleware({
      target: backendUrl,
      changeOrigin: true,
      pathRewrite: {'^/api': ''}, // Remove /api prefix when forwarding to backend
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
          target: backendUrl,
        });
      },
    })
  );

  // WebSocket Proxy - Route WebSocket connections for real-time notifications
  app.use(
    '/ws',
    createProxyMiddleware({
      target: backendUrl,
      ws: true, // Enable WebSocket proxying
      changeOrigin: true,
      logLevel: 'debug',
      // Timeout configuration for WebSocket connections
      proxyTimeout: 30000, // 30 seconds
      timeout: 30000,
      // Headers for WebSocket upgrade
      headers: {
        Connection: 'Upgrade',
        Upgrade: 'websocket',
      },
      onProxyReqWs: (proxyReq, req, socket, options, head) => {
        console.log(`[WebSocket Proxy] ${req.url} -> ${options.target.href}${req.url}`);
        console.log('[WebSocket Proxy] Connection upgrade initiated');

        // Handle socket errors
        socket.on('error', (err) => {
          console.error('[WebSocket Socket Error]', err);
        });
      },
      onOpen: (proxySocket) => {
        console.log('[WebSocket Proxy] Connection opened successfully');

        proxySocket.on('error', (err) => {
          console.error('[WebSocket Proxy Socket Error]', err);
        });
      },
      onError: (err, req, res) => {
        console.error('[WebSocket Proxy Error]', {
          message: err.message,
          code: err.code,
          url: req.url,
          target: backendUrl,
        });

        // Send error response if possible
        if (res && !res.headersSent) {
          res.status(500).json({
            error: 'WebSocket Proxy Error',
            message: err.message,
            code: err.code,
          });
        }
      },
      onClose: (res, socket, head) => {
        console.log('[WebSocket] Connection closed');
      },
    })
  );

  console.log('\n✅ Proxy Configuration Loaded:');
  console.log(`   Backend URL: ${backendUrl}`);
  console.log(`   API: /api/* -> ${backendUrl}/*`);
  console.log(`   WebSocket: /ws/* -> ${backendUrl}/ws/*`);
  console.log(`   Path rewrite: /api -> / (removes /api prefix)`);
  console.log('');
};
