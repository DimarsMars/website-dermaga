require('dotenv').config();

const http = require('http');
const app = require('./app');
const initSocket = require('./config/socket');
const { startScheduler } = require('./services/scheduler.service');

const PORT = process.env.PORT || 5000;

const server = http.createServer(app);

// Attach Socket.io to the HTTP server
const io = initSocket(server);

// Make io accessible to route handlers
app.set('io', io);

// Start the booking status scheduler (checks every 60s)
startScheduler(io);

server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`WebSocket server attached`);
});

module.exports = { server, io };
