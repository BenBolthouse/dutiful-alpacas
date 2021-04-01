//
// ─── SERVICE CONFIG ─────────────────────────────────────────────────────────────
//

const express = require("express");
const morgan = require("morgan");
const logger = require("simple-node-logger").createSimpleLogger();

const service = express();

// ——— Logging Config ——— //

service.use(morgan("dev"));
service.set("log", logger);

// ——— API Routing ——— //

service.put("/register/:name/:version/:port", (req, res, next) => {
  const { name, version, port } = req.params;
  return next("Not implemented");
});

service.delete("/register/:name/:version/:port", (req, res, next) => {
  const { name, version, port } = req.params;
  return next("Not implemented");
});

service.get("/register/:name/:version", (req, res, next) => {
  const { name, version } = req.params;
  return next("Not implemented");
});

// by default API returns 404 for non-matching urls
service.all("/*", (_req, res) => {
  return res.status(404).json({
    message: "Invalid request",
  });
});

// ——— Error Handling ——— //

service.use((err, _req, res, _next) => {
  logger.error(err);
  return res.json({
    message: "Internal server error",
  });
});

module.exports = service;
