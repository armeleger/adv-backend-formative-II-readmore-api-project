const mongoose = require('mongoose');

/**
 * Router param handler for `:id`. A malformed id can never match a document,
 * so we answer 404 straight away instead of letting Mongoose throw a CastError.
 */
const validateObjectId = (resourceName) => (req, res, next, id) => {
  if (!mongoose.isValidObjectId(id)) {
    return res
      .status(404)
      .json({ message: `No ${resourceName} found with id '${id}' (not a valid id)` });
  }
  next();
};

module.exports = validateObjectId;
