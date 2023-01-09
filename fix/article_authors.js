const createStrapi = require('strapi');

//old mongodb
const runFixArticleWithMissingAuthors = async () => {
  createStrapi();
  // console.debug("strapi?", strapi.config);
  strapi.config.functions.cron = false;// disable cron in this file
  strapi.config.database.connections.default.options.debug = false
  await strapi.load();

  console.debug("starting...");
  for (let modelName of Object.keys(strapi.models)) {
    const model = strapi.models[modelName]
    console.debug('model', model)
    for (let attrName of Object.keys(model.attributes)) {
      const attr = model.attributes[attrName];
      console.debug('attr', attr);
      if ('collection' in attr) {
        console.debug('checking model', model, attr);

        // const cond = { authors_null: true, _limit: limit, _sort: 'createdAt asc' }
        const cursor = strapi.models[modelName].collection.find({ [attrName]: null }).sort({ _id: 1 });
        // let rows = await strapi.query("article").find({ ...cond, _start: offset });
        let updated = 0;
        let index = 0;
        for await (var row of cursor) {
          // console.debug('row', row);
          if (attrName in row && row[attrName] !== undefined && row[attrName] !== null) {
            console.debug('skip row', modelName, index, row._id, attrName, row[attrName]);
            //skip
            index += 1;
            continue;
          }

          console.debug('updating row', modelName, index, row._id, attrName, row[attrName]);
          await strapi.models[modelName].collection.update({ _id: row._id }, { $set: { [authors]: [] } });
          index += 1;
          updated += 1;
        }// each row
        console.info(`Fixed ${updated} ${modelName}.${attrName} document updated`);
      }


    }// each columns
    console.info(`Fixed ${modelName} completed.`);
  }// each models

  console.info(`Done!`);

  process.exit();
}

const runMigrateArticleAuthorsToHasMany = async () => {
  createStrapi();
  // console.debug("strapi?", strapi.config);
  strapi.config.functions.cron = false;// disable cron in this file
  strapi.config.database.connections.default.options.debug = false
  await strapi.load();
  const conn = strapi.connections.default;

  const res = conn.raw(
    "select * from articles_authors__authors_articles order by article_id asc"
  );

  await res.then(async (res) => {
    let lastArticleID = null;
    let authors = [];
    for (const row of res[0]) {
      // console.debug('row', row.id, row.article_id, row.author_id);
      if (lastArticleID != null && lastArticleID != row.article_id) {
        console.debug('updating article', row.article_id, authors);
        await strapi.query("article").update({ id: row.article_id }, { authors });
        authors = [];
      }

      if (authors.indexOf(row.author_id) < 0) {
        authors.push(row.author_id);
      }

      lastArticleID = row.article_id;
    }
    if (authors.length > 0) {
      await strapi.query("article").update({ id: lastArticleID }, { authors });
      console.debug('updating article', lastArticleID, authors);
    }
  });
}

// runFixArticleWithMissingAuthors();
runMigrateArticleAuthorsToHasMany().catch((err) => {
  console.error("catch error", err);
});
