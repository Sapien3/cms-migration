const createStrapi = require('strapi');
const sql = require("mssql");
const url_slug = require('slug-arabic');
const util = require('util');
const fs = require('fs');
const { insertOrUpdate, connectSql, findTagTypeID, loadStrapi } = require('./shared');

const runImportEdition = async () => {
  console.debug("starting...");
  let request = await connectSql();

  let insertedRow = 0;
  let updatedRow = 0;
  let foundRow = 0;

  const result = await request.query("select * from Edition");
  await loadStrapi();
  for await (var row of result.recordset) {
    
    // console.debug('row', row);
    foundRow += 1;
    const res = await insertOrUpdate('edition', { EditionNumber: row.EditionNumber}, row, true);
    if (res.action == 'insert') {
      insertedRow += 1;
    } else if(res.action == 'update') {
      updatedRow += 1;
    }
  }// loop
  console.debug(`Completed edition ${insertedRow} inserted, ${updatedRow} updated total: ${foundRow}`);
}

runImportAuthor = async () => {
  console.debug("starting...");

  let request = await connectSql();

  console.debug("connected to sqlserver");

  let foundRow = 0;
  let insertedRow = 0;
  let updatedRow = 0;

  const result = await request.query("select * from Author");
  await loadStrapi();
  for await (var row of result.recordset) {
    // console.debug('row', row);
    foundRow += 1;
    const res = await insertOrUpdate('author', { DisplayName: row.DisplayName }, row, true);
    if (res.action == 'insert') {
      insertedRow += 1;
    } else if(res.action == 'update') {
      updatedRow += 1;
    }
  }// loop
  console.debug(`Completed author ${insertedRow} inserted, ${updatedRow} updated total: ${foundRow}`);
}

runImportSection = async () => {
  console.debug("starting...");

  let request = await connectSql();

  console.debug("connected to sqlserver");

  let foundRow = 0;
  let insertedRow = 0;
  let updatedRow = 0;

  const result = await request.query("select * from Section");
  await loadStrapi();
  for await (var row of result.recordset) {
    // console.debug('row', row);
    foundRow += 1;
    const res = await insertOrUpdate('section', { ApiString: row.ApiString }, row, true);
    if (res.action == 'insert') {
      insertedRow += 1;
    } else if(res.action == 'update') {
      updatedRow += 1;
    }
  }// loop
  console.debug(`Completed section ${insertedRow} inserted, ${updatedRow} updated total: ${foundRow}`);
}

runImportTagType = async () => {
  console.debug("starting...");

  let request = await connectSql();

  console.debug("connected to sqlserver");

  let foundRow = 0;
  let insertedRow = 0;
  let updatedRow = 0;

  const result = await request.query("select * from TagType");
  await loadStrapi();
  for await (var row of result.recordset) {
    // console.debug('row', row);
    foundRow += 1;
    const res = await insertOrUpdate('tag-type', { Title: row.Title }, row, true);
    if (res.action == 'insert') {
      insertedRow += 1;
    } else if(res.action == 'update') {
      updatedRow += 1;
    }
  }// loop
  console.debug(`Completed tag ${insertedRow} inserted, ${updatedRow} updated total: ${foundRow}`);
}

runImportTag = async () => {
  console.debug("starting...");

  let request = await connectSql();

  console.debug("connected to sqlserver");

  let foundRow = 0;
  let insertedRow = 0;
  let updatedRow = 0;

  const result = await request.query("  select tag.*, tagtype.title as tagtype_title from tag left join tagtype on tagtype.TagTypeID=tag.TagTypeID");
  await loadStrapi();
  for await (var row of result.recordset) {
    // console.debug('row', row);
    foundRow += 1;
    const res = await insertOrUpdate('tag', { Title: row.Title }, row, true, async (values) => {
      const tagTypeID = await findTagTypeID(row.tagtype_title);
      if (tagTypeID == null) {
        throw Error(`TagType ${row.tagtype_title} missing`);
      }
      const data =  { ... values, 'TagTypeID': tagTypeID }
      return data;
    });
    if (res.action == 'insert') {
      insertedRow += 1;
    } else if(res.action == 'update') {
      updatedRow += 1;
    }
  }// loop
  console.debug(`Completed tag ${insertedRow} inserted, ${updatedRow} updated total: ${foundRow}`);
}


const runImport = async() => {
  await runImportEdition();
  await runImportAuthor();
  await runImportSection();
  await runImportTagType();
  await runImportTag();
}

runImport();
