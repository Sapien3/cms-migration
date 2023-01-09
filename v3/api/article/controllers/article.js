"use strict";

/**
 * Read the documentation (https://strapi.io/documentation/v3.x/concepts/controllers.html#core-controllers)
 * to customize this controller
 */

const axios = require("axios");

module.exports = {
  getArticleUrl: async (ctx) => {
    const params = ctx.params;
    const id = params.id;
    const article = await strapi.query("article").findOne({ id });
    return article.link || "";
  },
  // get uploadFromProd from services
  uploadFromProd: async (ctx) => {
    const { modalPath, queryParams } = ctx.params;
    return strapi.services.article.uploadFromProd(modalPath, queryParams, {
      name: "article",
      uniqueField: "Headline",
    });
  },
};
