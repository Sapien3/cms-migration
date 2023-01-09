"use strict";
const { writeStore } = require("../../../../store/crud");
/**
 * Read the documentation (https://strapi.io/documentation/v3.x/concepts/services.html#core-services)
 * to customize this service
 */

module.exports = {
  revalidateFeaturedMalaf: async () => {
    const newFeaturedId = await strapi.controllers.malafat.getFeaturedMalafId();
    writeStore("FeaturedMalafId", parseInt(newFeaturedId));
  },
};
