'use strict';

/**
 * Minimal leveled logger.
 *
 * Deliberately dependency-free (no winston) to keep the foundation lean.
 * Exposes a `stream` object so morgan's HTTP logs flow through the same
 * formatting. Swap the implementation later without touching call sites.
 */

const config = require('./environment');

const LEVELS = { error: 0, warn: 1, info: 2, http: 3, debug: 4 };
const threshold = LEVELS[config.logLevel] !== undefined ? LEVELS[config.logLevel] : LEVELS.info;

function timestamp() {
  return new Date().toISOString();
}

function format(level, args) {
  const rendered = args
    .map((arg) => {
      if (arg instanceof Error) return arg.stack || arg.message;
      if (typeof arg === 'object' && arg !== null) {
        try {
          return JSON.stringify(arg);
        } catch (err) {
          return String(arg);
        }
      }
      return String(arg);
    })
    .join(' ');
  return `[${timestamp()}] ${level.toUpperCase().padEnd(5)} ${rendered}`;
}

function emit(level, method, args) {
  if (threshold < LEVELS[level]) return;
  // eslint-disable-next-line no-console
  console[method](format(level, args));
}

const logger = {
  error: (...args) => emit('error', 'error', args),
  warn: (...args) => emit('warn', 'warn', args),
  info: (...args) => emit('info', 'log', args),
  http: (...args) => emit('http', 'log', args),
  debug: (...args) => emit('debug', 'log', args),
  // morgan expects a writable stream
  stream: {
    write: (message) => emit('http', 'log', [message.trim()]),
  },
};

module.exports = logger;
