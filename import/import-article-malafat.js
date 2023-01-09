const createStrapi = require('strapi');
const sql = require("mssql");
const url_slug = require('slug-arabic');
const util = require('util');
const fs = require('fs');
const { findSectionDocId, connectSql, findEditionID, sleep } = require('./shared');

const getSQLQuery = () => {
  return `
  select 
  min(article.ArticleID) as ArticleID,
  min(article.CreatedDate) as CreatedDate,
  min(article.Headline) as Headline, min(article.Byline) as Byline, min(article.Body) as Body,
  min(article.Summary) as Summary, min(article.ReadCount) as ReadCount, 
  min(Section_Articles.PublishDate) as PublishDate,
  min(Section_Articles.ShortURL) as ShortURL,
  STRING_AGG(cast(attachments.uri_caption as nvarchar(MAX)), '|') AS attachments,
  min(psSection.ApiString) as primarySectionID, STRING_AGG(cast(otherSection.ApiString as nvarchar(MAX)), ',') AS section_ids,
  min(edition.EditionNumber) as EditionNumber
  From entity_tags
  inner join Section_Articles on Section_Articles.section_articlesid=Entity_Tags.EntityID
  inner join article on article.ArticleID=Section_Articles.ArticleID
  left join edition on edition.EditionID=Section_Articles.EditionID
  left join Section on section.SectionID=Section_Articles.SectionID
  OUTER APPLY
  (
  SELECT TOP 999 concat(Attachment.Uri, '@@', Attachment.Caption) as uri_caption
  FROM    Attachment
  WHERE   Attachment.EntityTypeID = 1 and Attachment.EntityID = entity_tags.EntityID
  order by displayorder asc
  ) attachments

  left join section_articles ps on ps.ArticleID=entity_tags.EntityID and ps.IsLatestSection=1
  left join section psSection on psSection.SectionID=ps.SectionID
  left join section_articles otherSectionArticle on otherSectionArticle.ArticleID=entity_tags.EntityID and otherSectionArticle.IsLatestSection <> 1
  left join section otherSection on otherSection.SectionID=otherSectionArticle.SectionID
  
  where entity_tags.entitytypeid = 9 --section_articles table
  and entity_tags.tagid = 831
  group by edition.EditionNumber, article.ArticleID
  order by edition.EditionNumber asc
  248886
  `;
}

const runImport = async () => {
  console.debug("starting...");

  // const pendingRelatedArticle = [];
  let request = await connectSql();
  
  console.debug("connected to sqlserver");
  return new Promise((resolve, reject) => {
    request.query(getSQLQuery()).then(async (result) => {
      console.debug("queried!");
      createStrapi();
      // console.debug("strapi?", strapi.config);
      strapi.config.functions.cron = false;// disable cron in this file
      strapi.config.database.connections.default.options.debug = false
      await strapi.load();

      let foundRow = 0;
      let insertedRow = 0;
      let updatedRow = 0;

      // cleanup for reimport
      // await strapi.query("malafat").delete({});

      for await (var row of result.recordset) {
        // console.debug('row', row);
        foundRow += 1;

        const editionID = await findEditionID(article.EditionNumber);
        if (editionID == null) {
          throw Error(`Edition ${article.EditionNumber} missing`);
        }
        console.debug("edition", editionID, article.EditionNumber.toString());
        let malaf = await strapi.query("malafat").findOne({ edition: editionID, ArticleID: parseInt(row.ArticleID,10) });
        
        let body = row.Body;
        let articlePrimaryAttachmentUri = null;
        let articlePrimaryAttachmentCaption = null;
        const attachments = row.attachments ? row.attachments.split('|') : []
        for (let c = 0; c < attachments.length; c++) {
          const attachImgRaw = attachments[c];
          const [attachImg, attachCaption] = attachImgRaw.split('@@');
          const attachUri = '/s3-assets/attachment/' + attachImg;
          if (c == 0) {
            articlePrimaryAttachmentUri = attachImg;
            articlePrimaryAttachmentCaption = attachCaption;
          }
          body += `
<div class="item">
  <a href=""><img class="imageslider" src="${attachUri}"></a>
  <div class="captionsliderdiv" style="text-align: center;">
  <div class="boxesfont colorheadline captionslider" style="margin: 15px;">${attachCaption}</div>
  </div>
</div>`
        }

        const sectionDocId = await findSectionDocId(row.primarySectionID);// await findSectionDocId(row.SectionID);
        let nonPrimarySections = []
        const sqlSNonPrimarySections = row.section_ids ? row.section_ids.split(",") : []
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

        if (malaf == null) {
          // insert malaf
          const insertMalafat = {
            MalafatFeaturedText: row.Headline,
            MalafatFeaturedDescription: body,
            ArticleID: parseInt(row.ArticleID, 10),
            edition: editionID, MalafatSummary: row.summary, MalafatShortURL: row.ShortURL,
            Attachment: articlePrimaryAttachmentUri, Caption: articlePrimaryAttachmentCaption,
            publish_at: row.CreatedDate
          };
          console.debug('inserting', insertMalafat);
          malaf = await strapi.query("malafat").create(insertMalafat);
          if (malaf == null) {
            throw Error(`unable to insert malaf ${util.inspect(insertMalafat, false, 2)}`);
          }
        } else {
          // console.debug("malaf", malaf);
          const updated = await strapi.query("malafat").update({ id: malaf.id },
            {
              MalafatFeaturedText: row.Headline,
              MalafatSummary: row.summary,
              MalafatShortURL: row.ShortURL,
              Body: body, Attachment: articlePrimaryAttachmentUri,
              Caption: articlePrimaryAttachmentCaption
            });

          malaf = updated;
          // console.debug("inserted", inserted.id);
          console.debug("updated malaf", malaf.id, row.ArticleID);
        }

        
        // https://github.com/tediousjs/node-mssql/blob/1e5e688182d240e00fd103378f3d553320730869/lib/datatypes.js
        const childRequest = await connectSql();
        childRequest.input('inputArticleID', sql.Int, row.ArticleID);
        const childQueryReq = await childRequest.query(`
        select 
          min(ma.ArticleID) as mainArticleID,
          min(article.ArticleID) as ArticleID,
          min(article.CreatedDate) as CreatedDate,
          min(article.Headline) as Headline, min(article.Byline) as Byline, min(article.Body) as Body,
          min(article.Summary) as Summary, min(article.ReadCount) as ReadCount, 
          min(Section_Articles.PublishDate) as PublishDate,
          max(Section_Articles.ShortURL) as ShortURL,
          STRING_AGG(cast(attachments.uri_caption as nvarchar(MAX)), '|') AS attachments,
          min(psSection.ApiString) as primarySectionID, STRING_AGG(otherSection.ApiString, ',') AS section_ids,
          min(article.EditionNumber) as EditionNumber
          From entity_tags
          inner join Section_Articles on Section_Articles.section_articlesid=Entity_Tags.EntityID and IsLatestSection=1
          inner join article on article.ArticleID=Section_Articles.ArticleID
        
          inner join Section_Articles childSA on childSA.ArticleID=Section_Articles.ArticleID
          inner join entity_relations on entity_relations.ToEntityID=childSA.section_articlesid
          inner join section_articles ma on ma.Section_ArticlesID=entity_relations.FROMEntityID
        
          left join edition on edition.EditionID=Section_Articles.EditionID
          left join Section on section.SectionID=Section_Articles.SectionID
          OUTER APPLY
          (
          SELECT TOP 999 concat(Attachment.Uri, '@@', Attachment.Caption) as uri_caption
          FROM    Attachment
          WHERE   Attachment.EntityTypeID = 1 and Attachment.EntityID = entity_tags.EntityID
          order by displayorder asc
          ) attachments


          left join section_articles ps on ps.ArticleID=entity_tags.EntityID and ps.IsLatestSection=1
          left join section psSection on psSection.SectionID=ps.SectionID
          left join section_articles otherSectionArticle on otherSectionArticle.ArticleID=entity_tags.EntityID and otherSectionArticle.IsLatestSection <> 1
          left join section otherSection on otherSection.SectionID=otherSectionArticle.SectionID
          
          where entity_relations.fromentitytypeid = 9
          and  entity_relations.toentitytypeid = 9
          and entity_relations.entity_relationsid in 
          (select entityid from entity_tags
          where entitytypeid = 2  --entity_relations
          and tagid = 848 )
          --and article.articleID=136186
          --and ma.ArticleID=1633

            and ma.ArticleID=@inputArticleID
            group by article.ArticleID
        `);

        // check if existing articles exists, otherwise insert
        if (malaf.MalafatArticles == undefined || malaf.MalafatArticles == null) {
          malaf.MalafatArticles = { articles: [] }
        }

        // temp force clear
        malaf.MalafatArticles = { articles: [] }
        console.debug(`malaf edition: ${malaf.article.EditionNumber}(articleid: ${row.ArticleID}) current MalafatArticles` , "child size", malaf.MalafatArticles.articles.length);

        for await (var childArticle of childQueryReq.recordset) {
          if (childArticle.ShortURL == undefined || childArticle.ShortURL == null) {
            console.info(`malaf edition: ${malaf.article.EditionNumber}(articleid: ${row.ArticleID}) skipping child article`, childArticle.ArticleID, childArticle.Headline, 'missing shorturl');
            continue
          }

          let childArticleBody = childArticle.Body;
          let childArticlePrimaryAttachmentUri = null;
          let childArticlePrimaryAttachmentCaption = null;
          const childAttachments = childArticle.attachments ? childArticle.attachments.split('|') : []
          for (let c = 0; c < childAttachments.length; c++) {
            const attachImgRaw = childAttachments[c];
            const [attachImg, attachCaption] = attachImgRaw.split('@@');
            const attachUri = '/s3-assets/attachment/' + attachImg;
            if (c == 0) {
              childArticlePrimaryAttachmentUri = attachImg;
              childArticlePrimaryAttachmentCaption = attachCaption;
            }
            childArticleBody += `
  <div class="item">
    <a href=""><img class="imageslider" src="${attachUri}"></a>
    <div class="captionsliderdiv" style="text-align: center;">
    <div class="boxesfont colorheadline captionslider" style="margin: 15px;">${attachCaption}</div>
    </div>
  </div>`
          }

          const childSectionDocId = await findSectionDocId(childArticle.primarySectionID);// await findSectionDocId(childArticle.SectionID);
          let childNonPrimarySections = []
          const sqlSNonPrimarySections = childArticle.section_ids ? childArticle.section_ids.split(",") : []
          for (let c = 0; c < sqlSNonPrimarySections.length; c++) {
            const sqlSSection = sqlSNonPrimarySections[c];
            const sectionID = await findSectionDocId(sqlSSection);
            if (sectionID == null) {
              throw Error(`Section missing ${sqlSSection}`);
            }
            // unique sections
            if (childNonPrimarySections.indexOf(sectionID) < 0) {
              childNonPrimarySections.push(sectionID);
            }
          }

          let article = await strapi.query("article").findOne({ ShortURL: childArticle.ShortURL });
          let publish_at = childArticle.CreatedDate;
          let data = {
            ShortURL: childArticle.ShortURL,
            Headline: childArticle.Headline,
            //Slugline - generated by hook,
            Byline: childArticle.Byline,
            Body: childArticleBody,

            PrimarySection: childSectionDocId,
            publish_at,
            // SocialTitle: childArticle.Headline,
            // SocialImage: null,

            Section: childNonPrimarySections,
            Summary: childArticle.Summary,

            Attachment: childArticlePrimaryAttachmentUri,
            Caption: childArticlePrimaryAttachmentCaption,

            ReadCount: childArt,
            TodaysNewsPaper: editionID
          }

          console.debug(`saving malaf edition: ${malaf.article.EditionNumber}(articleid: ${row.ArticleID}) child article`, foundRow, data.ShortURL);

          if (article == null) {
            // insert article
            const inserted = await strapi.query("article").create(data);
            console.debug("inserted article", inserted.id, childArticle.ArticleID);
  
            // get updated article
            article = inserted;
            insertedRow += 1;
          } else {
            // dont update, save time
            // const updated = await strapi.query("article").update({id: article.id}, data);

            // console.debug("updated article", updated.id, childArticle.ArticleID);
  
            // // get updated article
            // article = updated;
            updatedRow += 1;
          }
          
          let foundChildArticle = false;
          for (var i = 0; i < malaf.MalafatArticles.articles.length; i++) {
            const cArticle = malaf.MalafatArticles.articles[i];
            // console.debug('existing article', malaf.id, cArticle.id, cArticle.Headline);
            if (cArticle.id == article.id) {
              foundChildArticle = true;
              break;
            }
          }

          const articleIds = malaf.MalafatArticles.articles.map((cArticle) => {
            return cArticle.id
          });
          if (!foundChildArticle) {
            articleIds.push(article.id);
            console.debug(`inserting new article into malaf edition: ${malaf.article.EditionNumber}`, malaf.id, article.id, article.Headline);
          }

          malaf = await strapi.query("malafat").update({ id: malaf.id }, { MalafatArticles: { articles: articleIds } })
          console.debug("added malaf articles", malaf.id, malaf.article.EditionNumber.toString(), 'articles count', malaf.MalafatArticles.articles.length);
        }//each child article

        lastEditionNumber = row.EditionNumber;
      }//loop query

      console.info(`inserted ${insertedRow}, updated ${updatedRow}, total ${foundRow}, Done!`);
      resolve();
    });

  });

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
