const {
  verifyCredentials,
  createSession,
  destroySession,
  getSessionUser,
  setSessionCookie,
  clearSessionCookie
} = require("../auth");
const { AUTH_ENABLED, MAX_UPLOAD_FILES, MAX_UPLOAD_MB } = require("../config");

function uploadLimitsPayload() {
  return { maxFiles: MAX_UPLOAD_FILES, maxMb: MAX_UPLOAD_MB };
}
const { loginRateLimit } = require("../middleware/rateLimit");
const { getPurgeNotification, markPendingPurge } = require("../services/trashStore");

function registerAuthRoutes(app) {
  app.get("/api/auth/me", async (req, res) => {
    if (!AUTH_ENABLED) {
      await markPendingPurge();
      const notification = await getPurgeNotification();
      return res.json({
        authenticated: true,
        username: "guest",
        authEnabled: false,
        notification,
        limits: uploadLimitsPayload()
      });
    }

    const user = getSessionUser(req);
    if (!user) {
      return res.status(401).json({ authenticated: false, authEnabled: true });
    }

    await markPendingPurge();
    const notification = await getPurgeNotification();
    return res.json({
      authenticated: true,
      username: user.username,
      authEnabled: true,
      notification,
      limits: uploadLimitsPayload()
    });
  });

  app.post("/api/auth/login", loginRateLimit, (req, res) => {
    if (!AUTH_ENABLED) {
      return res.json({ ok: true, username: "guest" });
    }

    const { username, password } = req.body || {};
    if (!verifyCredentials(username, password)) {
      return res.status(401).json({ error: "Invalid username or password." });
    }

    const token = createSession(username);
    setSessionCookie(res, token);
    return res.json({ ok: true, username, limits: uploadLimitsPayload() });
  });

  app.post("/api/auth/logout", (req, res) => {
    const user = getSessionUser(req);
    destroySession(user?.token);
    clearSessionCookie(res);
    return res.json({ ok: true });
  });
}

module.exports = { registerAuthRoutes };
