"use strict";
const url_slug = require("slug-arabic");
const axios = require("axios");
const { boomError } = require("../../../_utils/utility");
/**
 * Read the documentation (https://strapi.io/documentation/v3.x/concepts/models.html#lifecycle-hooks)
 * to customize this model
 */

const linkTextBeforeGenerate = "Publish to generate link";
const shortUrlTextBeforeGenerate = "Publish to generate short url";

async function shorten(link) {
  let origUrl = `https://web.mediatechservice.com/${link}`;
  let res = await axios.post("https://short.mediatechservice.com/api/short", {
    origUrl,
  });
  return res;
}

async function getDefaultAuhorID() {
  const defaultAuthor = await strapi.query("author").find({ DisplayName: "الأخبار" });
  return defaultAuthor[0].id;
}

async function generateLink(id, primarySectionId, slug) {
  if (primarySectionId && slug) {
    const primarySection = await strapi.query("section").findOne({ id: primarySectionId });
    const link = `${primarySection.ApiString}/${id}/${slug}`;
    return link || "";
  } else {
    const article = await strapi.query("article").findOne({ id });
    const link = `${article.PrimarySection.ApiString}/${id}/${article.Slugline}`;
    return link || "";
  }
}

//returning true means we want to produce a short link
async function havePrimarySectionChanged(articleId, model, checkHeadline) {
  if (!model.PrimarySection) return false;
  const article = await strapi.query("article").findOne({ id: articleId });
  if (article.PrimarySection.id !== model.PrimarySection) return true;
  if (checkHeadline && article.Headline !== model.Headline) return true;
  return false;
}

module.exports = {
  lifecycles: {
    async beforeCreate(model) {
      // console.log("beforeCreate", model);
      if (!model.authors) model.authors = [await getDefaultAuhorID()];
      if (model.Headline) {
        model.Slugline = url_slug(model.Headline).substr(0, 100);
      }
      if (!model.publish_at) model.publish_at = new Date();
      // if (!model.PrimarySection) model.PrimarySection = [8];
      if (!model.PrimarySection) boomError("You must select a PrimarySection");
      model.link = linkTextBeforeGenerate;
      model.ShortURL = shortUrlTextBeforeGenerate;
    },

    async beforeUpdate(params, model) {
      // console.log("beforeUpdate", params, model);
      if (!model.authors?.length) model.authors = [await getDefaultAuhorID()];
      if (!model.PrimarySection && model.published_at === undefined)
        boomError("You must select a PrimarySection");
      if (!model.publish_at) model.publish_at = new Date();
      if (model.Headline) {
        model.Slugline = url_slug(model.Headline).substr(0, 100);
      }

      const havePrimaryChanged = await havePrimarySectionChanged(params.id, model, true);

      if ((!model.link && model.published_at) || havePrimaryChanged) {
        model.link = await generateLink(params.id, model.PrimarySection, model.Slugline);
        const res = await shorten(model.link);
        model.ShortURL = res.data.shortUrl || "";
      }

      if (model.published_at === null) {
        model.link = linkTextBeforeGenerate;
        model.ShortURL = shortUrlTextBeforeGenerate;
      }
    },
  },
};
