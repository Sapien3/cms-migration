"use strict";
const { readStore } = require("../../../store/crud");
/**
 * Read the documentation (https://strapi.io/documentation/v3.x/concepts/controllers.html#core-controllers)
 * to customize this controller
 */

module.exports = {
  getFeaturedMalafId: async () => {
    const homepage = await strapi.services.homepage.find();
    const featuredMalaf = homepage.TopBanner.filter((item) => !!item.malafat);
    if (featuredMalaf.length) return featuredMalaf[0].malafat.id;
    const latestMalaf = await strapi.controllers.edition.getLatestEditionMalaf();
    return latestMalaf.malafat.id;
  },
  readFeaturedFromStore: async () => {
    const store = await readStore("FeaturedMalafId");
    return store;
  },
};
