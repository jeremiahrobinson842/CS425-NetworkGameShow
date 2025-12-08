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
    socket = io('http://localhost:4000', {
      autoConnect: false,
      transports: ['websocket', 'polling']
    });
  }
  return socket;
}
