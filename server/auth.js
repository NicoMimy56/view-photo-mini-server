const crypto = require("crypto");
const {
  AUTH_ENABLED,
  AUTH_USERNAME,
  AUTH_PASSWORD,
  SESSION_TTL_MS,
  COOKIE_NAME
} = require("./config");

/** @type {Map<string, { username: string, expiresAt: number }>} */
const sessions = new Map();

function parseCookies(req) {
  const cookieHeader = req.headers.cookie;
  if (!cookieHeader) return {};
  return cookieHeader.split(";").reduce((acc, item) => {
    const [key, ...rest] = item.trim().split("=");
    acc[key] = decodeURIComponent(rest.join("="));
    return acc;
  }, {});
}

function setSessionCookie(res, token) {
  const maxAge = SESSION_TTL_MS / 1000;
  res.setHeader(
    "Set-Cookie",
    `${COOKIE_NAME}=${token}; Max-Age=${maxAge}; HttpOnly; Path=/; SameSite=Lax`
  );
}

function clearSessionCookie(res) {
  res.setHeader("Set-Cookie", `${COOKIE_NAME}=; Max-Age=0; HttpOnly; Path=/; SameSite=Lax`);
}

function purgeExpiredSessions() {
  const now = Date.now();
  for (const [token, session] of sessions.entries()) {
    if (session.expiresAt <= now) {
      sessions.delete(token);
    }
  }
}

function createSession(username) {
  purgeExpiredSessions();
  const token = crypto.randomBytes(32).toString("hex");
  sessions.set(token, { username, expiresAt: Date.now() + SESSION_TTL_MS });
  return token;
}

function destroySession(token) {
  if (token) sessions.delete(token);
}

function getSessionUser(req) {
  purgeExpiredSessions();
  const cookies = parseCookies(req);
  const token = cookies[COOKIE_NAME];
  if (!token) return null;

  const session = sessions.get(token);
  if (!session) return null;

  if (session.expiresAt <= Date.now()) {
    sessions.delete(token);
    return null;
  }

  return { username: session.username, token };
}

function verifyCredentials(username, password) {
  if (!AUTH_ENABLED) return true;
  if (!AUTH_PASSWORD) return false;
  return username === AUTH_USERNAME && password === AUTH_PASSWORD;
}

function requireAuth(req, res, next) {
  if (!AUTH_ENABLED) {
    req.user = { username: "guest" };
    return next();
  }

  const user = getSessionUser(req);
  if (!user) {
    return res.status(401).json({ error: "Authentication required." });
  }

  req.user = user;
  return next();
}

module.exports = {
  parseCookies,
  setSessionCookie,
  clearSessionCookie,
  createSession,
  destroySession,
  getSessionUser,
  verifyCredentials,
  requireAuth
};
