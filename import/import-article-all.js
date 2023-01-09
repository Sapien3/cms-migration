const createStrapi = require('strapi');
const sql = require("mssql");
const url_slug = require('slug-arabic');
const util = require('util');
const fs = require('fs');
const moment = require('moment');
const { findSectionDocId, connectSql, loadStrapi, findAuthorID, findEditionID, findArticle, processBatchSQL } = require('./shared');

const getSQLQuery = (offset = 0, limit = 500) => {
  return `
  
  select 
  Section_Articles.ArticleID,
  min(article.CreatedDate) as CreatedDate,
  min(section_articles.CreatedByUserID) as CreatedByUserID,
  min(section_articles.UpdatedByUserID) as UpdatedByUserID,
  min(article.Headline) as Headline, min(article.Byline) as Byline, min(article.Body) as Body,
  min(article.Summary) as Summary, min(article.ReadCount) as ReadCount, 
  min(Section_Articles.PublishDate) as PublishDate,
  min(Section_Articles.ShortURL) as ShortURL,

  min(firstAttachment.Uri) as attachment_uri, min(firstAttachment.Caption) as attachment_caption,
  
  STRING_AGG(cast(attachments.uri_caption as nvarchar(MAX)), '|') AS attachments,
  min(psSection.ApiString) as primarySectionID, STRING_AGG(cast(otherSection.ApiString as nvarchar(MAX)), ',') AS section_ids,
  string_agg(cast(author.DisplayName as nvarchar(MAX)), '|') as authors,
  min(edition.EditionNumber) as EditionNumber
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

  OUTER APPLY
    (
    SELECT top 1 Attachment.Uri, Attachment.Caption FROM  Attachment
    inner join entity_tags et on et.EntityTypeId = 3 
    AND et.tagid = 138 and Attachment.attachmentid=et.entityid
    where et.entityid in (select attachmentid from attachment WHere entitytypeid = 1)
    AND Attachment.EntityID=article.ArticleID
    order by Attachment.displayorder asc
    ) firstAttachment

  OUTER APPLY
  (
    SELECT top 999 attachment.entityID, concat(Attachment.Uri, '@@', Attachment.Caption) as uri_caption FROM  Attachment
    WHERE Attachment.EntityTypeID = 1 and attachment.IsActive=1
    and Attachment.EntityID=article.ArticleID
    AND Attachment.ParentID is null
    order by Attachment.displayorder asc
  ) attachments

  left join section_articles ps on ps.ArticleID=Section_Articles.ArticleID and ps.IsLatestSection=1
  left join section psSection on psSection.SectionID=ps.SectionID
  left join section_articles otherSectionArticle on otherSectionArticle.ArticleID=Section_Articles.ArticleID and otherSectionArticle.IsLatestSection <> 1
  left join section otherSection on otherSection.SectionID=otherSectionArticle.SectionID
  
  left join article_authors on article_authors.articleid=article.articleid
  left join author on author.authorid=Article_Authors.AuthorID

  where

  Section_Articles.ArticleID not in (
    select entity_tags.EntityID
    FROM entity_tags
    inner join tag on tag.tagid=entity_tags.tagid
    
    WHERE entity_tags.entitytypeid=1
    AND tag.tagid=5
  )
  
  AND Section_Articles.ArticleID = 291430
  
  group by Section_Articles.ArticleID
  order by Section_Articles.ArticleID asc
  
  offset ${offset} rows
  fetch first ${limit} rows only
  `;
}

/*

-- not photoblog (due to section)
  Section_Articles.ArticleID not in (
    select entity_tags.EntityID
    FROM entity_tags
    inner join tag on tag.tagid=entity_tags.tagid
    
    WHERE entity_tags.entitytypeid=1
    AND tag.tagid=5
  )
  
  -- not malafat
  --AND Section_Articles.ArticleID not in (
  --  select entity_tags.EntityID
  --  FROM entity_tags WHERE
  --  entity_tags.entitytypeid = 9 --section_articles table
  --  and entity_tags.tagid = 831
  --  )

  -- not supplement kalimat nor capital
  --AND (
  --  Section_Articles.SectionID non in (14, 107)
  --)

  -- AND Section_Articles.ArticleID >= 14869
  -- AND (Section_Articles.ShortURL is null OR Section_Articles.ShortURL not like 'https://al-ak%')
*/

const runImport = async () => {
  console.debug("starting...");
  const pendingRelatedArticle = [];

  const limit = 500;
  let offset = 0;

  await loadStrapi();
  let [totalRow, totalInserted, totalUpdated] = [0, 0, 0];

  const saveArticle = async (article, index) => {
    const startRowTime = moment();
    let editionID = null
    if (article.EditionNumber != null) {
      editionID = await findEditionID(article.EditionNumber);
      if (editionID == null) {
        throw Error(`Edition ${article.EditionNumber} missing`);
      }
    }
    // console.debug("edition", edition.id, edition.EditionNumber.toString(), 'elapsed', moment().diff(startRowTime, 'seconds'));

    let articleBody = article.Body;
    let articlePrimaryAttachmentUri = article.attachment_uri;
    let articlePrimaryAttachmentCaption = article.attachment_caption;

    const attachments = article.attachments ? article.attachments.split('|') : []
    for (let c = 0; c < attachments.length; c++) {
      const attachImgRaw = attachments[c];
      const [attachImg, attachCaption] = attachImgRaw.split('@@');
      if (attachImg == articlePrimaryAttachmentUri) {
        console.debug('skipping primary attachment', article.ArticleID, attachImg);
        return;
      }
      console.debug('adding attachment', article.ArticleID, attachImg);
      const attachUri = '/s3-assets/attachment/' + attachImg;

      articleBody += `
<div class="item">
<a href=""><img class="imageslider" src="${attachUri}"></a>
<div class="captionsliderdiv" style="text-align: center;">
<div class="boxesfont colorheadline captionslider" style="margin: 15px;">${attachCaption}</div>
</div>
</div>`
    }

    console.debug("body done", article.ArticleID, 'elapsed', moment().diff(startRowTime, 'seconds'));
    // const createdUserID = await findUser(article.CreatedByUserID);
    // const updatedUserID = await findUser(article.UpdatedByUserID);
    const sectionDocId = await findSectionDocId(article.primarySectionID);// await findSectionDocId(article.SectionID);
    let nonPrimarySections = []
    let sqlSNonPrimarySections = article.section_ids ? article.section_ids.split(",") : []
    sqlSNonPrimarySections = [... new Set(sqlSNonPrimarySections)]// remove duplicates
    for (let c = 0; c < sqlSNonPrimarySections.length; c++) {
      const sqlSSection = sqlSNonPrimarySections[c];
      const sectionID = await findSectionDocId(sqlSSection);
      if (sectionID == null) {
        throw Error(`Section missing ${sqlSSection}`);
      }
      // unique sections
      if (nonPrimarySections.indexOf(sectionID) < 0) {
        nonPrimarySections.push(sectionID);
      }
    }

    // unique sections
    nonPrimarySections = [... new Set(nonPrimarySections)]

    if (article.ShortURL === undefined || article.ShortURL === null || !article.ShortURL.startsWith('https://al-akhbar.com')) {
      // is not using site url, generate url
      /* 
      · System.Text.RegularExpressions.Regex.Replace(value, @"[^A-Za-z0-9ء-ي_\.~]+", "-").Replace(".", "").Replace(",", "").TrimStart('-')
      · Take first 100 characters
      */
      let slugURL = article.Headline
      console.debug('slugurl', slugURL);
      if (!article.Headline) {
        throw Error(`Headline missing ${util.inspect(article, false, 3)}`);
      }
      slugURL = slugURL.replace(/[^A-Za-z0-9ء-ي_\.~]+g/, '-').replace(/\./g, '').replace(/\,/g, '').trim();
      while (slugURL.length > 0 && slugURL.startsWith('-')) {
        slugURL = slugURL.substring(1);
      }

      if (!article.primarySectionID) {
        console.error(`ShortURL generation with invalid primary section ${article.ArticleID}`);
        await sleep(2000);
        return;
        // throw Error(`ShortURL generation with invalid primary section ${article.ArticleID}`);
      }

      slugURL = `https://al-akbhar.com/${article.primarySectionID}/${article.ArticleID}/${slugURL.substring(0, 100)}`;
      console.info(`article edition: ${article.EditionNumber}(articleid: ${article.ArticleID}) article`, article.ArticleID, article.Headline, 'oldURL', article.ShortURL, 'newURL', slugURL);

      article.ShortURL = slugURL;
    }

    console.debug("section done", article.ArticleID, 'elapsed', moment().diff(startRowTime, 'seconds'));
    const authors = [];
    let authorsName = article.authors !== undefined && article.authors !== null ? article.authors.split('|') : [];
    authorsName = [... new Set(authorsName)]// remove duplicates
    for (let c = 0; c < authorsName.length; c++) {
      const authorName = authorsName[c];
      const authorID = await findAuthorID(authorName);
      if (authorID == null) {
        throw Error(`Author missing ${authorName}`);
      }
      authors.push(authorID);
    }

    console.debug("author done", article.ArticleID, 'elapsed', moment().diff(startRowTime, 'seconds'));
    let articleRow = await findArticle(article.ShortURL);
    articleBody = articleBody.replace(/[\u0800-\uFFFF]/g, '');
    console.debug("find existing shorturl done", article.ArticleID, 'new id:', (articleRow ? articleRow.id: null), article.ShortURL, 'elapsed', moment().diff(startRowTime, 'seconds'));
    let publish_at = article.CreatedDate;
    let data = {
      ShortURL: article.ShortURL,
      Headline: article.Headline,
      //Slugline - generated by hook,
      Byline: article.Byline,
      Body: articleBody,

      PrimarySection: sectionDocId,
      publish_at,
      // SocialTitle: article.Headline,
      // SocialImage: null,

      Section: nonPrimarySections,
      Summary: article.Summary,

      Attachment: articlePrimaryAttachmentUri,
      Caption: articlePrimaryAttachmentCaption,

      ReadCount: article.ReadCount,

      authors,

      TodaysNewsPaper: editionID
    }

    console.debug(`saving article editionnumber: ${article.EditionNumber}, editionid: ${editionID} (articleid: ${article.ArticleID}) primarySection: ${sectionDocId} other sections ${util.inspect(nonPrimarySections, false, 2)}`, article.ShortURL, 'elapsed', moment().diff(startRowTime, 'seconds'));
    // console.debug(`saving articleid: ${article.ArticleID} articleBody: `, articleBody);

    // console.debug('about to save', article.ArticleID, 'elapsed', moment().diff(startRowTime, 'seconds'));
    const saveTime = moment();
    if (articleRow == null) {
      // insert article
      
      const inserted = await strapi.query("article").create(data);
      console.debug("inserted article", article.ArticleID, article.ShortURL, 'savetime', moment().diff(startRowTime, 'seconds'));
      
      // get updated article
      articleRow = inserted;

      return { inserted: 1, updated: 0}
    } else {
      // avoid primary section for updating to not overwrite photoblog section
      // delete data.PrimarySection;

      // avoid primary section
      let data = {
        Body: articleBody,
        Section: nonPrimarySections,
        Summary: article.Summary,
        Attachment: articlePrimaryAttachmentUri,
        Caption: articlePrimaryAttachmentCaption,
        TodaysNewsPaper: editionID,
        ShortURL: article.ShortURL
      }

      const updated = await strapi.query("article").update({ id: articleRow.id }, data);
      // console.debug("updated article", articleRow.id, 'original ArticleID', article.ArticleID, article.ShortURL, 'body', articleBody);
      console.debug("updated article", updated.id, 'original ArticleID', article.ArticleID, article.ShortURL, 'savetime', moment().diff(startRowTime, 'seconds'));

      // get updated article
      articleRow = updated;
      return { inserted: 0, updated: 1}
    }
  }

  while (true) {
    const request = await connectSql();
    request.stream = true;
    request.on('recordset', () => {
      console.debug('starting...');
    });

    console.debug(`loop ${offset}`);
    const result = request.query(getSQLQuery(offset, limit)).catch((err) => {
      console.error('query failed', err);
      throw err;
    });

    const { insertedRow, updatedRow, foundRow } = await processBatchSQL(offset, limit, request, saveArticle.catch((err) => {
      console.error('save article failed', err);
      throw err;
    }));
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
  console.debug('Done.');
}


//only 1300+ rows, not used
const runRelatedArticle = async () => {
  console.debug("starting...");

  const pendingRelatedArticle = [];
  let request = await connectSql();

  console.debug("connected to sqlserver");
  return new Promise((resolve, reject) => {
    request.query(`
    
    `).then(async (result) => {
      console.debug("queried!");
      createStrapi();
      // console.debug("strapi?", strapi.config);
      strapi.config.functions.cron = false;// disable cron in this file
      strapi.config.database.connections.default.options.debug = false
      await strapi.load();

      let foundRow = 0;
      let insertedRow = 0;
      let updatedRow = 0;

      for await (var row of result.recordset) {
        // console.debug('row', row);
        foundRow += 1;
      }

    });
  });
}


runImport();

