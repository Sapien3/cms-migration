"use strict";

/**
 * Read the documentation (https://strapi.io/documentation/v3.x/concepts/controllers.html#core-controllers)
 * to customize this controller
 */

module.exports = {
  serve: async (ctx) => {
    let { key } = ctx.params;
    const res = await strapi.services["s3-asset"].getAssetURL(key);
    if (res == null) {
      return ctx.throw(404);
    }

    ctx.redirect(res);
  },
};
