import { createClient } from '@libsql/client';

let _db;

function getDb() {
  if (!_db) {
    _db = createClient({
      url: Netlify.env.get('TURSO_DATABASE_URL'),
      authToken: Netlify.env.get('TURSO_AUTH_TOKEN'),
    });
  }
  return _db;
}

export default getDb;
