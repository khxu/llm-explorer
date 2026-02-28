import { connect } from '@tursodatabase/database-wasm/vite';

const database = await connect('llm-explorer-2026-01-06.db');

async function checkpoint() {
  await database.exec(`PRAGMA wal_checkpoint(TRUNCATE)`);
}

export { database, checkpoint };
