const { requireAuth } = require("../auth");

function authGuard(req, res, next) {
  return requireAuth(req, res, next);
}

module.exports = { authGuard };
