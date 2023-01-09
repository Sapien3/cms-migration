const createStrapi = require('strapi');
const sql = require("mssql");
const url_slug = require('slug-arabic');
const util = require('util');
const fs = require('fs');
const { findEditionID, findSupplementCategoryID, findSectionDocId, connectSql, sleep } = require('./shared');

const getSQLQuery = () => {
  return `
  
  select 
  min(article.ArticleID) as ArticleID,
  min(article.CreatedDate) as CreatedDate,
  min(article.Headline) as Headline, min(article.Byline) as Byline, min(article.Body) as Body,
  min(article.Summary) as Summary, min(article.ReadCount) as ReadCount, 
  min(Section_Articles.PublishDate) as PublishDate,
  min(Section_Articles.ShortURL) as ShortURL,
  min(edition.EditionNumber) as EditionNumber,
  STRING_AGG(cast(attachments.uri_caption as nvarchar(MAX)), '|') AS attachments,
  min(psSection.ApiString) as primarySectionID, STRING_AGG(cast(otherSection.ApiString as nvarchar(MAX)), ',') AS section_ids
  From entity_tags
  inner join article on article.ArticleID=entity_tags.EntityID
  inner join Section_Articles on Section_Articles.ArticleID=Entity_Tags.EntityID
  inner join edition on edition.EditionID=Section_Articles.EditionID
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

  where 
  Section_Articles.SectionID=107
  and entity_tags.IsActive = 1
  
  group by Section_Articles.EditionID, Section_Articles.DisplayOrder
  order by Section_Articles.EditionID, Section_Articles.DisplayOrder
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

      const sectionName = 'Capital';
      const supCatID = await findSupplementCategoryID(sectionName);
      if (supCatID == null) {
        throw Error('Supplement-capital category ' + sectionName + ' missing');
      }

      let foundEdition = 0;
      let lastEditionNumber = null;
      let suppArticleIndex = 0;
      let foundRow = 0;
      let insertedRow = 0;
      let updatedRow = 0;
      let supp = null;
      let edition = null;

      for await (var row of result.recordset) {
        // console.debug('row', row);
        foundRow += 1;
        if (row.ShortURL == undefined || row.ShortURL == null || row.ShortURL.trim() == '') {
          // throw Error(`Short URL empty ${util.inspect(row, false, 2)}`);
          console.error(`Short URL empty ${util.inspect(row, false, 2)}`);
          continue;
        }

        let body = row.Body;//.replace(/(Images\/).*/gmi, 's3-assets/serve/imagesManual/');
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

        if (supp == null || (lastEditionNumber != null && lastEditionNumber != row.EditionNumber)) {
          // filter down edition selected fields without articles

          const editionID = await findEditionID(row.EditionNumber);
          if (editionID == null) {
            throw Error(`Edition ${row.EditionNumber} missing`);
          }
          foundEdition += 1;
          suppArticleIndex = 0;//reset
          console.debug("edition", editionID, row.EditionNumber.toString());
          supp = await strapi.query("supplements").findOne({
            Name: sectionName,
            edition: editionID
          });
          if (supp == null) {
            // insert supplements
            const insertSupp = {
              Name: sectionName,
              edition: editionID,
              supplements_category: supCatID,
              Attachment: articlePrimaryAttachmentUri,
              Caption: articlePrimaryAttachmentCaption,
              publish_at: row.CreatedDate
            };
            supp = await strapi.query("supplements").create(insertSupp);
            if (supp == null) {
              throw Error(`unable to insert supplement ${util.inspect(insertSupp, false, 2)}`);
            }
          } else {
            const updated = await strapi.query("supplements").update({ id: supp.id },
              {
                Name: sectionName,
                edition: editionID,
                supplements_category: supCatID,
                Attachment: articlePrimaryAttachmentUri,
                Caption: articlePrimaryAttachmentCaption
              });
  
              supp = updated;
            // console.debug("inserted", inserted.id);
            console.debug("updated supp", supp.id, row.ArticleID);
          }
        } else {
          suppArticleIndex += 1;
        }

        let article = await strapi.query("article").findOne({ ShortURL: row.ShortURL })
        if (article !== undefined && article !== null) {
          console.debug('updating existing article', row.ArticleID, article.ShortURL);
          // console.debug('skip existing article', article.ArticleID, article.ShortURL);
          // continue;
          const updated = await strapi.query("article").update({ id: article.id },
            {
              Body: body, Attachment: articlePrimaryAttachmentUri,
              Caption: articlePrimaryAttachmentCaption
            });
          console.debug("updated article", updated.id, row.ArticleID);

          article = updated;
          updatedRow += 1;
        } else {
          //insert article

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
          nonPrimarySections = [ ... new Set(nonPrimarySections)]

          // DO NOT NEED
          // const sqlSRelatedArticles = row.related_articles ? row.related_articles.split(","): []
          // if (sqlSRelatedArticles.length > 0) {
          //   pendingRelatedArticle.push({ArticleID: row.ArticleID, relatedArticle: sqlSRelatedArticles })
          // }

          // let publish_at = !row.IsActive ? null : row.CreatedDate;
          let publish_at = row.CreatedDate;
          let data = {
            ShortURL: row.ShortURL,
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

            Attachment: articlePrimaryAttachmentUri,
            Caption: articlePrimaryAttachmentCaption,

            ReadCount: row.ReadCount,
            
            TodaysNewsPaper: editionID
            // RelatedArticles: [],
            // tags: [],
            // TodaysNewsPaper: null,// for todays newspaper
            // HideFeatured
          }

          // console.debug("saving", foundRow, data);

          insertedRow += 1;
          const inserted = await strapi.query("article").create(data);
          console.debug("inserted article", inserted.id, row.ArticleID);

          // get updated article
          article = inserted;
        }// insert article

        // add article to supp
        if (supp.SupplementFeaturedArticle == null) {
          // no featured article yet
          console.debug("setting supplement featured article", supp.id, article.id);
          supp = await strapi.query("supplements").update({ id: supp.id }, { SupplementFeaturedArticle: { article: article.id } })
          // console.debug("saved supp featured article", supp.);
        }

        // check if existing articles exists, otherwise insert
        if (supp.SupplementArticleList == undefined || supp.SupplementArticleList == null) {
          supp.SupplementArticleList = { articles: [] }
        }

        // only insert other articles, not the 1st one (already as primary article)
        if (suppArticleIndex > 0) {
          console.debug("supp current SupplementArticleList", supp.id, "index", suppArticleIndex, "size", supp.SupplementArticleList.articles.length);
          let foundSuppArticle = false;
          for (var i = 0; i < supp.SupplementArticleList.articles.length; i++) {
            const suppArticle = supp.SupplementArticleList.articles[i];
            // console.debug('existing article', supp.id, suppArticle.id, suppArticle.Headline);
            if (suppArticle.id == article.id) {
              foundSuppArticle = true;
              break;
            }
          }
  
          if (!foundSuppArticle) {
            const articleIds = supp.SupplementArticleList.articles.map((suppArticle) => {
              return suppArticle.id
            });
            articleIds.push(article.id);
            console.debug("inserting new article into supplement", supp.id, article.id, article.Headline);
            supp = await strapi.query("supplements").update({ id: supp.id }, { SupplementArticleList: { articles: articleIds } })
            console.debug("added supp articles", supp.id, article.id, article.Headline);
          }
        }

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
