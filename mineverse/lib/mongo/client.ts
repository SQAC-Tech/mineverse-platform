import { MongoClient, type Db } from 'mongodb';

/**
 * One MongoDB connection for the whole server process.
 *
 * Next.js reloads modules on every edit in development and runs route handlers
 * concurrently in production; a client per import would open a new connection
 * pool each time and exhaust the Atlas connection limit within an afternoon.
 * The client is cached on `globalThis` so a hot reload reuses the pool rather
 * than leaking it.
 *
 * The promise, not the client, is what gets cached: two requests arriving
 * before the first connection completes must wait on the same handshake rather
 * than starting a second one.
 */

const globalForMongo = globalThis as unknown as {
  __mineverseMongo?: Promise<MongoClient>;
};

const DB_NAME = process.env.MONGODB_DB || 'mineverse';

function connect(): Promise<MongoClient> {
  const uri = process.env.MONGODB_URI;
  if (!uri) throw new Error('MONGODB_URI is not set.');

  const client = new MongoClient(uri, {
    // The event runs on campus wifi that drops packets; a short selection
    // timeout turns a two-second blip into a failed round submission.
    serverSelectionTimeoutMS: 15_000,
    // Well under Atlas's per-cluster ceiling, and more than enough for the
    // request concurrency this platform sees at 45 teams.
    maxPoolSize: 20,
    retryWrites: true,
  });

  return client.connect();
}

export function mongoClient(): Promise<MongoClient> {
  if (!globalForMongo.__mineverseMongo) {
    globalForMongo.__mineverseMongo = connect().catch((error) => {
      // A failed connection must not be cached, or every later request in this
      // process inherits the one bad handshake and the server never recovers
      // without a redeploy.
      globalForMongo.__mineverseMongo = undefined;
      throw error;
    });
  }
  return globalForMongo.__mineverseMongo;
}

export async function mongoDb(): Promise<Db> {
  return (await mongoClient()).db(DB_NAME);
}
