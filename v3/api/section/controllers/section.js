"use strict";
const graphqlFields = require("graphql-fields");
const { queryBuilder, graphqlArgToQueryParam } = require("../../_utils/query");
const util = require("util");
/**
 * Read the documentation (https://strapi.io/documentation/v3.x/concepts/controllers.html#core-controllers)
 * to customize this controller
 */

module.exports = {
  async find2(root, options = {}, graphqlContext, info) {
    if (!graphqlContext) {
      return "this url only works with graphql";
    }
    const ctx = graphqlContext.context;
    const params = ctx.params;
    const fields = graphqlFields(info, {}, { processArguments: true });
    // console.debug("section.find2", fields, ctx);
    const res = await queryBuilder(
      strapi.query("section").model,
      params
    ).fetchAll({ withRelated: ["CategoriesFeatured"] });

    const list = [];
    for await (let row of res) {
      // console.debug("row", row.attributes);
      const section = row.attributes;

      // based on article.PrimarySection
      if ("Article" in fields) {
        const articleQuery = fields.Article;
        const articleParam = graphqlArgToQueryParam(articleQuery.__arguments);

        const articleWhere = {};
        articleWhere.PrimarySection_in = [section.id];

        const articleSubSectionWhere = {};
        articleSubSectionWhere.Section_in = [section.id];

        articleParam._where = articleParam._where || {};
        articleParam._where = Object.assign({}, articleParam._where, {
          _or: [articleWhere, articleSubSectionWhere],
        });

        // console.debug(
        //   "article query",
        //   articleQuery.__arguments,
        //   util.inspect(articleParam, false, 4)
        // );

        // const articleList = await queryBuilder(strapi.query('article').model, articleParam).
        // fetchAll({ withRelated: ['authors', 'FeaturedImage',
        //   'SocialImage', 'TodaysNewsPaper', 'Section'] });
        const articleList = await strapi.query("article").find(articleParam);
        section.Article = articleList.map((articleRow) => {
          // console.debug('res', articleRow)
          return articleRow;
        });
      }

      list.push(section);
    }

    // console.log("list: ", list, "res: ", res);
    return list;
  },
};

/*
query Categories($category: [String!], $limit: Int, $start: Int) {
  sections(where: { ApiString: $category }, limit: $limit, start: $start) {
    Title
    ApiString
    DisplayOrder
    CategoriesFeatured {
      article {
        Headline
        Slugline
        FeaturedImage {
          url
          __typename
        }
        __typename
      }
      __typename
    }
    Icon
    __typename
  }
}

*/
