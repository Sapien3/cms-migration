const mysqldump = require('mysqldump');
const env = require('dotenv').config({ path: __dirname + '/../.env' }).parsed;

// or const mysqldump = require('mysqldump')
// dump the result straight to a file
mysqldump({
  connection: {
    host: env.DATABASE_HOST || '127.0.0.1',
    port: env.DATABASE_PORT || 3306,
    user: env.DATABASE_USERNAME || 'root',
    password: env.DATABASE_PASSWORD || '',
    database: env.DATABASE_NAME || '',
    ssl: env.DATABASE_SSL,
  },
  view: {
    createOrReplace: true
  },
  trigger: {
    dropIfExist: true
  },
  
  dump: {
    excludeTables: true,
    tables: ['display_pings'],
    schema: {
      table: {
        dropIfExist: true
      }
    },
  },

  data: {
    lockTables: true,

  },
  dumpToFile: './dump.sql',
  // compressFile: true,
});
