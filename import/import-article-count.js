const createStrapi = require('strapi');
const sql = require("mssql");
const url_slug = require('slug-arabic');
const util = require('util');
const fs = require('fs');
const moment = require('moment');
const { findSectionDocId, connectSql, loadStrapi, findAuthorID } = require('./shared');

const getSQLQuery = () => {
  return `
  select 
  count(distinct article.articleID) as cnt,
  count(distinct Section_Articles.ShortURL) as shorturl_cnt
  From Section_Articles
  inner join article on article.ArticleID=Section_Articles.ArticleID
  left join edition on edition.EditionID=Section_Articles.EditionID
  left join Section on section.SectionID=Section_Articles.SectionID
  OUTER APPLY
  (
  SELECT TOP 999 concat(Attachment.Uri, '@@', Attachment.Caption) as uri_caption
  FROM    Attachment
  WHERE   Attachment.EntityTypeID = 1 and Attachment.EntityID = Section_Articles.ArticleID
  order by displayorder asc
  ) attachments

  left join section_articles ps on ps.ArticleID=Section_Articles.ArticleID and ps.IsLatestSection=1
  left join section psSection on psSection.SectionID=ps.SectionID
  left join section_articles otherSectionArticle on otherSectionArticle.ArticleID=Section_Articles.ArticleID and otherSectionArticle.IsLatestSection <> 1
  left join section otherSection on otherSection.SectionID=otherSectionArticle.SectionID
  
  left join article_authors on article_authors.articleid=article.articleid
  left join author on author.authorid=Article_Authors.AuthorID

  where Section_Articles.ShortURL is not null
  `;
}

const runImport = async () => {
  console.debug("starting...");
  const pendingRelatedArticle = [];
  let request = await connectSql();

  console.debug("connected to sqlserver");
  request.stream = true;
  const result = request.query(getSQLQuery());

  request.on('row', async (article) => {

    console.debug('row', article);
  });

  request.on('error', (err) => {
    console.error("sql error: ", err);
  });

  request.on('done', async ()=> {
    sql.close();
    console.info(`Done!`);
  });
}

runImport();

