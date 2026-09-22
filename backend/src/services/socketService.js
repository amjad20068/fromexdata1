const { Server } = require('socket.io');

let io = null;

function initSocket(server, allowedOrigin = '*') {
  io = new Server(server, {
    cors: {
      origin: allowedOrigin,
      methods: ['GET', 'POST', 'PUT', 'DELETE'],
      credentials: true
    }
  });

  io.on('connection', (socket) => {
    // console.log(`⚡ Client connected via Socket.IO: ${socket.id}`);

    socket.on('disconnect', () => {
      // console.log(`Client disconnected: ${socket.id}`);
    });
  });

  return io;
}

function broadcast(event, data) {
  if (io) {
    io.emit(event, {
      ...data,
      timestamp: new Date().toISOString()
    });
    // Also broadcast generic data:changed event for unified watchers
    io.emit('data:changed', {
      event,
      ...data,
      timestamp: new Date().toISOString()
    });
  }
}

function getIo() {
  return io;
}

module.exports = {
  initSocket,
  broadcast,
  getIo
};
