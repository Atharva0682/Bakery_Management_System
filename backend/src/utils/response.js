/**
 * Standard API Response Envelope Utility
 * Consistent structure across all platform endpoints
 */

const successResponse = (res, data, statusCode = 200) => {
  return res.status(statusCode).json({
    success: true,
    data,
  });
};

const errorResponse = (res, code, message, statusCode = 400, details = null) => {
  const payload = {
    success: false,
    error: {
      code,
      message,
    },
  };

  if (details && process.env.NODE_ENV !== 'production') {
    payload.error.details = details;
  }

  return res.status(statusCode).json(payload);
};

module.exports = {
  successResponse,
  errorResponse,
};
