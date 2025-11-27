import { useEffect, useRef, useState } from 'react';
import useAppStore from '../../../store/useAppStore';

/**
 * Custom hook for WebSocket connection to receive real-time notifications
 *
 * Handles connection, reconnection, and message processing
 *
 * @param {string} clientId - Unique client identifier
 * @param {Object} options - Configuration options
 * @returns {Object} - WebSocket state and control methods
 */
export const useNotificationSocket = (clientId, options = {}) => {
  const {
    autoConnect = true,
    reconnectInterval = 5000,
    maxReconnectAttempts = 10,
    onMessage,
    onConnect,
    onDisconnect,
    onError,
  } = options;

  const [isConnected, setIsConnected] = useState(false);
  const [reconnectCount, setReconnectCount] = useState(0);
  const [hasError, setHasError] = useState(false);
  const websocketRef = useRef(null);
  const reconnectTimerRef = useRef(null);
  const mountedRef = useRef(true); // Track if component is mounted
  const connectionAttemptRef = useRef(0); // Track connection attempts
  const keepaliveCleanupRef = useRef(null); // Store keepalive interval cleanup
  const { addToast } = useAppStore();

  // Get WebSocket URL based on environment
  const getWebSocketUrl = () => {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    // Always use window.location.host to go through the proxy in development
    // The setupProxy.js will forward /ws/* to the backend
    const host = window.location.host;
    return `${protocol}//${host}/ws/notifications/${clientId}`;
  };

  const connect = () => {
    // Check if already connected or connecting
    if (websocketRef.current?.readyState === WebSocket.OPEN) {
      console.log('WebSocket already connected');
      return;
    }

    if (websocketRef.current?.readyState === WebSocket.CONNECTING) {
      console.log('WebSocket connection in progress');
      return;
    }

    // Prevent connection if component unmounted (StrictMode cleanup)
    if (!mountedRef.current) {
      console.log('Skipping WebSocket connection - component unmounted');
      return;
    }

    connectionAttemptRef.current += 1;
    const attemptNumber = connectionAttemptRef.current;

    try {
      const url = getWebSocketUrl();
      console.log(`[Attempt ${attemptNumber}] Connecting to WebSocket:`, url);

      const ws = new WebSocket(url);

      ws.onopen = () => {
        // Only update state if still mounted and this is the current attempt
        if (!mountedRef.current || ws !== websocketRef.current) {
          console.log('WebSocket opened but component unmounted or connection replaced');
          ws.close();
          return;
        }

        console.log('✅ WebSocket connected');
        setIsConnected(true);
        setReconnectCount(0);
        setHasError(false);
        if (onConnect) onConnect();

        // Start ping/pong keepalive and store cleanup function
        keepaliveCleanupRef.current = startKeepalive(ws);
      };

      ws.onmessage = (event) => {
        if (!mountedRef.current) return;

        try {
          const data = JSON.parse(event.data);
          console.log('📨 WebSocket message:', data);

          if (data.type === 'notification') {
            // Add toast for UI display
            addToast(data.data);
          } else if (data.type === 'ticker_update') {
            // Handle ticker-specific updates
            addToast({
              ...data.data,
              metadata: { ticker: data.ticker },
            });
          }

          if (onMessage) onMessage(data);
        } catch (error) {
          console.error('Error parsing WebSocket message:', error);
        }
      };

      ws.onerror = (error) => {
        if (!mountedRef.current) return;

        console.error('❌ WebSocket error:', {
          error,
          readyState: ws.readyState,
          url: ws.url,
          protocol: ws.protocol,
          attemptNumber,
          reconnectCount
        });
        console.error('WebSocket ReadyState values: 0=CONNECTING, 1=OPEN, 2=CLOSING, 3=CLOSED');
        setHasError(true);
        if (onError) onError(error);
      };

      ws.onclose = (event) => {
        if (!mountedRef.current) {
          console.log('WebSocket closed after component unmount');
          return;
        }

        console.log('WebSocket disconnected', {
          code: event.code,
          reason: event.reason,
          wasClean: event.wasClean,
          attemptNumber,
          reconnectCount
        });
        setIsConnected(false);
        if (onDisconnect) onDisconnect();

        // Only attempt to reconnect if:
        // 1. Component is still mounted
        // 2. Haven't exceeded max attempts
        // 3. Wasn't a normal closure (code 1000)
        const shouldReconnect =
          mountedRef.current &&
          reconnectCount < maxReconnectAttempts &&
          event.code !== 1000;

        if (shouldReconnect) {
          console.log(`Reconnecting in ${reconnectInterval}ms... (attempt ${reconnectCount + 1}/${maxReconnectAttempts})`);
          reconnectTimerRef.current = setTimeout(() => {
            if (mountedRef.current) {
              setReconnectCount((prev) => prev + 1);
              connect();
            }
          }, reconnectInterval);
        } else if (reconnectCount >= maxReconnectAttempts && event.code !== 1000) {
          console.warn('Max reconnection attempts reached - WebSocket unavailable');
          setHasError(true);
          // Only show error toast after max attempts in production
          if (process.env.NODE_ENV === 'production') {
            addToast({
              type: 'warning',
              title: 'Real-time Updates Unavailable',
              message: 'Unable to connect to real-time notifications. You can still use the app, but won\'t receive live updates.',
              category: 'System',
              priority: 'medium',
            });
          }
        }
      };

      websocketRef.current = ws;
    } catch (error) {
      console.error('Failed to create WebSocket:', error);
      setHasError(true);
      if (onError) onError(error);
    }
  };

  const disconnect = () => {
    mountedRef.current = false; // Mark as unmounted

    // Clear keepalive interval first
    if (keepaliveCleanupRef.current) {
      keepaliveCleanupRef.current();
      keepaliveCleanupRef.current = null;
    }

    if (reconnectTimerRef.current) {
      clearTimeout(reconnectTimerRef.current);
      reconnectTimerRef.current = null;
    }

    if (websocketRef.current) {
      // Close with normal closure code
      if (websocketRef.current.readyState === WebSocket.OPEN ||
          websocketRef.current.readyState === WebSocket.CONNECTING) {
        websocketRef.current.close(1000, 'Component unmounting');
      }
      websocketRef.current = null;
    }

    setIsConnected(false);
  };

  const send = (message) => {
    if (websocketRef.current?.readyState === WebSocket.OPEN) {
      websocketRef.current.send(JSON.stringify(message));
    } else {
      console.warn('WebSocket is not connected');
    }
  };

  const subscribe = (ticker) => {
    send({
      type: 'subscribe',
      ticker: ticker.toUpperCase(),
    });
  };

  const unsubscribe = (ticker) => {
    send({
      type: 'unsubscribe',
      ticker: ticker.toUpperCase(),
    });
  };

  const startKeepalive = (ws) => {
    const interval = setInterval(() => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: 'ping' }));
      } else {
        clearInterval(interval);
      }
    }, 30000); // Ping every 30 seconds

    return () => clearInterval(interval);
  };

  // Auto-connect on mount
  useEffect(() => {
    mountedRef.current = true; // Mark as mounted

    if (autoConnect && clientId) {
      // Connect immediately - proper cleanup handles StrictMode double-mount
      if (mountedRef.current && !websocketRef.current) {
        connect();
      }

      return () => {
        disconnect();
      };
    }

    return () => {
      disconnect();
    };
  }, [clientId, autoConnect]);

  return {
    isConnected,
    reconnectCount,
    hasError,
    connect,
    disconnect,
    send,
    subscribe,
    unsubscribe,
  };
};

/**
 * Example usage:
 *
 * const { isConnected, subscribe, unsubscribe } = useNotificationSocket('user-123', {
 *   onConnect: () => console.log('Connected!'),
 *   onMessage: (data) => console.log('Received:', data),
 * });
 *
 * // Subscribe to ticker updates
 * subscribe('AAPL');
 *
 * // Later, unsubscribe
 * unsubscribe('AAPL');
 */
