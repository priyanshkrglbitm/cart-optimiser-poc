import * as winston from 'winston';
import 'winston-daily-rotate-file';

// Same setup as ets-backend: console + daily log files, one line per log:
// 2026-11-01 00:32:54 # info # BasketService # Done in 736ms
const plainFormat = winston.format.printf(({ timestamp, level, message, context, stack }) => {
  const line = `${timestamp} # ${level} # ${context ?? 'App'} # ${message}`;
  return stack ? `${line} # ${stack}` : line;
});

const timestamp = winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' });

export const winstonLogger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info', // error | warn | info | debug | verbose
  format: winston.format.combine(
    timestamp,
    winston.format.errors({ stack: true }), // include stack for errors
    plainFormat,
  ),
  transports: [
    // Console
    new winston.transports.Console({
      format: winston.format.combine(winston.format.colorize(), timestamp, plainFormat),
    }),

    // Everything: logs/app-YYYY-MM-DD.log
    new winston.transports.DailyRotateFile({
      dirname: 'logs',
      filename: 'app-%DATE%.log',
      datePattern: 'YYYY-MM-DD',
      zippedArchive: true,
      maxSize: '20m',
      maxFiles: '14d', // keep 14 days
    }),

    // Errors only: logs/error-YYYY-MM-DD.log
    new winston.transports.DailyRotateFile({
      dirname: 'logs',
      filename: 'error-%DATE%.log',
      datePattern: 'YYYY-MM-DD',
      zippedArchive: true,
      maxSize: '20m',
      maxFiles: '30d',
      level: 'error',
    }),
  ],
});
