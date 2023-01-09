const mysqldump = require('mysqldump');
const env = require('dotenv').config({ path: __dirname + '/../.env' });

// or const mysqldump = require('mysqldump')
// dump the result straight to a file
mysqldump({
  connection: {
    host: process.env.DATABASE_HOST || '127.0.0.1',
    port: process.env.DATABASE_PORT || 3306,
    user: process.env.DATABASE_USERNAME || 'root',
    password: process.env.DATABASE_PASSWORD || '',
    database: process.env.DATABASE_NAME || '',
    ssl: process.env.DATABASE_SSL,
  },
  view: {
    createOrReplace: true
  },
  trigger: {
    dropIfExist: true
  },

  dump: {
    schema: {
      table: {
        dropIfExist: true
      }
    },

    tables: [
      'core_store', 'strapi_permission', 'strapi_role', 'strapi_webhooks', 'users-permissions_permission', 'users-permissions_role'
    ],
  },


  data: {
    lockTables: true,

  },
  dumpToFile: './dump-config.sql',
  // compressFile: true,
});
