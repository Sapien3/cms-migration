const fs = require("fs");
const path = require("path");

const filePath = path.resolve(__dirname, "./store.json");
let cache = null;
const fields = ["FeaturedMalafId", "SortedEditions", "SortedEditionsWithMalafat"];

const crud = {
  readStore: async function (key) {
    if (cache) return key ? cache[key] : cache;
    const store = crud.validateAndGetStore();
    cache = store;
    if (key) return store[key];
    return store;
  },
  writeStore: async function (key, value) {
    const store = await crud.readStore();
    store[key] = value;
    await fs.promises.writeFile(filePath, JSON.stringify(store), "utf8");
    cache = null;
  },
  validateAndGetStore() {
    if (!fs.existsSync(filePath)) {
      const json = {};
      fields.forEach((field) => (json[field] = null));
      fs.writeFileSync(filePath, JSON.stringify(json), "utf8");
      return json;
    }

    //file exists, check if it has all the fields
    let shouldWrite = false;
    const json = JSON.parse(fs.readFileSync(filePath, "utf8"));
    fields.forEach((field) => {
      if (!json[field]) {
        json[field] = null;
        shouldWrite = true;
      }
    });
    if (shouldWrite) fs.writeFileSync(filePath, JSON.stringify(json), "utf8");
    return json;
  },
};

module.exports = crud;
