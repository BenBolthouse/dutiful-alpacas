const { createLogger, transports, format } = require("winston");
const morgan = require("morgan");
require("colors");

/**
 * Configured winston logger with console transport.
 */
const logger = createLogger({
  format: format.combine(
    format.timestamp({ format: "YYYY-MM-DD HH:mm:ss:ms" }),
    format.printf((info) => `${info.timestamp.yellow} ${info.level.cyan}: ${info.message}`)
  ),
  transports: [new transports.Console()],
});
logger.stream = {
  write: (message) =>
    logger.info(message.substring(0, message.lastIndexOf("\n"))),
};
 
/**
 * Morgan output added to logger stream, for replacement in app.use(...)
 * middleware.
 */
const httpLogger = morgan(
  ":method :url :status :response-time ms - :res[content-length]".gray,
  { stream: logger.stream }
);

module.exports = { logger, httpLogger };
