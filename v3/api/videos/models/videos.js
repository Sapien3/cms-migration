"use strict";

const { boomError } = require("../../../_utils/utility");

/**
 * Read the documentation (https://strapi.io/documentation/v3.x/concepts/models.html#lifecycle-hooks)
 * to customize this model
 */

module.exports = {
  lifecycles: {
    async beforeCreate(model) {
      await validate(model);
    },
    async beforeUpdate(params, model) {
      await validate(model);
    },
  },
};

function validate(model) {
  //check if category Featured is chosen
  const promises = [];
  model.VideoCategories.forEach((categoryID) => {
    const promise = strapi.query("video-categories").findOne({ id: categoryID });
    promises.push(promise);
  });

  return Promise.all(promises).then((models) => {
    const featured = models.find((model) => model.Category === "Featured");
    if (featured) boomError("Featured category cannot be choosen from this section");
  });
}
