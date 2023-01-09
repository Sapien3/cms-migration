"use strict";
const _ = require("lodash");
const xml2js = require("xml2js");
const fs = require("fs");
const FormData = require("form-data");
const axios = require("axios");

async function uploadXML(ctx) {
  const userRole = ctx.state.user;
  const {
    request: { files: { files } = {} },
  } = ctx;

  //check if file is empty
  if (_.isEmpty(files) || files.size === 0) {
    return ctx.badRequest("File is empty");
  }

  //check if file is xml
  if (files.type !== "text/xml") {
    return ctx.badRequest("Only xml files are allowed");
  }

  //parse xml file content to js object
  let result;

  try {
    const data = await fs.promises.readFile(files.path, "utf8");
    const parser = new xml2js.Parser();
    result = await parser.parseStringPromise(data);
  } catch (err) {
    return ctx.badRequest("Error parsing xml file, cause: " + err.message);
  }

  try {
    const entryId = await convertToStrapi(result);
    ctx.send({
      entryId,
      message: "File Processed successfully",
      payload: result,
    });
  } catch (e) {
    console.error(e);
    return ctx.badRequest(e.message);
  }
}

async function convertToStrapi(data) {
  const {
    newsItem: { id, title, body, section },
  } = data;
  // console.log("title: ", title, "body: ", body);

  const requiredFields = ["id", "title", "section"];
  requiredFields.forEach((field) => {
    if (!data.newsItem[field][0])
      throw new Error(`Field ${field} is missing or empty`);
  });

  const authorsName = data.newsItem.authors[0].author;
  const authors = await findAuthors(authorsName);
  const primarySection = await findPrimarySection(section[0]);
  const fields = {
    Easy_news_id: id[0],
    Headline: title[0],
    Body: body[0],
    Authors: authors,
    PrimarySection: primarySection,
  };

  const model = await strapi.query("easy-news");
  const isDuplicate = await isDuplicateEntry(model, id[0]);
  if (isDuplicate) {
    const updatedEntry = await model.update({ Easy_news_id: id }, fields);
    return updatedEntry.id;
  }

  const entry = await model.create(fields);
  return entry.id;
}

async function isDuplicateEntry(model, id) {
  const entry = await model.find({ Easy_news_id: id });
  return entry.length > 0;
}

async function findAuthors(authors) {
  if (!authors) return [];
  const model = await strapi.query("author");
  const authorsInStrapi = (
    await Promise.all(
      authors.map((author) => model.find({ DisplayName: author }))
    )
  ).flat();

  return authorsInStrapi;
}

async function findPrimarySection(section) {
  if (!section) return null;
  const model = await strapi.query("section");
  const sectionInStrapi = await model.find({ Title: section });
  return sectionInStrapi[0];
}

async function uploadMedia(ctx) {
  const files = ctx.request.files.files;
  const entryId = ctx.request.body.entryId;
  if (!entryId) return ctx.badRequest("Entry id is missing");

  if (_.isEmpty(files) || files.size === 0) {
    return ctx.badRequest("File is empty");
  }

  //upload image to strapi
  const model = await strapi.query("easy-news");
  const entry = await model.findOne({ id: entryId });
  if (!entry) return ctx.badRequest("Entry not found");

  try {
    await postImage(files, entry);
  } catch (error) {
    console.error(error);
    return ctx.badRequest(error.message);
  }

  ctx.send({
    message: "Media uploaded successfully",
  });
}

async function postImage(image, entry) {
  const backendUrl = strapi.config.get("server.url");
  const url = backendUrl + "/upload";
  const formData = new FormData();
  const imageData = fs.createReadStream(image.path);
  formData.append("files", imageData, image.name);

  const response = await axios.post(url, formData, {
    headers: {
      "Content-Type": `multipart/form-data; boundary=${formData._boundary}`,
    },
  });

  // update entry
  const model = await strapi.query("easy-news");
  await model.update({ id: entry.id }, { FeaturedImage: response.data });
}

module.exports = {
  index: async (ctx) => {
    ctx.send({
      message: "ok",
    });
  },
  uploadXML,
  uploadMedia,
};
