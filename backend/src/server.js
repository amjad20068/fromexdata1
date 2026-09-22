const http = require('http');
const app = require('./app');
const config = require('./config/env');
const db = require('./config/db');
const { initSocket } = require('./services/socketService');
const seed = require('../database/seeds/seed');

const server = http.createServer(app);

// Initialize Socket.IO on the HTTP server
initSocket(server, config.frontendUrl);

async function startServer() {
  try {
    console.log('🔄 Checking database status & ensuring initial schema...');
    await seed();

    server.listen(config.port, () => {
      console.log('====================================================');
      console.log(`🚀 FROMEX Production Backend Running`);
      console.log(`📡 URL: http://localhost:${config.port}`);
      console.log(`🏢 PostgreSQL Engine: ${db.isEmbedded() ? 'Embedded Real PostgreSQL (PGlite)' : 'External PostgreSQL Server'}`);
      console.log(`⚡ Real-time Socket.IO Active on port ${config.port}`);
      console.log(`====================================================`);
    });
  } catch (err) {
    console.error('❌ Failed to start server:', err);
    process.exit(1);
  }
}

// Graceful shutdown handling
process.on('SIGTERM', async () => {
  console.log('SIGTERM signal received: closing HTTP server...');
  server.close(async () => {
    await db.close();
    console.log('Database connections closed.');
    process.exit(0);
  });
});

process.on('SIGINT', async () => {
  console.log('SIGINT signal received: closing HTTP server...');
  server.close(async () => {
    await db.close();
    console.log('Database connections closed.');
    process.exit(0);
  });
});

if (require.main === module) {
  startServer();
}

module.exports = { server, app };
