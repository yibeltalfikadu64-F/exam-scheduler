'use strict';

/**
 * Consistent JSON envelope for every successful (and error) response.
 *
 * Success:
 *   { success: true,  message, data, meta: { timestamp } }
 * Error:
 *   { success: false, message, code?, details?, meta: { timestamp, path } }
 */
class ApiResponse {
  constructor(statusCode, data = null, message = 'Success') {
    this.statusCode = statusCode;
    this.data = data;
    this.message = message;
    this.success = statusCode < 400;
  }

  static success(res, data = null, message = 'Success', statusCode = 200) {
    return res.status(statusCode).json({
      success: true,
      message,
      data,
      meta: { timestamp: new Date().toISOString() },
    });
  }

  static error(res, statusCode, message = 'Error', details = null, code = null) {
    const body = {
      success: false,
      message,
      meta: { timestamp: new Date().toISOString() },
    };
    if (code) body.code = code;
    if (details) body.details = details;
    return res.status(statusCode).json(body);
  }
}

module.exports = ApiResponse;
