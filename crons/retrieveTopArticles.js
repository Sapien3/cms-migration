const { retrieveTopView } = require("../api/google-analytics/services/analytics")
const { loadStrapi } = require("./base");

const retrieveTopArticles = async () => {
  await loadStrapi();

  await retrieveTopView();
  console.info("Done.");
}
module.exports = {
  retrieveTopArticles
}

if (require.main === module) {
  retrieveTopArticles();
}
