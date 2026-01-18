import { Low } from 'lowdb'
import { JSONFile } from 'lowdb/node'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url));
const file = join(__dirname, 'db.json');

class KilnDatabase {
  constructor(adapter, defaultData) {
    this.db = new Low(adapter, defaultData);
  }

  async init() {
    await this.db.read();
    await this.db.write();
    return this;
  }

  /**
   * Creates a new session.
   * @returns {object} The new session object.
   */
  async createSession() {
    const newSession = {
      id: Date.now(),
      startTime: new Date().toISOString(),
      endTime: null,
      status: 'RUNNING',
      events: []
    }
    this.db.data.sessions.unshift(newSession);
    await this.db.write();
    return newSession;
  }

  /**
   * Adds a status event to an active session.
   * @param {number} sessionId The ID of the session to add the event to.
   * @param {object} eventData The status data to record.
   */
  async addSessionEvent(sessionId, eventData) {
    const session = this.db.data.sessions.find(s => s.id === sessionId);
    if (session) {
      session.events.push({
        ...eventData,
        timestamp: new Date().toISOString()
      });
      await this.db.write();
    }
  }

  /**
   * Finalizes a session, setting its end time and status.
   * @param {number} sessionId The ID of the session to finalize.
   * @param {string} finalStatus The final status of the session ('COMPLETED' or 'ABORTED').
   */
  async endSession(sessionId, finalStatus) {
    const session = this.db.data.sessions.find(s => s.id === sessionId);
    if (session && session.status === 'RUNNING') {
      session.endTime = new Date().toISOString();
      session.status = finalStatus;
      await this.db.write();
    }
  }

  /**
   * Clears all sessions from the database.
   */
  async clearHistory() {
    this.db.data.sessions = [];
    await this.db.write();
  }
}

const adapter = new JSONFile(file);
const defaultData = { sessions: [] };
const kilnDatabase = await new KilnDatabase(adapter, defaultData).init();

export default kilnDatabase;
