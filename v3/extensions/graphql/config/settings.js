const apolloServerPluginResponseCache = require("apollo-server-plugin-response-cache");
const { RedisCache } = require("apollo-server-cache-redis");
const redis = require("redis");
const moment = require("moment");
// set this to whatever you believe should be the max age for your cache control
const cacheDuration = 120; //seconds

const cache = new RedisCache(process.env.REDIS_URL || "redis://root@localhost/2");
const cacheQueryNames = ["HomepageEdition", "Homepage"];

module.exports = {
  endpoint: "/graphql",
  shadowCRUD: true,
  playgroundAlways: false,
  depthLimit: 7,
  amountLimit: 1000,
  shareEnabled: false,
  federation: false,
  apolloServer: {
    tracing: "production" !== strapi.config.environment ? true : false,
    cache: RedisCache,
    //   // persistedQueries: { ttl: 10 * MAX_AGE }, // we set this to be a factor of 10, somewhat arbitrary
    // cacheControl: { defaultMaxAge: cacheDuration },
    plugins: [
      // apolloServerPluginResponseCache({
      //   shouldReadFromCache,
      //   shouldWriteToCache,
      //   extraCacheKeyData,
      //   sessionId,
      // }),
      // injectCacheControl()
    ],
  },
  redisCacheClient: cache,
};

// module.exports.apolloServer.cache = cache
// module.exports.apolloServer.persistedQueries.cache = cache

async function sessionId(requestContext) {
  // return a session ID here, if there is one for this request
  return null;
}

async function shouldReadFromCache(requestContext) {
  if ("IntrospectionQuery" == requestContext.operationName) return false; // graphql ping ignore
  // return true;
  if (cacheQueryNames.includes(requestContext.operationName)) {
    const expired = await cacheExpired(requestContext);
    // console.debug(
    //   "shouldReadFromCache:",
    //   requestContext.operationName,
    //   "expired?",
    //   expired
    // );
    return !expired;
  }
  // console.debug("readCache nocache:", requestContext.operationName);
  return false;
}

async function cacheExpired(requestContext) {
  const cachedTime = await readRedis("graphql_" + requestContext.operationName);
  if (cachedTime === undefined || cachedTime === null) {
    // console.debug(
    //   "cacheExpired: not cached yet",
    //   requestContext.operationName,
    //   cachedTime
    // );
    return true;
  }
  const elapsed = moment().diff(moment.unix(cachedTime), "seconds");
  // console.debug(
  //   "cacheExpired cached since",
  //   requestContext.operationName,
  //   cachedTime,
  //   "elapsed",
  //   elapsed,
  //   "max",
  //   cacheDuration
  // );
  if (elapsed < cacheDuration) {
    // console.debug(
    //   "cacheExpired still active!",
    //   requestContext.operationName,
    //   "cached duration",
    //   elapsed,
    //   "/",
    //   cacheDuration
    // );
    return false;
  }
  return true;
}

async function shouldWriteToCache(requestContext) {
  // console.debug("shouldWriteToCache?", requestContext.operationName);
  if (cacheQueryNames.includes(requestContext.operationName)) {
    const expired = await cacheExpired(requestContext);
    if (!expired) return false;

    console.debug("caching write!", requestContext.operationName);
    await cache.client.set("graphql_" + requestContext.operationName, moment().unix());
    return true;
  }
  // decide if we should write to the cache in this request
  return false;
}

async function extraCacheKeyData(requestContext) {
  // use this to create any extra data that can be used for the cache key
}

function injectCacheControl() {
  return {
    requestDidStart(requestContext) {
      requestContext.overallCachePolicy = {
        scope: "PUBLIC", // or 'PRIVATE'
        maxAge: cacheDuration,
      };
    },
  };
}

async function readRedis(key, defaultValue = null) {
  return new Promise((resolve) => {
    cache.client.get(key, function (err, reply) {
      // console.log("redis result", reply); // Will print `OK`
      if (reply == null) {
        resolve(defaultValue);
        return;
      }
      resolve(reply);
    });
  });
}
