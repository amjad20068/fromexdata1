const express = require('express');
const router = express.Router();

const clients = new Set();

router.get('/events', (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.flushHeaders();

  const client = {
    id: Date.now() + Math.random(),
    res
  };
  clients.add(client);

  // Initial handshake
  res.write(`event: connected\ndata: ${JSON.stringify({ message: 'Connected to FROMEX Realtime Sync Engine', activeClients: clients.size })}\n\n`);

  // Periodic heartbeat every 25 seconds to keep connection alive
  const heartbeat = setInterval(() => {
    try {
      res.write(': heartbeat\n\n');
    } catch (e) {
      clearInterval(heartbeat);
      clients.delete(client);
    }
  }, 25000);

  req.on('close', () => {
    clearInterval(heartbeat);
    clients.delete(client);
  });
});

function broadcast(event, data) {
  const payload = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
  for (const client of clients) {
    try {
      client.res.write(payload);
    } catch (err) {
      clients.delete(client);
    }
  }
}

module.exports = {
  router,
  broadcast
};
