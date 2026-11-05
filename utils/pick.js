/**
 * Return a new object containing only the allowed keys that are present
 * in `source`. Used to whitelist request-body fields so clients can't set
 * fields we don't expect (e.g. _id, createdAt).
 */
const pick = (source = {}, allowedKeys = []) =>
  allowedKeys.reduce((result, key) => {
    if (source[key] !== undefined) result[key] = source[key];
    return result;
  }, {});

module.exports = pick;
