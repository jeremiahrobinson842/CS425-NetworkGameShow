// client/src/lib/socket.js
import { io } from 'socket.io-client';

const inferredOrigin =
  typeof window !== 'undefined' && window.location?.origin
    ? window.location.origin
    : null;

let socket;

/**
 * Get a singleton Socket.io client instance.
 *
 * This avoids creating multiple WebSocket connections
 * every time a component renders.
 */
export function getSocket() {
  if (!socket) {
    const url =
      import.meta.env.VITE_WS_BASE ||
      'https://unsecretarial-maribeth-leerier.ngrok-free.dev' ||
      (inferredOrigin && inferredOrigin.startsWith('http') ? inferredOrigin : null);
    socket = io(url, {
      autoConnect: false,
      transports: ['websocket', 'polling']
    });
  }
  return socket;
}
