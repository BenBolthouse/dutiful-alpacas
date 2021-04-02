//
// ─── SERVICE CONFIG ─────────────────────────────────────────────────────────────
//

const colors = require("colors");
const express = require("express");

const config = require("./config");
const { logger, httpLogger } = require("./log");

const ServiceRegistry = require("./lib/ServiceRegistry");

const serviceRegistry = new ServiceRegistry();

const service = express();

// ——— Logging Config ——— //

service.use(httpLogger);

// ——— API Routing ——— //

service.put("/registry/:name/:version/:port", (req, res, next) => {
  const { name, version, port } = req.params;
  const { ip } = req;
  const result = serviceRegistry.registerService(name, version, ip, parseInt(port));
  return res.status(200).json({ message: result });
});

service.delete("/registry/:name/:version/:port", (req, res, next) => {
  const { name, version, port } = req.params;
  const { ip } = req;
  const result = serviceRegistry.removeService(name, version, ip, parseInt(port));
  return res.status(200).json({ message: result });
});

service.get("/registry/:name/:version", (req, res, next) => {
  const { name, version } = req.params;
  const result = serviceRegistry.getService(name, version);
  return res.status(200).json({ service: result });
});

service.get("/registry", (req, res, next) => {
  const result = serviceRegistry.getRegistry();
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
    logger.error(err.message.magenta);
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
