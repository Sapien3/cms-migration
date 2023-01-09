"use strict";

/**
 * Read the documentation (https://strapi.io/documentation/v3.x/concepts/models.html#lifecycle-hooks)
 * to customize this model
 */

module.exports = {
  lifecycles: {
    async afterCreate(result, data) {
      strapi.services.edition.revalidateSortedEditions();
    },
    async afterUpdate(result, params, data) {
      strapi.services.edition.revalidateSortedEditions();
    },
  },
};
