"use strict";
const graphqlFields = require("graphql-fields");
const { queryBuilder, graphqlArgToQueryParam } = require("../../_utils/query");
/**
 * Read the documentation (https://strapi.io/documentation/v3.x/concepts/controllers.html#core-controllers)
 * to customize this controller
 */

module.exports = {
  async find2(root, options = {}, graphqlContext, info) {
    const ctx = graphqlContext.context;
    const params = ctx.params;
    const fields = graphqlFields(info, {}, { processArguments: true });
    // console.debug('author.find2', params);
    const res = await strapi.query("author").find(params);

    const list = [];
    for await (let author of res) {
      // console.debug('row', row.attributes);

      // based on article.authors
      if ("Articles" in fields) {
        const articleQuery = fields.Articles;
        const articleParam = graphqlArgToQueryParam(articleQuery.__arguments);

        const articleWhere = articleParam._where || {};
        articleWhere.authors_in = [author.id];
        articleParam._where = articleWhere;
        // console.debug('articles query', articleParam);

        const articleList = await strapi.query("article").find(articleParam);
        author.Articles = articleList.map((articleRow) => {
          // console.debug('res', articleRow)
          return articleRow;
        });
      }

      list.push(author);
    }

    return list;
  },
};
