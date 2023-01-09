const AWS = require("aws-sdk");
const dotenv = require("dotenv");
dotenv.config();

const s3 = new AWS.S3({
  apiVersion: "2006-03-01",
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_ACCESS_SECRET,
  region: process.env.AWS_REGION,
});

const Bucket = process.env.AWS_BUCKET;
const sourceDir = "imagesManual/";
const destDir = "images/";
const params = {
  Bucket,
  Prefix: sourceDir,
};
const Exts = ["jpg", "jpeg", "png", "gif", "webp", "jfif"];
const capitalExts = Exts.map((ext) => ext.toUpperCase()); // ["JPG", "JPEG", "PNG", "GIF", "WEBP", "JFIF"]
const imagesExt = [...Exts, ...capitalExts];

handleAllKeys();

function handleAllKeys() {
  s3.listObjectsV2(params, (err, data) => {
    if (err) {
      // Handle the error
    } else {
      // For each file in the source directory, copy it to the destination
      console.log("data.Contents: ", data.Contents.length);
      data.Contents.forEach((file) => {
        const sourceKey = file.Key;
        const sourceKeyExt = sourceKey.split(".").pop();
        if (!imagesExt.includes(sourceKeyExt)) return;
        const destKey = sourceKey.replace(sourceDir, destDir);

        // Use the S3 client to copy the file
        s3.copyObject(
          {
            Bucket,
            CopySource: `${Bucket}/${sourceKey}`,
            Key: destKey,
          },
          (err, data) => {
            if (err) {
              // Handle the error
              console.log("copy err: ", err);
            } else {
              // The file was copied successfully, so delete the original
              s3.deleteObject(
                {
                  Bucket,
                  Key: sourceKey,
                },
                (err, data) => {
                  if (err) {
                    // Handle the error
                    console.log("delete err: ", err);
                  } else {
                    // The file was deleted successfully
                  }
                }
              );
            }
          }
        );
      });
      if (data.IsTruncated) {
        params.ContinuationToken = data.NextContinuationToken;
        console.log("get further list...");
        handleAllKeys();
      }
    }
  });
}

// Use the S3 client to list all the files in the source directory
