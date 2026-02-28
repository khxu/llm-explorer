import { useState, useEffect } from 'react'
import './App.css'
import { connect } from '@tursodatabase/database-wasm/vite';
import {Button} from '@primer/react'
import {Table, DataTable} from '@primer/react/experimental'

const database = await connect('llm-explorer-2026-01-06.db');
await database.exec(`
  CREATE TABLE IF NOT EXISTS input_tables (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    description TEXT,
    columns TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )
`);

function InputTableViewer({ refreshKey }) {
  const [rows, setRows] = useState([]);
  const pageSize = 10
  const [pageIndex, setPageIndex] = useState(0)
  const start = pageIndex * pageSize
  const end = start + pageSize
  const rowsToDisplay = rows.slice(start, end)

  useEffect(() => {
    async function fetchRows() {
      try {
        const posts = await database.prepare(`SELECT * FROM input_tables`).all();
        setRows(posts);
        console.log('Fetched rows:', posts);
      } catch (error) {
        console.error('Error fetching rows:', error);
        setRows([]);
      }
    }
    fetchRows();
  }, [refreshKey]);

  return (
    <Table.Container>
      <Table.Title as="h2" id="posts-pagination">
        Posts
      </Table.Title>
      <DataTable
        aria-labelledby="posts-pagination"
        data={rowsToDisplay}
        columns={[
          {
            header: 'id',
            field: 'id',
            rowHeader: true,
          },
          {
            header: 'name',
            field: 'name',
          },
          {
            header: 'description',
            field: 'description',
          },
          {
            header: 'columns',
            field: 'columns',
          },
          {
            header: 'created_at',
            field: 'created_at',
          },
          {
            header: 'updated_at',
            field: 'updated_at',
          },
        ]}
      />
      <Table.Pagination
        aria-label="Pagination for Input Table"
        pageSize={pageSize}
        totalCount={rows.length}
        onChange={({pageIndex}) => {
          setPageIndex(pageIndex)
        }}
      />
    </Table.Container>
  );
}

function App() {
  const [refreshKey, setRefreshKey] = useState(0);

  return (
    <>
      <h1>LLM explorer</h1>
      <InputTableViewer refreshKey={refreshKey} />
      <div className="card">
        <div style={{ display: 'flex', gap: '8px' }}>
          <Button
            onClick={async () => {
              // Insert a inputTable
              const insertInputTable = database.prepare('INSERT INTO input_tables (name, description, columns) VALUES (?, ?, ?)');
              const result = await insertInputTable.run('Hello World', 'A description of the table!', '[{"name": "id", "type": "integer"}, {"name": "title", "type": "text"}, {"name": "content", "type": "text"}, {"name": "created_at", "type": "datetime"}]');
              console.log(`Inserted input table with ID: ${result.lastInsertRowid}`);
              setRefreshKey(prevKey => prevKey + 1);
              await database.exec(`PRAGMA wal_checkpoint(TRUNCATE)`);
            }}
            style={{ display: 'inline-block' }}
          >Insert row</Button>
          <Button
            onClick={async () => {
              // Drop and recreate the posts table
              await database.exec(`DROP TABLE IF EXISTS input_tables`);
              await database.exec(`
                CREATE TABLE IF NOT EXISTS input_tables (
                  id INTEGER PRIMARY KEY AUTOINCREMENT,
                  name TEXT NOT NULL,
                  description TEXT,
                  columns TEXT,
                  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
                )
              `);
              console.log('Dropped and recreated input table');
              setRefreshKey(prevKey => prevKey + 1);
            }}
            variant='danger'
            style={{ display: 'inline-block' }}
          >Drop and recreate input table</Button>
          <Button
            onClick={async () => {
              // Run PRAGMA checkpoint
              await database.exec(`PRAGMA wal_checkpoint(TRUNCATE)`);
              console.log('Ran PRAGMA checkpoint');
            }}
          >
            Run PRAGMA checkpoint
          </Button>
        </div>
      </div>
    </>
  )
}

export default App
