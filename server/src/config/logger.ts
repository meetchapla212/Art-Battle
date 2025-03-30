import * as winston from 'winston';

const options = {
  file: {
    level: 'info',
    filename: `${process.env.LOG_ROOT || '/var/log/vote2/'}/combined.log`,
    handleExceptions: true,
    json: true,
    maxsize: 5242880, // 5MB
    maxFiles: 5,
    colorize: false,
  },
  console: {
    level: 'debug',
    handleExceptions: true,
    json: false,
    colorize: true
  },
  console2: {
    level: 'error',
    handleExceptions: true,
    json: false,
    colorize: true
  }
};

const logger: winston.Logger = winston.createLogger({
  transports: [
    new winston.transports.File(options.file),
    new winston.transports.Console(options.console),
    new winston.transports.Console(options.console2)
  ],
  exitOnError: false, // do not exit on handled exceptions
});

export class LoggerStream {
  write(message: string) {
    logger.info(message.substring(0, message.lastIndexOf('\n')));
  }
}

export default logger;