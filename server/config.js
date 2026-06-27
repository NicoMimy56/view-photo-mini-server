const path = require("path");

const ROOT = path.join(__dirname, "..");
const PUBLIC_DIR = path.join(ROOT, "public");

const PORT = Number(process.env.PORT) || 3001;

const PHOTOS_DIR = path.resolve(
  process.env.PHOTOS_DIR || path.join(ROOT, "Photos")
);

const THUMBNAILS_DIR = path.resolve(
  process.env.THUMBNAILS_DIR || path.join(ROOT, "thumbnails")
);

const MAX_UPLOAD_MB = Number(process.env.MAX_UPLOAD_MB) || 50;
const MAX_UPLOAD_BYTES = MAX_UPLOAD_MB * 1024 * 1024;
const MAX_UPLOAD_FILES = Math.min(
  Math.max(Number(process.env.MAX_UPLOAD_FILES) || 100, 1),
  500
);

const THUMB_MAX_PX = Number(process.env.THUMB_MAX_PX) || 400;

const ALLOWED_EXTENSIONS = (process.env.ALLOWED_EXTENSIONS || "jpg,jpeg,png,webp,heic,heif,gif,mp4,mov,m4v")
  .split(",")
  .map((ext) => ext.trim().toLowerCase())
  .filter(Boolean);

const AUTH_ENABLED = String(process.env.AUTH_ENABLED || "true").toLowerCase() !== "false";
const AUTH_USERNAME = process.env.AUTH_USERNAME || "admin";
const AUTH_PASSWORD = process.env.AUTH_PASSWORD || "";

const FOLDER_DELETE_MODE = process.env.FOLDER_DELETE_MODE || "strict";
const REQUIRE_TYPED_CONFIRMATION =
  String(process.env.REQUIRE_TYPED_CONFIRMATION || "true").toLowerCase() !== "false";

const SESSION_TTL_MS = Number(process.env.SESSION_TTL_MS) || 1000 * 60 * 60 * 24 * 30;
const COOKIE_NAME = "viewphoto_sid";

const APP_BASE_URL = (process.env.APP_BASE_URL || `http://localhost:${PORT}`).replace(/\/$/, "");

const TRASH_DIR = path.resolve(process.env.TRASH_DIR || path.join(ROOT, ".trash"));
const TRASH_RETENTION_DAYS = Number(process.env.TRASH_RETENTION_DAYS) || 7;
const TRASH_POSTPONE_DAYS = Number(process.env.TRASH_POSTPONE_DAYS) || 3;

const LOGIN_RATE_LIMIT_MAX = Number(process.env.LOGIN_RATE_LIMIT_MAX) || 8;
const LOGIN_RATE_LIMIT_WINDOW_MS = Number(process.env.LOGIN_RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000;

const DATA_DIR = path.resolve(process.env.DATA_DIR || path.join(ROOT, "data"));

module.exports = {
  ROOT,
  PUBLIC_DIR,
  PORT,
  PHOTOS_DIR,
  THUMBNAILS_DIR,
  MAX_UPLOAD_MB,
  MAX_UPLOAD_BYTES,
  MAX_UPLOAD_FILES,
  THUMB_MAX_PX,
  ALLOWED_EXTENSIONS,
  AUTH_ENABLED,
  AUTH_USERNAME,
  AUTH_PASSWORD,
  FOLDER_DELETE_MODE,
  REQUIRE_TYPED_CONFIRMATION,
  SESSION_TTL_MS,
  COOKIE_NAME,
  APP_BASE_URL,
  TRASH_DIR,
  TRASH_RETENTION_DAYS,
  TRASH_POSTPONE_DAYS,
  LOGIN_RATE_LIMIT_MAX,
  LOGIN_RATE_LIMIT_WINDOW_MS,
  DATA_DIR
};
