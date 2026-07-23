import pino from "pino";

const isProduction = process.env.NODE_ENV === "production";
const appName = process.env.APP_NAME ?? "zerotwo-api";
const logLevel = process.env.LOG_LEVEL ?? (isProduction ? "info" : "debug");

export const logger = pino({
  name: appName,
  level: logLevel,
  base: {
    service: appName,
    env: process.env.NODE_ENV ?? "development",
    version: process.env.npm_package_version,
  },

  redact: {
    paths: [
      "authorization",
      "cookie",
      "set-cookie",
      "token",
      "accessToken",
      "access_token",
      "refreshToken",
      "refresh_token",
      "clientSecret",
      "client_secret",
      "password",
      "secret",
      "apiKey",
      "api_key",
      "req.headers.authorization",
      "req.headers.cookie",
      "req.headers['x-dev-token']",
      "res.headers['set-cookie']",
      "*.authorization",
      "*.cookie",
      "*.token",
      "*.accessToken",
      "*.access_token",
      "*.refreshToken",
      "*.refresh_token",
      "*.clientSecret",
      "*.client_secret",
      "*.password",
      "*.secret",
      "*.apiKey",
      "*.api_key",
    ],
    censor: "[redacted]",
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
            singleLine: true,
          },
        },
      }),
});

export function createChildLogger(bindings: Record<string, unknown>) {
  return logger.child(bindings);
}
