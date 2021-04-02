//
// ─── SERVICE CONFIG ─────────────────────────────────────────────────────────────
//

const colors = require("colors");
const express = require("express");

const config = require("./config");
const { logger, httpLogger } = require("./log");

const ServiceRegistry = require("./lib/ServiceRegistry");

const service = express();

service.registry = new ServiceRegistry();

// ——— Logging Config ——— //

service.use(httpLogger);

// ——— API Routing ——— //

service.put("/registry/:name/:version/:port", (req, res, _next) => {
  const { name, version, port } = req.params;
  const { ip } = req;
  const result = service.registry.registerService(name, version, ip, parseInt(port));
  return res.status(200).json({ message: result });
});

service.patch("/registry/:name/:version/:port", (req, res, _next) => {
  const { name, version, port } = req.params;
  const { ip } = req;
  service.registry.keepService(name, version, ip, parseInt(port));
  return res.status(200).json({ message: "Stayin alive, stayin alive. Oh oh oh oh stayin allliiiii..."});
});

service.delete("/registry/:name/:version/:port", (req, res, _next) => {
  const { name, version, port } = req.params;
  const { ip } = req;
  const result = service.registry.removeService(name, version, ip, parseInt(port));
  return res.status(200).json({ message: result });
});

service.get("/registry/:name/:version", (req, res, _next) => {
  const { name, version } = req.params;
  const result = service.registry.getService(name, version);
  return res.status(200).json({ service: result });
});

service.get("/registry", (_req, res, _next) => {
  const result = service.registry.getRegistry();
  return res.status(200).json({ registry: result });
});

// by default API returns 404 for non-matching urls
service.all("/*", (_req, res) => {
  return res.status(400).json({ message: "Invalid request format" });
});

// ——— Error Handling ——— //

service.use((err, _req, res, _next) => {
  const status = err.statusCode;
  const trace = config.environment === "development" 
  ? { trace: err.stack } 
  : {}
  // handle 400 range errors
  if (status && status >= 400 && status < 500) {
    logger.warning(err.message.magenta);
    return res.status(400).json({
      message: err.message,
      ...trace,
    });
  }
  // handle 500 range errors
  else if (status && status >= 500) {
    logger.error(err.message.red);
    return res.json({
      message: err.message,
      ...trace,
    });
  }
});

module.exports = service;
