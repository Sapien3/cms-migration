const createStrapi = require('strapi');
const sql = require("mssql");
const url_slug = require('slug-arabic');
const util = require('util');
const fs = require('fs');
const { findCategory, connectSql } = require('./shared');

const getSQLQuery = () => {
  return `
  select 
  article.ArticleID,
  article.CreatedDate,
  article.Headline, article.Byline, article.Body,
  article.Summary, article.ReadCount,
  min(edition.EditionNumber) as EditionNumber,
  s.*
  from article inner join (

  select entity_tags.EntityID, min(section_articles.PublishDate) as PublishDate, 
  min(ps.SectionID) as SectionID, STRING_AGG(section_articles.SectionID, ',') AS section_ids, 
  min(firstAttachment.Uri) as attachment_uri, min(firstAttachment.Caption) as attachment_caption,
  STRING_AGG(related_article.ToEntityID, ',') AS related_articles,
  STRING_AGG(cast(attachments.uri_caption as nvarchar(MAX)), '|') AS attachments,
  min(ps.ShortURL) as ShortURL, entity_tags.IsActive
  FROM entity_tags
  inner join tag on tag.tagid=entity_tags.tagid
  left join section_articles ps on ps.ArticleID=entity_tags.EntityID and ps.IsLatestSection=1
  left join section_articles on section_articles.ArticleID=entity_tags.EntityID and section_articles.IsLatestSection <> 1
  
  OUTER APPLY
    (
    SELECT top 1 Attachment.Uri, Attachment.Caption FROM  Attachment
    inner join entity_tags et on et.EntityTypeId = 3 
    AND et.tagid = 138 and Attachment.attachmentid=et.entityid
    where et.entityid in (select attachmentid from attachment WHere entitytypeid = 1)
    AND Attachment.EntityID=entity_tags.EntityID
    order by Attachment.displayorder asc
    ) firstAttachment
  
  OUTER APPLY
    (
      SELECT top 9999 concat(Attachment.Uri, '@@', Attachment.Caption) as uri_caption FROM  Attachment
      inner join entity_tags et on et.EntityTypeId = 3 
      AND et.tagid = 313 and Attachment.attachmentid=et.entityid
      where et.entityid in (select attachmentid from attachment WHere entitytypeid = 1)
      AND Attachment.EntityID=entity_tags.EntityID
      AND Attachment.IsActive=1
      order by Attachment.displayorder asc
    ) attachments

  left join Entity_Relations related_article on related_article.FromEntityID = entity_tags.EntityID
  left join edition on edition.EditionID=ps.EditionID
  WHERE entity_tags.entitytypeid=1
  AND tag.tagid=5
  GROUP BY entity_tags.EntityID, ps.ShortURL, entity_tags.IsActive
  ) s on s.EntityID=article.ArticleID
  `;
}

const runImport = async () => {
  console.debug("starting...");

  const pendingRelatedArticle = [];
  let request = await connectSql();
  console.debug("connected to sqlserver");
  let result =  await request.query(getSQLQuery());
  createStrapi();
  // console.debug("strapi?", strapi.config);
  strapi.config.functions.cron = false;// disable cron in this file
  strapi.config.database.connections.default.options.debug = false
  await strapi.load();


  const cat = await findCategory('PhotoBlogs');
  if (cat == null) {
    throw Error("Category missing PhotoBlogs")
  }

  let foundRow = 0;
  let insertedRow = 0;
  let updatedRow = 0;
  for await(var row of result.recordset) {
    // console.debug('row', row);
    foundRow += 1;
    if (row.ShortURL == undefined || row.ShortURL == null || row.ShortURL.trim() == '') {
      // throw Error(`Short URL empty ${util.inspect(row, false, 2)}`);
      console.error(`Short URL empty ${util.inspect(row, false, 2)}`);
      continue;
    }

    const editionID = await findEditionID(article.EditionNumber);
    if (editionID == null) {
      throw Error(`Edition ${article.EditionNumber} missing`);
    }

    let body = row.Body;//.replace(/(Images\/ArticleImages\/).*/gmi, 's3-assets/serve/imagesManual/');
    const attachments = row.attachments ? row.attachments.split('|') : []
    for(let c=0; c < attachments.length; c++) {
      const attachImgRaw = attachments[c];
      const [attachImg, attachCaption] = attachImgRaw.split('@@');
      body += `
<div class="item">
  <a href=""><img class="imageslider" src="/s3-assets/attachment/${attachImg}"></a>
  <div class="captionsliderdiv" style="text-align: center;">
  <div class="boxesfont colorheadline captionslider" style="margin: 15px;">${attachCaption}</div>
  </div>
</div>`
    }


    const article = await strapi.query("article").findOne({ ShortURL: row.ShortURL})
    if (article !== undefined && article !== null) {
      console.debug('updating existing article', row.ArticleID, article.ShortURL);
      // console.debug('skip existing article', article.ArticleID, article.ShortURL);
      // continue;
      const updated = await strapi.query("article").update({ id: article.id},
        { Body: body, Attachment: row.attachment_uri,
        Caption: row.attachment_caption });
      // console.debug("inserted", inserted.id);
      // console.debug("updated", updated);
      updatedRow += 1;
      continue;
    }

    var sectionDocId = cat.id;// await findSectionDocId(row.SectionID);
    let nonPrimarySections = []
    // const sqlSNonPrimarySections = row.section_ids ? row.section_ids.split(","): []
    // for(let c=0; c < sqlSNonPrimarySections.length; c++) {
    //   const sqlSSection = sqlSNonPrimarySections[c];
    //   const sectionID = await findSectionDocId(sqlSSection);
    //   if (sectionID == null) {
    //     throw Error(`Section missing ${sqlSSection}`);
    //   }
    //   nonPrimarySections.push(sectionID);
    // }

    // // tag to photobook section
    // nonPrimarySections.push(cat.id)
    // DO NOT NEED
    // const sqlSRelatedArticles = row.related_articles ? row.related_articles.split(","): []
    // // to be processed later
    // if (sqlSRelatedArticles.length > 0) {
    //   pendingRelatedArticle.push({ArticleID: row.ArticleID, relatedArticle: sqlSRelatedArticles })
    // }
    
    
    let publish_at = !row.IsActive ? null: row.CreatedDate;
    let data = {
      ShortURL: row.ShortURL,
      author: [],
      Headline: row.Headline,
      //Slugline - generated by hook,
      Byline: row.Byline,
      Body: body,

      PrimarySection: sectionDocId,
      publish_at,
      // SocialTitle: row.Headline,
      // SocialImage: null,

      Section: nonPrimarySections,
      Summary: row.Summary,
      
      Attachment: row.attachment_uri,
      Caption: row.attachment_caption,
      
      ReadCount: row.ReadCount,
      TodaysNewsPaper: editionID
    }

    console.debug("saving", foundRow, data);

    insertedRow  += 1;
    const inserted = await strapi.query("article").create(data);
    // console.debug("inserted", inserted.id);
    // console.debug("inserted", inserted);
  }

  console.info(`inserted ${insertedRow}, updated ${updatedRow}, total ${foundRow}`);
  // NOT NEEDED - processing all related articles
  // for(let j=0; j < pendingRelatedArticle.length; j++) {
  //   const sqlSRelatedArticles = pendingRelatedArticle[j].relatedArticle;
  //   const relatedArticles = [];
  //   for(let c=0; c < sqlSRelatedArticles.length; c++) {
  //     const sqlRelatedArticle = sqlSRelatedArticles[c];
  //     const relatedArticle = awaitt strapi.query("article").findOne({ArticleID: sqlRelatedArticle })
  //     if (relatedArticle == null) {
  //       throw Error(`Article ArticleID: ${sqlRelatedArticle} missing`);
  //     }

  //     relatedArticles.push(relatedArticle.id);
  //   }

  //   //TODO save
  // }
  

  // console.debug('result', result.recordset[0]);
  // return result.recordset[0].id;
  
}

runImport();


/*
// sample
{
  Entity_TagsID: 366411,
  TagID: [ 5, 5 ],
  EntityTypeID: 1,
  EntityID: 62795,
  CreatedDate: [
    2016-04-12T15:41:45.213Z,
    2015-11-27T15:40:13.860Z,
    2012-07-16T16:41:16.000Z,
    2016-04-12T15:41:29.310Z
  ],
  CreatedByReaderID: null,
  CreatedByUserID: [ 1, 1, 1, 1 ],
  UpdatedDate: null,
  UpdatedByReaderID: null,
  UpdatedByUserID: 1,
  IsActive: true,
  Title: 'Photo Blog',
  TagTypeID: 1,
  Description: null,
  DisplayOrder: [ 32767, 728255 ],
  ArticleID: [ 62795, 62795 ],
  LanguageID: 1,
  PublicationID: 1,
  Headline: 'مسرح الـ«بيكاديلي»: نداء العرض الأخير',
  Slugline: '',
  Byline: '',
  Summary: '',
  Body: 'تصوير <strong>مروان طحطح</strong><br /><br />الـ«بيكاديلي»، مسرحٌ بيروتي شكّل مرادفاً للنهضة الثقافية اللبنانية، استوحي اسمه من المسرح الإنكليزي الشهير، وتصميمه الهندسي من قلعة برتغالية. <br /><br />احتضن الصرح الكبير، الذي يتوسط شارع الحمرا، الآلاف على مقاعده القرمزية طوال أربعة عقود، ضجت بعروض كلاسيكية ضخمة لا تزال محفورة في ذاكرة اللبنانيين، تبدأ بحفلات الخالدة فيروز ولا تنتهي عند مسرحيات زياد الرحباني، قبل أن تتوقف عروضه فجأة عندما ابتلعته النيران في أواخر تسعينيات القرن الماضي. <br /><br />وعلى الرغم من أن المسرح، الذي افتتح في عام 1965، لا يختلف عن الكثير من معالم العاصمة اللبنانية التي ذبلت مع الوقت، إلا أن أصداء الضحكات والتصفيق لا تزال حيّة بين معالمه المتفحمة.<br />',
  WordCount: 101,
  ForeignID: 97875,
  EmailedCount: 0,
  ReadCount: 35,
  MobileBody: 'تصوير مروان طحطح\r\n' +
    '\r\n' +
    'الـ«بيكاديلي»، مسرحٌ بيروتي شكّل مرادفاً للنهضة الثقافية اللبنانية، استوحي اسمه من المسرح الإنكليزي الشهير، وتصميمه الهندسي من قلعة برتغالية. \r\n' +
    '\r\n' +
    'احتضن الصرح الكبير، الذي يتوسط شارع الحمرا، الآلاف على مقاعده القرمزية طوال أربعة عقود، ضجت بعروض كلاسيكية ضخمة لا تزال محفورة في ذاكرة اللبنانيين، تبدأ بحفلات الخالدة فيروز ولا تنتهي عند مسرحيات زياد الرحباني، قبل أن تتوقف عروضه فجأة عندما ابتلعته النيران في أواخر تسعينيات القرن الماضي. \r\n' +
    '\r\n' +
    'وعلى الرغم من أن المسرح، الذي افتتح في عام 1965، لا يختلف عن الكثير من معالم العاصمة اللبنانية التي ذبلت مع الوقت، إلا أن أصداء الضحكات والتصفيق لا تزال حيّة بين معالمه المتفحمة.\r\n',
  MobileSummary: 'تصوير مروان طحطح\r\n' +
    '\r\n' +
    'الـ«بيكاديلي»، مسرحٌ بيروتي شكّل مرادفاً للنهضة الثقافية اللبنانية، استوحي اسمه من المسرح الإنكليزي الشهير، وتصميمه الهندسي من قلعة برتغالية. \r\n' +
    '\r\n' +
    'احتضن الصرح الكبير، الذي يتوسط شارع الحمرا، الآلاف على مقاعده القرمزية طوال أربعة عقود، ضجت بعروض كلاسيكية ضخمة لا تزال محفورة في ذاكرة اللبنانيين، تبدأ بحفلات الخالدة فيروز ولا تنتهي عند مسرحيات زياد الرحباني، قبل أن تتوقف عروضه فجأة عندما ابتلعته النيران في أواخر تسعينيات القرن الماضي. \r\n' +
    '\r',
  Section_ArticlesID: 91307,
  SectionID: 1,
  EditionID: null,
  PublishDate: 2012-07-16T16:41:16.000Z,
  TakedownDate: null,
  LastUpdatedDate: 2019-05-28T17:21:25.677Z,
  ShortURL: 'https://al-akhbar.com/Home_Page/62795',
  IsLatestSection: true
}
*/
