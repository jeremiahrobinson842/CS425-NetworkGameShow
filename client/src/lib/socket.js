// client/src/lib/socket.js
import { io } from 'socket.io-client';

/**
 * Singleton Socket.io client for the Network Game Show frontend.
 *
 * We use lazy initialization so we don't connect until the UI asks for it.
 */
let socket = null;

export function getSocket() {
  if (!socket) {
    socket = io('http://localhost:4000', {
      autoConnect: false
    });
  }
  return socket;
}
