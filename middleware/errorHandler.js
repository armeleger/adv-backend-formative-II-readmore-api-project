/**
 * 404 handler for routes that don't exist.
 */
const notFound = (req, res) => {
  res.status(404).json({ message: `Route not found: ${req.method} ${req.originalUrl}` });
};

/**
 * Central error handler. Express 5 forwards errors thrown in async
 * controllers here automatically, so controllers don't need try/catch
 * just to send a 500.
 */
// eslint-disable-next-line no-unused-vars
const errorHandler = (err, req, res, next) => {
  // Malformed JSON body
  if (err.type === 'entity.parse.failed') {
    return res.status(400).json({ message: 'Request body is not valid JSON' });
  }

  // Missing required fields / wrong types caught by the schema
  if (err.name === 'ValidationError') {
    const errors = Object.values(err.errors).map((e) =>
      e.name === 'CastError' ? `${e.path} has an invalid value '${e.value}'` : e.message
    );
    return res.status(400).json({ message: 'Validation failed', errors });
  }

  if (err.name === 'CastError') {
    return res.status(400).json({ message: `Invalid value '${err.value}' for ${err.path}` });
  }

  // Unique index violation (safety net behind our own duplicate checks)
  if (err.code === 11000) {
    return res.status(409).json({ message: 'A record with these details already exists' });
  }

  console.error(err);
  res.status(500).json({ message: 'Something went wrong on the server' });
};

module.exports = { notFound, errorHandler };
