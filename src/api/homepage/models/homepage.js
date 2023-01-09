"use strict";
const { boomError } = require("../../_utils/utility");
/**
 * Read the documentation (https://strapi.io/documentation/v3.x/concepts/models.html#lifecycle-hooks)
 * to customize this model
 */

// function sortIntendedFields(model){
//   const intendedFields = []
// }

function checkForConflict(model) {
  let items = [];
  for (let i = 0; i < model.TopBanner.length; i++) {
    const item = model.TopBanner[i];
    if (item.featured || item.malafat) {
      items.push(item);
    }
  }
  return items.length > 1;
}

module.exports = {
  lifecycles: {
    // async beforeUpdate(params, model) {
    //   console.debug("beforeUpdate Homepage", params, model);
    // },
    async afterUpdate(result, params, data) {
      strapi.services.malafat.revalidateFeaturedMalaf();
    },

    async beforeUpdate(params, model) {
      const doesFeaturedExist = model.TopBanner.some((item) => item.featured || item.malafat);
      if (!doesFeaturedExist) boomError("You must select a TopBanner featured article or malaf");
      if (checkForConflict(model))
        boomError("You can either have a featured article or malaf in TopBanner, not both");
    },
  },
};
