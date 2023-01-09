const xml2js = require("xml2js");
const fs = require("fs");
const AWS = require("aws-sdk");
const dotenv = require("dotenv");
dotenv.config();

//return a promise with xmlData.json file
const readXMLFiles = async () => {
  const filePath = __dirname + "/xmlData.json";
  const data = await fs.promises.readFile(filePath, "utf8");
  return JSON.parse(data);
};

const s3 = new AWS.S3({
  apiVersion: "2006-03-01",
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_ACCESS_SECRET,
  region: process.env.AWS_REGION,
});

// const readXMLFiles = async () => {
//   const params = {
//     Bucket: process.env.AWS_BUCKET,
//     // Delimiter: "/",
//     Prefix: "imagesManual/",
//   };

//   let data = await s3.listObjects(params).promise();
//   //download data[0] file to __dirname as it is without processing
//   const file = data.Contents[0];
//   const fileData = await s3.getObject({ Bucket: process.env.AWS_BUCKET, Key: file.Key }).promise();
//   const fileArr = file.Key.split("/");
//   fs.writeFileSync(`${__dirname}/${fileArr[fileArr.length - 1]}`, fileData.Body);

//   // return xmlFilesData;
// };

// const readXMLFiles = async () => {
//   const params = {
//     Bucket: process.env.AWS_BUCKET,
//     // Delimiter: "/",
//     Prefix: "imagesManual/",
//   };

//   let data = await s3.listObjects(params).promise();
//   const xmlFilesData = await Promise.all(
//     data.Contents.map(async (file) => {
//       const data = await s3.getObject({ Bucket: process.env.AWS_BUCKET, Key: file.Key }).promise();
//       const parser = new xml2js.Parser();
//       const result = await parser.parseStringPromise(data.Body);
//       return result;
//     })
//   );

//   //save xmlData array to json file
//   fs.writeFileSync("xmlData.json", JSON.stringify(xmlFilesData));

//   return xmlFilesData;
// };

// read xml files from local and process all of them at once
// const readXMLFiles = async () => {
//   const xmlFilesData = await Promise.all(
//     fs.readdirSync(xmlFilePath).map(async (file) => {
//       const data = fs.readFileSync(`${xmlFilePath}/${file}`);
//       const parser = new xml2js.Parser();
//       const result = await parser.parseStringPromise(data);
//       return result;
//     })
//   );
//   return xmlFilesData;
// };

console.time("readXMLFiles");
readXMLFiles().then((data) => {
  // console.log(data);
  // console.log(getKeys(data));
  console.log(searchForTagValue("slugline", data));
  console.timeEnd("readXMLFiles");
});

function searchForTagValue(tag, xmlFilesData) {
  // return the index of the first non-empty string value
  for (let i = 0; i < xmlFilesData.length; i++) {
    // console.log("tag", xmlFilesData[i].newsItem[tag]);
    if (xmlFilesData[i].newsItem[tag]) {
      console.log("tag", xmlFilesData[i].newsItem);
      return i;
    }
  }
}

function getKeys(xmlFilesData) {
  const keys = {};
  xmlFilesData.forEach((xmlFile) => {
    for (const key in xmlFile.newsItem) {
      if (!keys[key]) keys[key] = {};
      if (isJsObject(xmlFile.newsItem[key][0])) {
        keys[key] = recursiveCountFields(xmlFile.newsItem[key][0]);
      }
    }
  });

  return keys;
}

function isJsObject(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function recursiveCountFields(obj) {
  const keys = {};
  for (const key in obj) {
    if (isJsObject(obj[key][0])) {
      keys[key] = recursiveCountFields(obj[key][0]);
    } else {
      keys[key] = {};
    }
  }
  return keys;
}
