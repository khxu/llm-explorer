import { useState, useEffect } from 'react'
import reactLogo from './assets/react.svg'
import viteLogo from '/vite.svg'
import './App.css'
import { connect } from '@tursodatabase/database-wasm';

const database = await connect('my-database.db');

function App() {
  return (
    <>
      <h1>Vite + React</h1>
      <div className="card">
        <button
          onClick={async () => {
          // Create a table
          await database.exec(`
            CREATE TABLE IF NOT EXISTS posts (
              id INTEGER PRIMARY KEY AUTOINCREMENT,
              title TEXT NOT NULL,
              content TEXT,
              created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )
          `);

          // Insert a post
          const insertPost = database.prepare('INSERT INTO posts (title, content) VALUES (?, ?)');
          const result = await insertPost.run('Hello World', 'This is my first blog post!');

          console.log(`Inserted post with ID: ${result.lastInsertRowid}`);
        }}
        >Insert row</button>
      </div>
    </>
  )
}

export default App
