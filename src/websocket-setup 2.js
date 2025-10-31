// WebSocket setup
const { Server } = require('socket.io');
const MarketplaceSocket = require('./api/websocket/marketplace-socket');

function setupWebSocket(server) {
  const io = new Server(server, {
    cors: {
      origin: ['https://ai-admin.app', 'http://localhost:3000', 'http://46.149.70.219:3000'],
      methods: ['GET', 'POST'],
      credentials: true
    }
  });

  // Initialize marketplace WebSocket handler
  const marketplaceSocket = new MarketplaceSocket(io);

  return io;
}

module.exports = setupWebSocket;
