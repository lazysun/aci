import express from "express";
import { createServer as createViteServer } from "vite";
import Database from "better-sqlite3";
import path from "path";
import { fileURLToPath } from "url";
import { createServer } from "http";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const db = new Database("stories.db");

// Initialize DB
db.exec(`
  CREATE TABLE IF NOT EXISTS stories (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );
  
  CREATE TABLE IF NOT EXISTS pages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    story_id INTEGER,
    page_index INTEGER,
    image TEXT,
    text TEXT,
    FOREIGN KEY(story_id) REFERENCES stories(id)
  );
`);

async function startServer() {
  const app = express();
  const httpServer = createServer(app);
  const PORT = 3000;

  app.use(express.json({ limit: '50mb' })); // Keep high limit for individual large pages

  // API Routes
  
  // 1. Create Story Container
  app.post("/api/stories", (req, res) => {
    try {
      const { title } = req.body;
      const stmt = db.prepare("INSERT INTO stories (title) VALUES (?)");
      const info = stmt.run(title || "Untitled Story");
      res.json({ id: info.lastInsertRowid, success: true });
    } catch (error) {
      console.error("Error creating story:", error);
      res.status(500).json({ error: "Failed to create story" });
    }
  });

  // 2. Upload Page (Chunk)
  app.post("/api/stories/:id/pages", (req, res) => {
    try {
      const { page_index, image, text } = req.body;
      const storyId = req.params.id;
      
      const stmt = db.prepare("INSERT INTO pages (story_id, page_index, image, text) VALUES (?, ?, ?, ?)");
      stmt.run(storyId, page_index, image, text);
      
      res.json({ success: true });
    } catch (error) {
      console.error("Error saving page:", error);
      res.status(500).json({ error: "Failed to save page" });
    }
  });

  // 3. Get Full Story
  app.get("/api/stories/:id", (req, res) => {
    try {
      const storyStmt = db.prepare("SELECT * FROM stories WHERE id = ?");
      const story = storyStmt.get(req.params.id) as any;
      
      if (story) {
        const pagesStmt = db.prepare("SELECT image, text FROM pages WHERE story_id = ? ORDER BY page_index ASC");
        const pages = pagesStmt.all(req.params.id);
        
        res.json({ ...story, pages });
      } else {
        res.status(404).json({ error: "Story not found" });
      }
    } catch (error) {
      console.error("Error fetching story:", error);
      res.status(500).json({ error: "Failed to fetch story" });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { 
        middlewareMode: true,
        hmr: {
          server: httpServer
        }
      },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    // Production static serving (not strictly needed for this env but good practice)
    app.use(express.static(path.resolve(__dirname, "dist")));
  }

  httpServer.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
