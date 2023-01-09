const Boom = require("boom");

module.exports = {
  boomError: (msg) => {
    const error = new Error(msg);
    const boomError = Boom.boomify(error, {
      statusCode: 422,
    });
    throw boomError;
  },
};
