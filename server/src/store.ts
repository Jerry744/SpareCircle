import { DatabaseSync } from "node:sqlite";

export interface StoredProject {
  projectId: string;
  serializedProject: string;
  updatedAt: string;
}

export class ProjectStore {
  private readonly db: DatabaseSync;

  constructor(dbPath = "./server/data/sparecircle.db") {
    this.db = new DatabaseSync(dbPath);
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS projects (
        project_id TEXT PRIMARY KEY,
        serialized_project TEXT NOT NULL,
        updated_at TEXT NOT NULL
      )
    `);
  }

  save(projectId: string, serializedProject: string): StoredProject {
    const updatedAt = new Date().toISOString();
    const statement = this.db.prepare(`
      INSERT INTO projects (project_id, serialized_project, updated_at)
      VALUES (?, ?, ?)
      ON CONFLICT(project_id) DO UPDATE SET
        serialized_project = excluded.serialized_project,
        updated_at = excluded.updated_at
    `);
    statement.run(projectId, serializedProject, updatedAt);

    return {
      projectId,
      serializedProject,
      updatedAt,
    };
  }

  load(projectId: string): StoredProject | null {
    const statement = this.db.prepare(`
      SELECT project_id, serialized_project, updated_at
      FROM projects
      WHERE project_id = ?
    `);

    const row = statement.get(projectId) as
      | { project_id: string; serialized_project: string; updated_at: string }
      | undefined;

    if (!row) {
      return null;
    }

    return {
      projectId: row.project_id,
      serializedProject: row.serialized_project,
      updatedAt: row.updated_at,
    };
  }
}
