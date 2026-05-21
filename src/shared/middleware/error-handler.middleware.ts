import { Request, Response, NextFunction } from 'express';
import { AppError } from '../utils/app-error';
import { responseFormatter } from '../utils/response-formatter';
import logger from '../utils/logger';
import { isOriginAllowed, normalizeOrigin } from '../../config/cors.config';

function applyCorsOnError(req: Request, res: Response): void {
  const origin = req.headers.origin;
  if (typeof origin === 'string' && isOriginAllowed(origin) && !res.getHeader('Access-Control-Allow-Origin')) {
    res.setHeader('Access-Control-Allow-Origin', normalizeOrigin(origin));
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Vary', 'Origin');
  }
}

export const errorHandler = (err: any, req: Request, res: Response, next: NextFunction) => {
  applyCorsOnError(req, res);
  err.statusCode = err.statusCode || 500;
  err.status = err.status || 'error';

  if (process.env.NODE_ENV === 'development') {
    const isExpectedAuthMiss =
      err.statusCode === 401 && String(err.message).includes('No token provided');
    const log = isExpectedAuthMiss ? logger.info.bind(logger) : logger.error.bind(logger);
    log(`Error ${err.statusCode}: ${err.message}`, isExpectedAuthMiss ? {} : { stack: err.stack });
    res.status(err.statusCode).json({
      status: err.status,
      message: err.message,
      stack: err.stack,
      error: err
    });
  } else {
    // Production
    if (err.isOperational) {
      res.status(err.statusCode).json(responseFormatter.error(err.message, err.statusCode));
    } else {
      logger.error('CRITICAL ERROR:', err);
      res.status(500).json(responseFormatter.error('Something went very wrong!', 500));
    }
  }
};
