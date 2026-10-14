import { waitUntil } from "@vercel/functions";
import { createApp } from "../server/index.mjs";
import { PostgresStore } from "../server/postgres-store.mjs";

let service;
async function initialize() {
  const store = await PostgresStore.connect(process.env.DATABASE_URL);
  try {
    return await createApp({ store, serverless: true, background: waitUntil });
  } catch (error) {
    await store.close();
    throw error;
  }
}
export default async function handler(req, res) {
  try {
    service ??= initialize().catch((error) => {
      service = undefined;
      throw error;
    });
    (await service).app(req, res);
  } catch {
    res
      .status(503)
      .json({
        error:
          "Hosting setup is incomplete. Ask the instructor to check the database, password and encryption key.",
      });
  }
}
