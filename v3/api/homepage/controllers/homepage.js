"use strict";
const graphqlFields = require("graphql-fields");
const { queryBuilder, graphqlArgToQueryParam } = require("../../_utils/query");
/**
 * Read the documentation (https://strapi.io/documentation/v3.x/concepts/controllers.html#core-controllers)
 * to customize this controller
 */

const isArray = (variable) => Array.isArray(variable);
const isObject = (variable) =>
  typeof variable === "object" && !isArray(variable) && variable !== null;

function filterArrayForObjects(array) {
  return array.filter((item) => isObject(item));
}

function traverseFields(obj) {
  const articles = [];
  for (const [key, value] of Object.entries(obj)) {
    if (key === "articles" || key === "featured") {
      articles.push(value);
      continue;
    }
    if (isObject(value)) {
      articles.push(...traverseFields(value));
      continue;
    }
    if (isArray(value)) {
      const filteredArray = filterArrayForObjects(value);
      filteredArray.forEach((item) => {
        articles.push(...traverseFields(item));
      });
    }
  }
  return articles;
}

function pushLink(articleObj, links) {
  const link = articleObj.link;
  if (!link || link === "Publish to generate link") return;
  links.push(link);
}

module.exports = {
  async getLinks(ctx) {
    // get all articles links in the homepage
    const links = [];
    const query = await strapi.query("homepage").find();
    // return traverseFields(query);
    traverseFields(query).forEach((item) => {
      if (isArray(item)) {
        item.forEach((article) => {
          pushLink(article, links);
        });
        return;
      }

      //item is an object
      pushLink(item, links);
    });

    return [...new Set(links)];
  },
  async find2(root, options = {}, graphqlContext, info) {
    const ctx = graphqlContext.context;
    const params = ctx.params;
    const fields = graphqlFields(info, {}, { processArguments: true });
    // console.debug('homepage.find2', params);
    const res = await strapi.query("homepage").findOne(params);

    if ("HomepageAuthors" in fields) {
      const homepageAuthor = fields.HomepageAuthors;
      // console.debug('homepageauthor', homepageAuthor, res.HomepageAuthors);
      if ("authors" in homepageAuthor) {
        const authorQuery = homepageAuthor.authors;
        // console.debug('homepageauthor.authors:', authorQuery);
        // const authorParam = graphqlArgToQueryParam(authorQuery.__arguments);

        if ("Articles" in authorQuery) {
          if (res.HomepageAuthors) {
            for (var a = 0; a < res.HomepageAuthors.authors.length; a++) {
              const author = res.HomepageAuthors.authors[a];

              const articleParam = graphqlArgToQueryParam(authorQuery.Articles.__arguments);
              const articleWhere = articleParam._where || {};
              articleWhere.authors_in = [author.id];
              articleParam._where = articleWhere;
              // console.debug('articles query', articleParam);
              // console.debug('author', author);
              const articleList = await strapi.query("article").find(articleParam);
              author.Articles = articleList.map((articleRow) => {
                // console.debug('res', articleRow)
                return articleRow;
              });
            }
          } else {
            console.log("homepageAuthors empty", res);
          }
        } //has articles list
      }
    }

    return res;
  },
};
