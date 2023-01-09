"use strict";
const { writeStore } = require("../../../../store/crud");

/**
 * Read the documentation (https://strapi.io/documentation/v3.x/concepts/services.html#core-services)
 * to customize this service
 */

module.exports = {
  revalidateSortedEditions: async () => {
    const { sortedEditions, sortedEditionsWithMalafat } =
      await strapi.controllers.edition.sortEditionsByDate();
    writeStore("SortedEditions", sortedEditions);
    writeStore("SortedEditionsWithMalafat", sortedEditionsWithMalafat);
  },
};
