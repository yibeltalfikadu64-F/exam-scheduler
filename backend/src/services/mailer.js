'use strict';

/**
 * Email transport (Phase 6).
 *
 * Design goals:
 *   - OPTIONAL. The core application has no mandatory mail dependency. Email is
 *     only ever attempted when `MAIL_ENABLED=true` AND `SMTP_HOST` is set AND the
 *     optional `nodemailer` package is installed. Otherwise `isConfigured()`
 *     returns false and the notification service simply keeps in-app delivery.
 *   - HONEST. `sendMail` reports `delivered: true` ONLY when the mail server
 *     accepted the message (a non-empty `accepted` list). A failure never throws
 *     and never claims success.
 *   - SAFE. Errors are sanitized and truncated; SMTP credentials are never
 *     logged or included in any error string.
 */

const config = require('../config/environment');
const logger = require('../config/logger');

let transporter = null;
let transportError = null;

function isConfigured() {
  return Boolean(config.mail.enabled && config.mail.host);
}

/** Remove any configured credentials from a message before storing/logging it. */
function sanitizeError(message) {
  let text = String(message || 'Unknown email error');
  const secrets = [config.mail.password, config.mail.user].filter(Boolean);
  for (const secret of secrets) {
    if (secret) text = text.split(secret).join('***');
  }
  text = text.replace(/pass(word)?=\S+/gi, 'password=***').replace(/auth=\S+/gi, 'auth=***');
  return text.slice(0, 300);
}

function getTransporter() {
  if (transporter || transportError) return transporter;
  if (!isConfigured()) return null;

  let nodemailer;
  try {
    // Optional dependency — resolved lazily so the app boots without it.
    // eslint-disable-next-line global-require
    nodemailer = require('nodemailer');
  } catch (error) {
    transportError = 'The optional email library (nodemailer) is not installed.';
    logger.warn(`[mailer] ${transportError}`);
    return null;
  }

  try {
    transporter = nodemailer.createTransport({
      host: config.mail.host,
      port: config.mail.port,
      secure: config.mail.secure,
      auth: config.mail.user ? { user: config.mail.user, pass: config.mail.password } : undefined,
    });
  } catch (error) {
    transportError = 'The mail transport could not be created.';
    logger.warn(`[mailer] ${transportError} ${sanitizeError(error.message)}`);
    return null;
  }
  return transporter;
}

function fromAddress() {
  const name = config.mail.fromName;
  const address = config.mail.fromAddress;
  return name ? `"${name}" <${address}>` : address;
}

/**
 * Attempt delivery. Never throws.
 * @returns {Promise<{delivered:boolean, skipped?:boolean, messageId?:string|null, error?:string|null}>}
 */
async function sendMail({ to, subject, text, html = null }) {
  if (!to) return { delivered: false, skipped: true, error: 'No recipient address is available.' };
  if (!isConfigured()) {
    return { delivered: false, skipped: true, error: 'Email delivery is not configured.' };
  }

  const transport = getTransporter();
  if (!transport) {
    return { delivered: false, skipped: true, error: transportError || 'Email transport is unavailable.' };
  }

  try {
    const info = await transport.sendMail({ from: fromAddress(), to, subject, text, ...(html ? { html } : {}) });
    const accepted = Array.isArray(info.accepted) ? info.accepted : [];
    if (accepted.length === 0) {
      return { delivered: false, skipped: false, error: 'The mail server did not accept the message.' };
    }
    return { delivered: true, messageId: info.messageId || null, error: null };
  } catch (error) {
    return { delivered: false, skipped: false, error: sanitizeError(error.message) };
  }
}

/** Test hook / useful for diagnostics. Returns no secrets. */
function getStatus() {
  return {
    configured: isConfigured(),
    enabled: config.mail.enabled,
    host: isConfigured() ? config.mail.host : null,
    port: isConfigured() ? config.mail.port : null,
    secure: config.mail.secure,
    available: Boolean(getTransporter()),
    error: transportError,
  };
}

module.exports = { isConfigured, sendMail, getStatus, sanitizeError };
