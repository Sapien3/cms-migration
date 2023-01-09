const createStrapi = require('strapi');
const sql = require("mssql");
const url_slug = require('slug-arabic');
const util = require('util');
const fs = require('fs');
const moment = require('moment');
const { queryBuilder } = require('../api/_utils/query');

let sqlinstance;
let cached = {};

let config = {
  user: 'akbhar',
  password: 'reallyStrongPwd123',
  server: '127.0.0.1',
  database: 'JaridaDB',
  requestTimeout: 180000
}
if (process.env.NODE_ENV == 'production') {
  config = {
    user: 'wick',
    password: '@khbar210104',
    server: '10.10.100.26',
    database: 'JaridaDB',
    requestTimeout: 180000
  }
}
let loadedStrapi = false;

module.exports = {

  /**
   * 
   * @param {*} offset 
   * @param {*} limit 
   * @param {*} request 
   * @param {*} onRecord = function() callback return { inserted: #, updated: # }
   */
  processBatchSQL: async (offset, limit, request, onRecord) => {
    return new Promise((resolve, reject) => {
      let insertedRow = 0;
      let updatedRow = 0;
      let foundRow = 0;
      let batch = [];
  
      request.on('row', async (article) => {
        request.pause();
        if (batch.length == 0) {
          firstInBatch = article.ArticleID;
        }
  
        batch.push(onRecord(article, foundRow));
        if (batch.length >= 3) {
          console.debug('waiting article', firstInBatch);
          const res = await Promise.all(batch);
          for(let c=0; c < res.length; c++) {
            const { inserted, updated } = res[c];
            insertedRow += inserted;
            updatedRow += updated;
          }
          batch = []
        }
        foundRow += 1;
        request.resume();
      });
  
      request.on('error', (err) => {
        console.error("sql error: ", err);
        reject();
      });
  
      request.on('done', async () => {
        if (batch.length > 0) {
          console.debug('waiting final article', firstInBatch);
          await Promise.all(batch);
          batch = []
        }
  
        console.info(`total ${foundRow}, Done!`);
        resolve({ insertedRow, updatedRow, foundRow });
      });
  
      
    })
  },

  loadStrapi: async () => {
    if (!loadedStrapi) {
      createStrapi();
      // console.debug("strapi?", strapi.config);
      strapi.config.functions.cron = false;// disable cron in this file
      strapi.config.database.connections.default.options.debug = false
      await strapi.load();
      loadedStrapi = true;
    }
  },

  insertOrUpdate: async (modelName, updateCond, values = {}, bypassUpdate = false, onSave = null, opt = { debug: true }) => {
    const row = await strapi.query(modelName).findOne(updateCond);

    if (row != null) {
      if (bypassUpdate) {
        if (opt.debug) {
          console.debug("skip", modelName, updateCond);
        }
        return {
          action: 'skip'
        }
      }

      const data = onSave == null ? values : await onSave(values);
      if (opt.debug) {
        console.debug("updating", modelName, data);
      }

      return {
        action: 'update',
        result: await strapi.query(modelName).update(updateCond, data)
      };
    }

    const data = onSave == null ? values : await onSave(values);
    if (opt.debug) {
      console.debug("insert", modelName, data);
    }

    return {
      action: 'insert',
      result: await strapi.query(modelName).create(data)
    };
  },

  findArticle: async (shortURL) => {
    const row = await queryBuilder(strapi.query('article').model, { _where: { ShortURL: shortURL } }).fetch({ withRelated: [] });
    // console.debug('found article', row);
    if (row == null) {
      return null;
    }
    return row.attributes;
  },

  findEditionID: async (editionNumber) => {
    const res = await strapi.query('edition').model.where('EditionNumber', '=', editionNumber).fetch({ columns: "id" });// DisplayName: displayName });
    // let res = await strapi.query("tag-type").findOne({ Title: title });
    if (res == null) {
      return null;
    }
    return res.id;
  },

  findTagTypeID: async (title) => {
    let res = await strapi.query("tag-type").model.where('Title', '=', title).fetch({ columns: "id" });// DisplayName: displayName });
    // let res = await strapi.query("tag-type").findOne({ Title: title });
    if (res == null) {
      return null;
    }
    return res.id;
  },

  findAuthorID: async (displayName) => {
    if (!cached.authorID) {
      cached.authorID = {}
    }

    if (displayName in cached.authorID) {
      // console.debug("findAuthorID", displayName, "cached", cached.authorID[displayName]);
      return cached.authorID[displayName];
    }

    let res = await strapi.query("author").model.where('DisplayName', '=', displayName).fetch({ columns: "id" });// DisplayName: displayName });
    if (res == null) {
      cached.authorID[displayName] = null;
      return null;
    }

    cached.authorID[displayName] = res.id;
    return res.id;
  },
  findSupplementCategoryID: async (name) => {
    let res = await strapi.query("supplements-categories").model.where('SupplementCategoryTitle', '=', name).fetch({ columns: "*" });
    // let res = await strapi.query("supplements-categories").findOne({ SupplementCategoryTitle: name });
    if (res == null) {
      return null;
    }
    return res.id;
  },
  findSectionDocId: async (api) => {
    if (!cached.sectionID) {
      cached.sectionID = {}
    }

    if (api in cached.sectionID) {
      // console.debug("findSectionDocId", api, "cached", cached.sectionID[api]);
      return cached.sectionID[api];
    }

    const startTime = moment();
    let section = await strapi.query("Section").model.where('ApiString', '=', api).fetch({ columns: "id" });
    // console.debug("Section found ", api, section);
    // var section = await strapi.query('Section').findOne({ ApiString: api });
    console.debug("findSectionDocId", api, "lookup time", moment().diff(startTime, "seconds"), "s");
    if (section == null) {
      cached.sectionID[api] = null;
      return null;
    }

    cached.sectionID[api] = section.id;
    return section.id;
  },

  findCategory: async (api) => {
    let section = await strapi.query("Section").model.where('ApiString', '=', api).fetch({ columns: "*" });
    return section;
    // return strapi.query('Section').findOne({ ApiString: api });
  },

  connectSql: async () => {
    if (sqlinstance == undefined || sqlinstance == null) {
      sqlinstance = await sql.connect(config);
    }

    return new sql.Request();
  },



  sleep: async ms => new Promise(resolve => setTimeout(resolve, ms))

}