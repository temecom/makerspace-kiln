import config from './config.js';
import kilnDatabase from './db.js';
import KilnInterface from './kiln-interface.js';
import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

console.log('Initializing Kiln Controller Service...');

const kiln = new KilnInterface(config.serialPort, config.baudRate);
const app = express();
let latestStatus = { state: 'UNKNOWN', timestamp: 0 };
let clients = [];

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '../client/dist')));

// --- Web API Routes ---

// GET /api/history - Get all history records
app.get('/api/history', (req, res) => {
    res.json(kilnDatabase.db.data.sessions);
});

// DELETE /api/history - Clear all history records
app.delete('/api/history', async (req, res) => {
    await kilnDatabase.clearHistory();
    res.json({ success: true, message: 'History cleared' });
});

// GET /api/events - Server Sent Events endpoint
app.get('/api/events', (req, res) => {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders();

    // Send initial status immediately
    const initialData = JSON.stringify(latestStatus);
    res.write(`data: ${initialData}\n\n`);

    const clientId = Date.now();
    const newClient = {
        id: clientId,
        res
    };
    clients.push(newClient);

    req.on('close', () => {
        clients = clients.filter(c => c.id !== clientId);
    });
});

// GET /api/status - Get the latest known status
app.get('/api/status', (req, res) => {
    res.json(latestStatus);
});

// POST /api/start - Start the kiln
app.post('/api/start', (req, res) => {
    kiln.start();
    res.json({ success: true, message: 'Start command sent' });
});

// POST /api/stop - Stop the kiln
app.post('/api/stop', (req, res) => {
    kiln.stop();
    res.json({ success: true, message: 'Stop command sent' });
});

// POST /api/profile - Set the firing profile
// Body: { targetTemperature, rampTime, soakDuration, coolTime }
app.post('/api/profile', (req, res) => {
    const { targetTemperature, rampTime, soakDuration, coolTime } = req.body;
    
    if (targetTemperature === undefined) {
        return res.status(400).json({ success: false, message: 'targetTemperature is required' });
    }

    kiln.setProfile(targetTemperature, rampTime, soakDuration, coolTime);
    res.json({ 
        success: true, 
        message: 'Profile update sent',
        params: { targetTemperature, rampTime, soakDuration, coolTime }
    });
});

// POST /api/test - Initiate test mode
app.post('/api/test', (req, res) => {
    const { temperature, duration, setPoint } = req.body;
    
    if (temperature === undefined) {
        return res.status(400).json({ success: false, message: 'temperature is required' });
    }

    kiln.testInput(temperature, duration, setPoint);
    res.json({ 
        success: true, 
        message: 'Test mode initiated',
        params: { temperature, duration, setPoint }
    });
});

// POST /api/test/temp - Set simulated temperature
app.post('/api/test/temp', (req, res) => {
    const { temperature } = req.body;
    
    if (temperature === undefined) {
        return res.status(400).json({ success: false, message: 'temperature is required' });
    }

    kiln.testInput(temperature);
    res.json({ 
        success: true, 
        message: 'Simulated temperature set',
        params: { temperature }
    });
});

// Handle incoming status messages from the Kiln
kiln.onStatus((data) => {
    latestStatus = { ...data, timestamp: Date.now() };

    // Broadcast status to connected SSE clients
    clients.forEach(client => {
        client.res.write(`data: ${JSON.stringify(latestStatus)}\n\n`);
    });

    // This is where you would hook in the Google AppScript Cloud API communication
    // For now, we will pretty-print the status to the console
    if (data.state) {
        console.log(`[STATUS] State: ${data.state} | Temp: ${data.input?.toFixed(1)}°C | Setpoint: ${data.setpoint?.toFixed(1)}°C`);
    } else if (data.message) {
        console.log(`[MSG] ${data.message}`);
    } else {
        console.log('[DATA]', data);
    }
});

// Serve index.html for any other requests (SPA support)
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, '../client/dist/index.html'));
});

async function main() {
    try {
        await kiln.connect();
        
        // Start Web Server
        app.listen(config.serverPort, () => {
            console.log(`Web API running on http://localhost:${config.serverPort}`);
        });

        // Initial status check
        console.log('Requesting initial status...');
        // setInterval(() => {
        //     kiln.getStatus();
        // }, config.statusInterval);

        // setup signal handlers for graceful shutdown
        const shutdown = () => {
            console.log('\nService stopping. Turning off kiln...');
            kiln.stop();
            setTimeout(() => {
                if (kiln.port && kiln.port.isOpen) {
                    kiln.port.close();
                }
                process.exit(0);
            }, 500);
        };

        process.on('SIGINT', shutdown);
        process.on('SIGTERM', shutdown);

    } catch (error) {
        console.error('ERROR: Failed to connect to kiln.');
        console.error(`Attempted port: ${config.serialPort}`);
        console.error('Details:', error.message);
        console.log('\nHint: Check if the Arduino is connected and the port is correct in config.js');
        process.exit(1);
    }
}

main();
