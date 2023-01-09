"use strict";
const { google } = require("googleapis");
const key = require("../auth.json");

/**
 * Read the documentation (https://strapi.io/documentation/v3.x/concepts/services.html#core-services)
 * to customize this service
 */

const googleViewId = "230951217";

module.exports = {
  retrieveTopView: async () => {
    const scopes = "https://www.googleapis.com/auth/analytics.readonly";
    const jwt = new google.auth.JWT(
      key.client_email,
      null,
      key.private_key,
      scopes
    );

    const response = await jwt.authorize();

    // https://content.googleapis.com/analytics/v3/data/ga?start-date=30daysAgo&end-date=yesterday&_src=embed-api%3Av1&ids=ga%3A234389191&metrics=ga%3Asessions%2Cga%3Apageviews&sort=-ga%3Apageviews&dimensions=ga%3ApagePath&output=dataTable
    // console.debug('retrieving...');
    const result = await google.analytics("v3").data.ga.get({
      auth: jwt,
      ids: "ga:" + googleViewId,
      "start-date": "30daysAgo",
      "end-date": "today",
      metrics: "ga:sessions,ga:pageviews",
      sort: "-ga:pageviews",
      dimensions: "ga:pagePath",
      "max-results": 100,
    });

    // console.debug('result', result);
    const savedTopArticle = [];
    for (var c = 0; c < result.data.rows.length; c++) {
      const res = result.data.rows[c];
      // console.debug("row", res);
      const [url, sessionCount, viewCount] = res;
      const topArticle = await strapi
        .query("top-article")
        .findOne({ url: url });
      let articleID = null;
      if (url.startsWith("/article/")) {
        const slugLine = url.replace("/article/", "");
        const article = await strapi
          .query("article")
          .findOne({ Slugline: slugLine });
        if (article == null) {
          if (process.env.NODE_ENV == "production") {
            // throw Error(`Missing article for top url: ${url}, slugline: ${slugLine}`);
          }
          console.error(
            `Missing article for top url: ${url}, slugline: ${slugLine}`
          );
          continue; //skip it since havent finish import
        } else {
          articleID = article.id;
        }
      }
      if (topArticle == null) {
        // console.debug('inserting', url, viewCount);
        topArticle = await strapi.query("top-article").create({
          url: url,
          session: sessionCount,
          view: viewCount,
          article: articleID,
        });
      } else {
        // console.debug('updating', url, viewCount);
        await strapi.query("top-article").update(
          { id: topArticle.id },
          {
            session: sessionCount,
            view: viewCount,
            article: articleID,
          }
        );
      }

      savedTopArticle.push(topArticle.id);
    }
    // delete old stats
    await strapi.query("top-article").delete({ id_nin: savedTopArticle });

    return result;
  },
};
