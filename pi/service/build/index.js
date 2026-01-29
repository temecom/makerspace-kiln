import d, { dirname as D } from "path";
import { fileURLToPath as g } from "url";
import { Low as I } from "lowdb";
import "node:fs";
import { writeFile as C, rename as R, readFile as N } from "node:fs/promises";
import { join as y, dirname as P, basename as j } from "node:path";
import { fileURLToPath as b } from "node:url";
import { SerialPort as E } from "serialport";
import O from "stream";
import p from "express";
import $ from "cors";
const _ = g(import.meta.url), w = d.dirname(_), S = process.env.NODE_ENV === "production", l = {
  isProduction: S,
  // Serial Port Configuration
  // On Linux/RPi this is often /dev/ttyACM0 or /dev/ttyUSB0
  // On Windows this might be COM3, COM4, etc.
  serialPort: "/dev/ttyACM0",
  baudRate: 9600,
  // Service Configuration
  statusInterval: 1e4,
  // Poll status every 10 seconds
  serverPort: 3e3,
  // Port for the Web API
  // Web App Path (Changes based on environment)
  // Production (Pi): './public' (bundled as sibling to index.js)
  // Development Local: '../client/dist' (relative to source index.js)
  clientPath: S ? d.join(w, "public") : d.join(w, "../client/dist")
  // Future: Google AppScript Configuration
  // cloudApiUrl: 'https://script.google.com/macros/s/...'
};
function k(i) {
  const t = i instanceof URL ? b(i) : i.toString();
  return y(P(t), `.${j(t)}.tmp`);
}
async function x(i, t, e) {
  for (let s = 0; s < t; s++)
    try {
      return await i();
    } catch (n) {
      if (s < t - 1)
        await new Promise((r) => setTimeout(r, e));
      else
        throw n;
    }
}
class q {
  #t;
  #e;
  #s = !1;
  #n = null;
  #o = null;
  #r = null;
  #i = null;
  // File is locked, add data for later
  #a(t) {
    return this.#i = t, this.#r ||= new Promise((e, s) => {
      this.#o = [e, s];
    }), new Promise((e, s) => {
      this.#r?.then(e).catch(s);
    });
  }
  // File isn't locked, write data
  async #l(t) {
    this.#s = !0;
    try {
      await C(this.#e, t, "utf-8"), await x(async () => {
        await R(this.#e, this.#t);
      }, 10, 100), this.#n?.[0]();
    } catch (e) {
      throw e instanceof Error && this.#n?.[1](e), e;
    } finally {
      if (this.#s = !1, this.#n = this.#o, this.#o = this.#r = null, this.#i !== null) {
        const e = this.#i;
        this.#i = null, await this.write(e);
      }
    }
  }
  constructor(t) {
    this.#t = t, this.#e = k(t);
  }
  async write(t) {
    return this.#s ? this.#a(t) : this.#l(t);
  }
}
class F {
  #t;
  #e;
  constructor(t) {
    this.#t = t, this.#e = new q(t);
  }
  async read() {
    let t;
    try {
      t = await N(this.#t, "utf-8");
    } catch (e) {
      if (e.code === "ENOENT")
        return null;
      throw e;
    }
    return t;
  }
  write(t) {
    return this.#e.write(t);
  }
}
class A {
  #t;
  #e;
  #s;
  constructor(t, { parse: e, stringify: s }) {
    this.#t = new F(t), this.#e = e, this.#s = s;
  }
  async read() {
    const t = await this.#t.read();
    return t === null ? null : this.#e(t);
  }
  write(t) {
    return this.#t.write(this.#s(t));
  }
}
class H extends A {
  constructor(t) {
    super(t, {
      parse: JSON.parse,
      stringify: (e) => JSON.stringify(e, null, 2)
    });
  }
}
const M = P(b(import.meta.url)), U = y(M, "db.json");
class B {
  constructor(t, e) {
    this.db = new I(t, e);
  }
  async init() {
    return await this.db.read(), await this.db.write(), this;
  }
  /**
   * Creates a new session.
   * @returns {object} The new session object.
   */
  async createSession() {
    const t = {
      id: Date.now(),
      startTime: (/* @__PURE__ */ new Date()).toISOString(),
      endTime: null,
      status: "RUNNING",
      events: []
    };
    return this.db.data.sessions.unshift(t), await this.db.write(), t;
  }
  /**
   * Adds a status event to an active session.
   * @param {number} sessionId The ID of the session to add the event to.
   * @param {object} eventData The status data to record.
   */
  async addSessionEvent(t, e) {
    const s = this.db.data.sessions.find((n) => n.id === t);
    if (s) {
      const n = new Date(s.startTime), T = Math.round((/* @__PURE__ */ new Date() - n) / 1e3);
      s.events.push({
        ...e,
        elapsedTime: T
      }), await this.db.write();
    }
  }
  /**
   * Finalizes a session, setting its end time and status.
   * @param {number} sessionId The ID of the session to finalize.
   * @param {string} finalStatus The final status of the session ('COMPLETED' or 'ABORTED').
   */
  async endSession(t, e) {
    const s = this.db.data.sessions.find((n) => n.id === t);
    s && s.status === "RUNNING" && (s.endTime = (/* @__PURE__ */ new Date()).toISOString(), s.status = e, await this.db.write());
  }
  /**
   * Clears all sessions from the database.
   */
  async clearHistory() {
    this.db.data.sessions = [], await this.db.write();
  }
}
const G = new H(U), J = { sessions: [] }, c = await new B(G, J).init();
var f = {}, h = {};
Object.defineProperty(h, "__esModule", { value: !0 });
h.DelimiterParser = void 0;
const L = O;
class K extends L.Transform {
  includeDelimiter;
  delimiter;
  buffer;
  constructor({ delimiter: t, includeDelimiter: e = !1, ...s }) {
    if (super(s), t === void 0)
      throw new TypeError('"delimiter" is not a bufferable object');
    if (t.length === 0)
      throw new TypeError('"delimiter" has a 0 or undefined length');
    this.includeDelimiter = e, this.delimiter = Buffer.from(t), this.buffer = Buffer.alloc(0);
  }
  _transform(t, e, s) {
    let n = Buffer.concat([this.buffer, t]), r;
    for (; (r = n.indexOf(this.delimiter)) !== -1; )
      this.push(n.slice(0, r + (this.includeDelimiter ? this.delimiter.length : 0))), n = n.slice(r + this.delimiter.length);
    this.buffer = n, s();
  }
  _flush(t) {
    this.push(this.buffer), this.buffer = Buffer.alloc(0), t();
  }
}
h.DelimiterParser = K;
Object.defineProperty(f, "__esModule", { value: !0 });
var v = f.ReadlineParser = void 0;
const W = h;
class z extends W.DelimiterParser {
  constructor(t) {
    const e = {
      delimiter: Buffer.from(`
`, "utf8"),
      encoding: "utf8",
      ...t
    };
    typeof e.delimiter == "string" && (e.delimiter = Buffer.from(e.delimiter, e.encoding)), super(e);
  }
}
v = f.ReadlineParser = z;
class V {
  constructor(t, e = 9600) {
    this.portPath = t, this.baudRate = e, this.port = null, this.parser = null, this.onStatusCallback = null, this.lastState = null, this.activeSessionId = null;
  }
  connect() {
    return new Promise((t, e) => {
      this.port = new E({ path: this.portPath, baudRate: this.baudRate }, (s) => {
        if (s)
          return e(s);
      }), this.port.on("error", (s) => {
        console.error("Serial Port Error:", s.message);
      }), this.parser = this.port.pipe(new v({ delimiter: `\r
` })), this.parser.on("data", (s) => {
        if (!(!s || s.trim() === ""))
          try {
            const n = JSON.parse(s);
            this.handleData(n);
          } catch {
            console.log("Raw Serial Data:", s);
          }
      }), this.port.on("open", () => {
        console.log(`Connected to kiln on ${this.portPath}`), setTimeout(t, 2e3);
      });
    });
  }
  async handleData(t) {
    if (t.status === "ok" || t.status === "error") {
      this.onStatusCallback ? this.onStatusCallback(t) : console.log("Received Command Response:", t);
      return;
    }
    this.onStatusCallback ? this.onStatusCallback(t) : console.log("Received:", t);
    const e = t.state;
    if (e && e !== this.lastState) {
      if (e === "STARTING") {
        const n = await c.createSession();
        this.activeSessionId = n.id, console.log(`[SESSION] Started new session: ${this.activeSessionId}`);
      }
      const s = e === "COMPLETED" || e === "ABORTED" || e === "EMERGENCY_STOP";
      if (this.activeSessionId && s) {
        const n = e;
        console.log(`[SESSION] Ending session: ${this.activeSessionId} with status: ${n}`), await c.endSession(this.activeSessionId, n), this.activeSessionId = null;
      }
    }
    this.activeSessionId && t.state && await c.addSessionEvent(this.activeSessionId, t), this.lastState = e;
  }
  onStatus(t) {
    this.onStatusCallback = t;
  }
  sendCommand(t) {
    if (!this.port || !this.port.isOpen) {
      console.error("Port not open, cannot send command:", t);
      return;
    }
    const e = JSON.stringify(t);
    console.log("Sending:", e), this.port.write(e + `
`, (s) => {
      if (s)
        return console.log("Error on write: ", s.message);
    });
  }
  // --- High Level Commands mapping to kiln.cpp ---
  start() {
    this.sendCommand({ command: "start" });
  }
  stop() {
    this.sendCommand({ command: "stop" });
  }
  /**
   * Set the kiln profile
   * @param {number} targetTemperature - Target temp in Celsius
   * @param {number} rampTime - Minutes to reach target
   * @param {number} soakDuration - Minutes to hold target
   * @param {number} coolTime - Minutes to cool down (determines rate)
   */
  setProfile(t, e, s, n) {
    this.sendCommand({
      command: "profile",
      targetTemperature: t,
      rampTime: e,
      soakDuration: s,
      coolTime: n
    });
  }
  getStatus() {
    this.sendCommand({ command: "status" });
  }
  testInput(t, e, s) {
    const n = {
      command: "testInput",
      temperature: t
    };
    e !== void 0 && (n.duration = e), s !== void 0 && (n.setPoint = s), this.sendCommand(n);
  }
}
const Y = g(import.meta.url);
D(Y);
console.log("Initializing Kiln Controller Service...");
console.log(`Environment: ${l.isProduction ? "Production" : "Development"}`);
console.log(`Serving Client from: ${l.clientPath}`);
const a = new V(l.serialPort, l.baudRate), o = p();
let m = { state: "UNKNOWN", timestamp: 0 }, u = [];
o.use($());
o.use(p.json());
o.use(p.static(l.clientPath));
o.get("/api/history", (i, t) => {
  t.json(c.db.data.sessions);
});
o.delete("/api/history", async (i, t) => {
  await c.clearHistory(), t.json({ success: !0, message: "History cleared" });
});
o.get("/api/history/:id", (i, t) => {
  const e = parseInt(i.params.id, 10), s = c.db.data.sessions.find((n) => n.id === e);
  s ? t.json(s) : t.status(404).json({ success: !1, message: "Session not found" });
});
o.get("/api/events", (i, t) => {
  t.setHeader("Content-Type", "text/event-stream"), t.setHeader("Cache-Control", "no-cache"), t.setHeader("Connection", "keep-alive"), t.flushHeaders();
  const e = JSON.stringify(m);
  t.write(`data: ${e}

`);
  const s = Date.now(), n = {
    id: s,
    res: t
  };
  u.push(n), i.on("close", () => {
    u = u.filter((r) => r.id !== s);
  });
});
o.get("/api/status", (i, t) => {
  t.json(m);
});
o.post("/api/start", (i, t) => {
  a.start(), t.json({ success: !0, message: "Start command sent" });
});
o.post("/api/stop", (i, t) => {
  a.stop(), t.json({ success: !0, message: "Stop command sent" });
});
o.post("/api/profile", (i, t) => {
  const { targetTemperature: e, rampTime: s, soakDuration: n, coolTime: r } = i.body;
  if (e === void 0)
    return t.status(400).json({ success: !1, message: "targetTemperature is required" });
  a.setProfile(e, s, n, r), t.json({
    success: !0,
    message: "Profile update sent",
    params: { targetTemperature: e, rampTime: s, soakDuration: n, coolTime: r }
  });
});
o.post("/api/test", (i, t) => {
  const { temperature: e, duration: s, setPoint: n } = i.body;
  if (e === void 0)
    return t.status(400).json({ success: !1, message: "temperature is required" });
  a.testInput(e, s, n), t.json({
    success: !0,
    message: "Test mode initiated",
    params: { temperature: e, duration: s, setPoint: n }
  });
});
o.post("/api/test/temp", (i, t) => {
  const { temperature: e } = i.body;
  if (e === void 0)
    return t.status(400).json({ success: !1, message: "temperature is required" });
  a.testInput(e), t.json({
    success: !0,
    message: "Simulated temperature set",
    params: { temperature: e }
  });
});
a.onStatus((i) => {
  m = { ...i, timestamp: Date.now() }, u.forEach((t) => {
    t.res.write(`data: ${JSON.stringify(m)}

`);
  }), i.state ? console.log(`[STATUS] State: ${i.state} | Temp: ${i.input?.toFixed(1)}°C | Setpoint: ${i.setpoint?.toFixed(1)}°C`) : i.message ? console.log(`[MSG] ${i.message}`) : console.log("[DATA]", i);
});
o.get("*", (i, t) => {
  t.sendFile(d.join(l.clientPath, "index.html"));
});
async function Q() {
  try {
    await a.connect(), o.listen(l.serverPort, () => {
      console.log(`Web API running on http://localhost:${l.serverPort}`);
    }), console.log("Requesting initial status...");
    const i = () => {
      console.log(`
Service stopping. Turning off kiln...`), a.stop(), setTimeout(() => {
        a.port && a.port.isOpen && a.port.close(), process.exit(0);
      }, 500);
    };
    process.on("SIGINT", i), process.on("SIGTERM", i);
  } catch (i) {
    console.error("ERROR: Failed to connect to kiln."), console.error(`Attempted port: ${l.serialPort}`), console.error("Details:", i.message), console.log(`
Hint: Check if the Arduino is connected and the port is correct in config.js`), process.exit(1);
  }
}
Q();
