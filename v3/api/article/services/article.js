"use strict";

/**
 * Read the documentation (https://strapi.io/documentation/v3.x/concepts/services.html#core-services)
 * to customize this service
 */

const axios = require("axios");

const getRandomCategoryID = () => {
  const categoriesID = [2, 6, 7];
  const random = Math.floor(Math.random() * 2);
  return categoriesID[random];
};

module.exports = {
  uploadFromProd: async (slug, queryParams, modal) => {
    const prodUrl = "https://cms.mediatechservice.com";
    const urlToFetch = `${prodUrl}/${slug}?${queryParams}`;
    console.log("url: ", urlToFetch);
    try {
      const res = await axios.get(urlToFetch);
      //upload to strapi but first check if its headline already exists
      const data = res.data;
      data.promises = data.map(async (item) => {
        if (!item.Headline) return null;
        const uniqueField = item[modal.uniqueField];
        const existingItem = await strapi
          .query(modal.name)
          .findOne({ [modal.uniqueField]: uniqueField });
        if (existingItem) return null;
        item.PrimarySection = getRandomCategoryID();
        const newItem = await strapi.query(modal.name).create(item);
        return newItem;
      });
      const results = await Promise.all(data.promises);
      return results;
    } catch (err) {
      console.log(err);
      return err;
    }
  },
};
