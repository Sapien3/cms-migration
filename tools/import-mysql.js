
const env = require('dotenv').config({ path: __dirname + '/../.env' });
const Importer = require('mysql-import');

const DB_HOST = process.env.DATABASE_HOST || '127.0.0.1'
const importer = new Importer({ host: DB_HOST, user: process.env.DATABASE_USERNAME || 'root', password: process.env.DATABASE_PASSWORD || '', database: process.env.DATABASE_NAME || '', port: process.env.DATABASE_PORT, ssl: process.env.DATABASE_SSL });

importer.import('dump.sql').then(() => {
  var files_imported = importer.getImported();
  console.log(`${files_imported.length} SQL file(s) imported.`);
}).catch(err => {
  console.error(err);
});