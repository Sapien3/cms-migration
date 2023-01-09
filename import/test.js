const createStrapi = require('strapi');
const sql = require("mssql");
const url_slug = require('slug-arabic');
const util = require('util');
const fs = require('fs');
const { findSectionDocId, findTagTypeID ,connectSql, loadStrapi, findAuthorID } = require('./shared');

const runImport = async () => {
  await loadStrapi();

  const author = await findAuthorID('وفيق قانصوه');
  console.debug('author', author);

  console.debug('typeid', await findTagTypeID('Article Type'));

  console.debug('findSectionDocId', await findSectionDocId('PhotoBlogs'));
  console.debug('ended.');
};

runImport();