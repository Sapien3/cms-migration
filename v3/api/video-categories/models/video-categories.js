"use strict";

const { boomError } = require("../../../_utils/utility");
/**
 * Read the documentation (https://strapi.io/documentation/v3.x/concepts/models.html#lifecycle-hooks)
 * to customize this model
 */

module.exports = {
  //beforesave
  lifecycles: {
    async beforeUpdate(params, model) {
      console.log("model: ", model);
      const schemaCodition = model.Category && model.videos;
      if (!schemaCodition) return;
      if (model.Category === "Featured" && !model.videos.length) {
        boomError("You must choose a video");
      }
      if (model.Category === "Featured" && model.videos.length > 1) {
        boomError("You must choose only one video");
      }
    },
  },
};
