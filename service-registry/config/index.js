/******************************
 * Runtime Environment Config
 ******************************/

const env = process.env;

const config = {
  port = env.PORT,
  url = env.PUBLIC_URL,
  version = env.VERSION,
}

module.exports = config;
