const createStrapi = require('strapi');

module.exports = {

  loadStrapi: async() => {
    if (!global.strapi) {
      createStrapi();
      // console.debug("strapi?", strapi.config);
      // strapi.config.functions.cron = false;// disable cron in this file
      // strapi.config.database.connections.default.options.debug = false
      await strapi.load();
    }
  }
}