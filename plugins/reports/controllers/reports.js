"use strict";
const { request, gql } = require("graphql-request");

const baseUrl = strapi.config.server.url;
const url = baseUrl + "/graphql";

const GET_ARTICLES = gql`
  query GET_ARTICLES(
    $limit: Int
    $sort: String
    $minDate: String
    $maxDate: String
    $minId: Int
    $maxId: Int
  ) {
    articles(
      limit: $limit
      sort: $sort
      where: {
        published_at_gte: $minDate
        published_at_lte: $maxDate
        id_gte: $minId
        id_lte: $maxId
      }
    ) {
      id
      Headline
      authors {
        DisplayName
        id
      }
      published_at
    }
  }
`;

async function getAuthorLink(author) {
  const data = await request(
    url,
    gql`
      query GET_AUTHOR($author: String) {
        authors(where: { DisplayName: $author }) {
          id
        }
      }
    `,
    {
      author,
    }
  );

  const link = `/cmsadmin/plugins/content-manager/collectionType/application::author.author/${data.authors[0].id}`;
  return link;
}

async function processArticles(articles) {
  if (articles.length === 0 || !articles) return { error: "No articles found" };
  let warning;
  if (articles.length === 1000)
    warning =
      "The results below are for maximum of 1000 articles. Please contact the developers if a limit increase is needed";

  // console.log("length: ", articles.length);
  const formattedData = await extractAuthorsFromArtciles(articles);
  return { warning, formattedData };
}

async function extractAuthorsFromArtciles(articles) {
  const authors = {};
  articles.forEach((article) => {
    article.authors.forEach((author) => {
      if (authors[author.DisplayName]) {
        authors[author.DisplayName].push(article);
      } else {
        authors[author.DisplayName] = [article];
      }
    });
  });

  const formattedData = await Promise.all(
    Object.keys(authors).map(async (author) => {
      return {
        author,
        headlines: authors[author].map((article) => article.Headline),
        numberOfArticles: authors[author].length,
        link: await getAuthorLink(author),
      };
    })
  );

  return formattedData;
}

async function processLastNArticles(lastNArticles) {
  const data = await request(url, GET_ARTICLES, {
    limit: parseInt(lastNArticles),
    sort: "id:desc",
  });

  return await processArticles(data.articles);
}

async function processDateRange(dateRange) {
  const data = await request(url, GET_ARTICLES, {
    minDate: dateRange[0],
    maxDate: dateRange[1],
  });

  return await processArticles(data.articles);
}

async function processIdRange(idRange) {
  const data = await request(url, GET_ARTICLES, {
    minId: parseInt(idRange[0]),
    maxId: parseInt(idRange[1]),
  });

  return await processArticles(data.articles);
}

function isParsableToInt(str) {
  return Number.isFinite(Number(str)) && str !== "";
}

async function isValidIds(idRange) {
  if (!isParsableToInt(idRange[0]) || !isParsableToInt(idRange[1]))
    return { error: "ID fields should be numbers" };
  const id1 = parseInt(idRange[0]);
  const id2 = parseInt(idRange[1]);
  if (id1 === "" || id2 === "") return { error: "ID fields can't be empty" };
  if (id1 >= id2) return { error: "starting ID should be less than ending ID" };
  const article1 = await strapi.query("article").findOne({ id: id1 });
  const article2 = await strapi.query("article").findOne({ id: id2 });
  if (!article1) return { error: `ID ${id1} doesn't exist` };
  if (!article2) return { error: `ID ${id2} doesn't exist` };
  return true;
}

module.exports = {
  getAuthors: async (ctx) => {
    const body = ctx.request.body;
    const key = Object.keys(body)[0];
    let response;
    if (key === "lastNArticles") {
      const { warning, formattedData } = await processLastNArticles(
        body.lastNArticles
      );
      response = { warning, payload: formattedData };
    }
    if (key === "formatedDate") {
      const result = await processDateRange(body.formatedDate);
      if (result.error) return ctx.send(result);
      response = { warning: result.warning, payload: result.formattedData };
    }
    if (key === "idRange") {
      const isValid = await isValidIds(body.idRange);
      if (isValid.error) return ctx.send(isValid);
      const { warning, formattedData } = await processIdRange(body.idRange);
      response = { warning, payload: formattedData };
    }

    return ctx.send(response);
  },
};
