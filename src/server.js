require('dotenv').config();

const app = require('./app');

const PORT = process.env.PORT || 3000;

const server = app.listen(PORT, () => {
  console.log(`TaskFlow API listening on http://localhost:${PORT}`);
  console.log(`Swagger docs at http://localhost:${PORT}/api/v1/docs`);
});

const shutdown = (signal) => {
  console.log(`\n${signal} received. Shutting down...`);
  server.close(() => process.exit(0));
};

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
