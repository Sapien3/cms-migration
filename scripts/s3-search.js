const AWS = require("aws-sdk");
const dotenv = require("dotenv");
dotenv.config();

const s3 = new AWS.S3({
  apiVersion: "2006-03-01",
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_ACCESS_SECRET,
  region: process.env.AWS_REGION,
});

const params = {
  Bucket: process.env.AWS_BUCKET,
  // Delimiter: "/",
  Prefix: "imagesManual/",
};

console.time("search");
s3.listObjects(params, function (err, data) {
  if (err) return console.log(err, err.stack); // an error occurred
  console.log("data: ", data.Contents);
});

console.timeEnd("search");
