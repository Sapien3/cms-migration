"use strict";
const { request, gql } = require("graphql-request");
const { readStore } = require("../../../../store/crud");
/**
 * Read the documentation (https://strapi.io/documentation/v3.x/concepts/controllers.html#core-controllers)
 * to customize this controller
 */

const baseUrl = strapi.config.server.url;

const GET_EDITIONS = gql`
  query getEditions($limit: Int, $malafat_null: Boolean, $year: [String!], $skipMalafat: Boolean!) {
    editions(limit: $limit, where: { malafat_null: $malafat_null, date_contains: $year }) {
      id
      date
      malafat @skip(if: $skipMalafat) {
        id
        MalafatFeaturedText
      }
    }
  }
`;

//converts date string of format 21/5/2021 to 2021-05-21
function convertDate(date) {
  const dateArray = date.split("/");
  const year = dateArray[2];
  const month = dateArray[1];
  const day = dateArray[0];
  return new Date(`${year}-${month}-${day}`);
}
module.exports = {
  sortEditionsByDate: async (ctx) => {
    console.time("sortEditionsByDate");
    const currentYear = new Date().getFullYear().toString();
    let years = Array.from({ length: 4 }, (v, i) => (currentYear - i).toString());
    years = [currentYear, ...years];

    const url = baseUrl + "/graphql";
    const data = await request(url, GET_EDITIONS, {
      skipMalafat: false,
      year: years,
    });
    const editions = data.editions;
    const sortedEditions = editions.sort((a, b) => {
      return convertDate(b.date) - convertDate(a.date);
    });
    const sortedEditionsWithMalafat = sortedEditions.filter((item) => !!item.malafat);
    console.timeEnd("sortEditionsByDate");
    return { sortedEditions, sortedEditionsWithMalafat };
  },
  readSortedEditionsFromStore: async (ctx) => {
    let store;
    if (ctx.query.malafat === "true") {
      store = await readStore("SortedEditionsWithMalafat");
    } else store = await readStore("SortedEditions");
    return store;
  },
  getLatestEditionMalaf: async () => {
    console.time("sortGraphql");
    const now = new Date();
    let currentYear = now.getFullYear().toString();
    const url = baseUrl + "/graphql";
    const variables = {
      year: [currentYear],
      limit: 400,
      malafat_null: false,
      skipMalafat: false,
    };
    let res = await request(url, GET_EDITIONS, variables);
    console.timeEnd("sortGraphql");

    //if this year has no malafat, search for malafat in previous years
    while (!res.editions.length) {
      const year = parseInt(--currentYear).toString();
      res = await request(url, GET_EDITIONS, { year });
    }

    //convert date string to date object
    res.editions.forEach((edition) => {
      edition.date = convertDate(edition.date);
    });

    //return the closest date to now
    return res.editions.reduce((prev, curr) => {
      return Math.abs(curr.date - now) < Math.abs(prev.date - now) ? curr : prev;
    });
  },
};
