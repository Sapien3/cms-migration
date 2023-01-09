'use strict';

/**
 * easy-new service
 */

const { createCoreService } = require('@strapi/strapi').factories;

module.exports = createCoreService('api::easy-new.easy-new');