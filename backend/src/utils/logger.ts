import * as winston from "winston";

export const logger = winston.createLogger({
	level: process.env.LOG_LEVEL || "info",
	format: winston.format.combine(
		winston.format.timestamp({ format: "YYYY-MM-DD HH:mm:ss" }),
		winston.format.errors({ stack: true }),
		winston.format.splat(),
		winston.format.json(),
	),
	defaultMeta: { service: "mt" },
	transports: [
		new winston.transports.Console({
			format: winston.format.combine(winston.format.colorize(), winston.format.simple()),
		}),
		new winston.transports.File({
			filename: "logs/error.log",
			level: "error",
			// Cap file growth — backend/logs once reached 215M with no rotation.
			maxsize: 10_000_000,
			maxFiles: 3,
		}),
		new winston.transports.File({
			filename: "logs/combined.log",
			maxsize: 10_000_000,
			maxFiles: 3,
		}),
	],
});
