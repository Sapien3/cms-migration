"use strict";

/**
 * Module dependencies
 */

/* eslint-disable no-unused-vars */
// Public node modules.
const _ = require("lodash");
const AWS = require("aws-sdk");

const imagesDir = "images/";

module.exports = {
  init(config) {
    const S3 = new AWS.S3({
      apiVersion: "2006-03-01",
      ...config,
    });

    return {
      upload(file, customParams = {}) {
        const isImage = file.mime.startsWith("image/");

        return new Promise((resolve, reject) => {
          // upload file on S3 bucket
          const dir = isImage ? imagesDir : "";
          const Key = `${dir}${file.hash}${file.ext}`;
          S3.upload(
            {
              Key,
              Body: Buffer.from(file.buffer, "binary"),
              // ACL: "public-read",
              ContentType: file.mime,
              ...customParams,
            },
            (err, data) => {
              if (err) {
                return reject(err);
              }

              // console.debug("upload result", data);
              // set the bucket file url
              file.url = "/s3-assets/serve/" + data.Key;

              resolve();
            }
          );
        });
      },
      delete(file, customParams = {}) {
        return new Promise((resolve, reject) => {
          // delete file on S3 bucket
          const Key = file.url.replace("/s3-assets/serve/", "");
          S3.deleteObject(
            {
              Key,
              ...customParams,
            },
            (err, data) => {
              if (err) {
                return reject(err);
              }
              resolve();
            }
          );
        });
      },
    };
  },
};
