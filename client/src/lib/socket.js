// client/src/lib/socket.js
import { io } from 'socket.io-client';

let socket;

/**
 * Get a singleton Socket.io client instance.
 *
 * This avoids creating multiple WebSocket connections
 * every time a component renders.
 */
export function getSocket() {
  if (!socket) {
    const url = import.meta.env.VITE_WS_BASE || 'http://localhost:4000';
    socket = io(url, {
      autoConnect: false,
      transports: ['websocket', 'polling']
    });
  }
  return socket;
}
