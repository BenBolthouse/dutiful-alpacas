//
// ─── ENVIRONMENT CONFIG ─────────────────────────────────────────────────────────
//

const env = process.env;

const config = {
  environment: env.ENVIRONMENT,
  ipv: env.REGISTRY_IPV,
  port: env.PORT,
  url: env.PUBLIC_IP,
  schema: env.HTTP_SCHEMA,
  version: env.VERSION,
}

module.exports = config;
