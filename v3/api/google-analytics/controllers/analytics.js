'use strict';
const { google } = require('googleapis')
const key = require('../auth.json')
/**
 * Read the documentation (https://strapi.io/documentation/v3.x/concepts/controllers.html#core-controllers)
 * to customize this controller
 */

const scopes = 'https://www.googleapis.com/auth/analytics.readonly'
const jwt = new google.auth.JWT(key.client_email, null, key.private_key, scopes)

const view_id = '230951217'

module.exports = {
  article: async (ctx) => {
    const response = await jwt.authorize();

    // https://content.googleapis.com/analytics/v3/data/ga?start-date=30daysAgo&end-date=yesterday&_src=embed-api%3Av1&ids=ga%3A234389191&metrics=ga%3Asessions%2Cga%3Apageviews&sort=-ga%3Apageviews&dimensions=ga%3ApagePath&output=dataTable

    const result = await google.analytics('v3').data.ga.get({
      'auth': jwt,
      'ids': 'ga:' + view_id,
      'start-date': '30daysAgo',
      'end-date': 'today',
      'metrics': 'ga:sessions,ga:pageviews',
      'sort': '-ga:pageviews',
      'dimensions': 'ga:pagePath'
    })

    ctx.body = result.data;
  }
};
