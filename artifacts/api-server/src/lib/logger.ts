import pino from "pino";

const isProduction = process.env.NODE_ENV === "production";

export const logger = pino({
  // (ej: debug en dev, info en prod)
  level: process.env.LOG_LEVEL ?? (isProduction ? "info" : "debug"),

  redact: {
    paths: [
      "req.headers.authorization",
      "req.headers.cookie",
      "res.headers['set-cookie']",
      "process.env.DISCORD_TOKEN",
      "process.env.DATABASE_URL",
    ],
    remove: true,
  },

  serializers: {
    err: pino.stdSerializers.err,
    req: pino.stdSerializers.req,
    res: pino.stdSerializers.res,
  },

  timestamp: pino.stdTimeFunctions.isoTime,

  ...(isProduction
    ? {}
    : {
        transport: {
          target: "pino-pretty",
          options: {
            colorize: true,
            ignore: "pid,hostname",
            translateTime: "SYS:yyyy-mm-dd HH:MM:ss",
          },
        },
      }),
});
