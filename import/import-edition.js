const createStrapi = require('strapi');
const sql = require("mssql");
const url_slug = require('slug-arabic');
const util = require('util');
const fs = require('fs');
const moment = require('moment');
const { findSectionDocId, connectSql, loadStrapi, findAuthorID, findEditionID, processBatchSQL } = require('./shared');

const getSQLQuery = (offset = 0, limit = 500) => {
  return `
  select 
  Section_Articles.ArticleID,
  article.CreatedDate
  
  From Section_Articles
  inner join article on article.ArticleID=Section_Articles.ArticleID
  
  left join (
    select sa.SectionID, sa.ArticleID, edition.EditionNumber, edition.EditionDate, edition.EditionID
    from section_articles sa
    inner join section s on s.SectionID=sa.SectionID
    inner join edition on edition.editionid=sa.editionid
    where sa.articleid in (
      select Entity_Tags.EntityID from Entity_Tags where Entity_Tags.EntityTypeID = 1 and Entity_Tags.TagID=1 and Entity_Tags.isactive = 1	
    )
    and s.ParentSectionID is null
  ) edition on edition.ArticleID=Section_Articles.ArticleID

  left join Section on section.SectionID=Section_Articles.SectionID

  left join section_articles ps on ps.ArticleID=Section_Articles.ArticleID and ps.IsLatestSection=1
  left join section psSection on psSection.SectionID=ps.SectionID
  left join section_articles otherSectionArticle on otherSectionArticle.ArticleID=Section_Articles.ArticleID and otherSectionArticle.IsLatestSection <> 1
  left join section otherSection on otherSection.SectionID=otherSectionArticle.SectionID
  
  left join article_authors on article_authors.articleid=article.articleid
  left join author on author.authorid=Article_Authors.AuthorID

  order by Section_Articles.ArticleID asc
  
  offset ${offset}  rows
  fetch first ${limit} rows only

  `;
}



const runImport = async () => {
  console.debug("starting...");
  const pendingRelatedArticle = [];

  const limit = 500;
  let offset = 0;

  await loadStrapi();
  let [totalRow, totalInserted, totalUpdated] = [0, 0, 0];

  const saveArticle = async (article, index) => {
    const startRowTime = moment();
    console.debug(`saving article ${article.ArticleID}`, article.CreatedDate, article.ShortURL, 'elapsed', moment().diff(startRowTime, 'seconds'));

    // insertedRow += 1;
    // updatedRow += 1;
  }


  while (true) {
    const request = await connectSql();
    request.stream = true;
    request.on('recordset', () => {
      console.debug('starting...');
    });

    console.debug(`loop ${offset}`);
    const result = request.query(getSQLQuery(offset, limit));

    const { insertedRow, updatedRow, foundRow } = await processBatchSQL(offset, limit, request, saveArticle);
    totalInserted += insertedRow;
    totalUpdated += updatedRow;
    totalRow += foundRow;
    console.debug(`batch offset: ${offset}, foundRow: ${foundRow} totalInserted: ${totalInserted} totalUpdated: ${totalUpdated} totalRow: ${totalRow}`);
    if (foundRow < limit) {
      console.debug('Done!');
      break;
    }
    offset += limit;
  }
  sql.close();
}

runImport();

