'use strict';

/**
 * advertise-with-us service
 */

const { createCoreService } = require('@strapi/strapi').factories;

module.exports = createCoreService('api::advertise-with-us.advertise-with-us');