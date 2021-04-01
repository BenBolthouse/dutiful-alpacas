//
// ─── ENVIRONMENT CONFIG ─────────────────────────────────────────────────────────
//

const env = process.env;

const config = {
  port: env.PORT,
  url: env.PUBLIC_IP,
  schema: env.HTTP_SCHEMA,
  version: env.VERSION,
}

module.exports = config;
