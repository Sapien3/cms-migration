"use strict";

const AWS = require("aws-sdk");
const moment = require("moment");
// AWS.config.update({region: 'REGION'});
// import S3 from 'aws-sdk/clients/s3';

/**
 * Read the documentation (https://strapi.io/documentation/v3.x/concepts/services.html#core-services)
 * to customize this service
 */

// fyr: https://docs.aws.amazon.com/sdk-for-javascript/v2/developer-guide/s3-example-creating-buckets.html

/**
 *
 * @description - this function gets the corresponding s3 url, and if it doesn't exist, it creates it
 * with an expiration date of 7 days from now.
 */
const getAssetURL = async (sPath) => {
  const config = strapi.config.plugins.upload;
  const bucket = null; // handle single bucket
  let path = sPath;
  if (sPath.startsWith("/")) {
    path = path.substring(1);
  }
  if (path.indexOf("?") >= 0) {
    path = path.substring(0, path.indexOf("?"));
  }
  if (path.indexOf("&") >= 0) {
    path = path.substring(0, path.indexOf("&"));
  }

  const res = await strapi.query("s3-asset").find({ bucket: bucket, path: path });
  if (res.length >= 1) {
    const foundAsset = res[0];
    const now = moment();
    //if current time is less than the expiration time, return the url
    if (foundAsset.expires_at === null || now.add(1, "minute").isBefore(foundAsset.expires_at)) {
      // console.debug("asset", foundAsset);
      return foundAsset.url;
    }
  }

  // console.log("hit s3");

  // getting signed url from s3
  const s3ProviderOption = config.providerOptions;
  var Mutex = require("async-mutex").Mutex;
  const s3 = new AWS.S3({
    apiVersion: "2006-03-01",
    accessKeyId: s3ProviderOption.accessKeyId,
    secretAccessKey: s3ProviderOption.secretAccessKey,
    region: s3ProviderOption.region,
  });
  const mutex = new Mutex();

  // console.debug("strapi", strapi.config.plugins.upload)
  const s3Param = s3ProviderOption.params;

  const release = await mutex.acquire();
  try {
    // delete if exists
    await strapi.query("s3-asset").delete({ bucket: bucket, path: path });

    return new Promise(async function (resolve, reject) {
      // const s3Bucket = process.env.AWS_BUCKET;

      try {
        // console.debug(`checking s3 ${path}`);
        // const headCode = await s3.headObject({ ...s3Param, Key: path }).promise();
        const signedUrlExpireSeconds = 60 * 60 * 24 * 7; //7days
        const url = s3.getSignedUrl("getObject", {
          ...s3Param,
          Key: path,
          Expires: signedUrlExpireSeconds,
        });
        // console.debug("url", url);
        // save this url
        const expiresAt = moment()
          .add(signedUrlExpireSeconds - 10, "seconds")
          .toDate();
        await strapi.query("s3-asset").create({
          expires_at: expiresAt,
          path: path,
          bucket: bucket,
          url: url,
        });

        return resolve(url);
      } catch (headErr) {
        console.error("error s3", headErr);
        if (headErr.code === "NotFound") {
          return resolve(null);
        }
      }
    });
  } finally {
    release();
  }
};

module.exports = {
  getAssetURL: getAssetURL,
};
