import './config/env';
import app from './app';
import { runBootstrap } from './bootstrap';
import { SocketService } from './shared/services/socket.service';
import logger from './shared/utils/logger';
import http from 'http';

const PORT = process.env.PORT || 5001;
const server = http.createServer(app);

const startServer = async () => {
  try {
    await runBootstrap('server');
    SocketService.init(server);

    server.listen(PORT, () => {
      logger.info(`Server running on port ${PORT}`);
    });

    server.on('error', (error: NodeJS.ErrnoException) => {
      if (error.code === 'EADDRINUSE') {
        logger.error(`Port ${PORT} is already in use`);
      } else {
        logger.error('Server error:', error);
      }
      process.exit(1);
    });
  } catch (error) {
    logger.error('Failed to start server:', error);
    process.exit(1);
  }
};

startServer();
