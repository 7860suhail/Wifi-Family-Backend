const express = require('express');
const fs = require('fs');
const path = require('path');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3000;
const API_KEY = 'monitor-family-secret-7860';
const DATA_FILE = path.join(__dirname, 'devices.json');

// Middleware
app.use(express.json());
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

// API 1: Android app yahan data bhejegi
app.post('/api/sync', (req, res) => {
    const apiKey = req.headers['x-api-key'];
    if (apiKey !== API_KEY) {
        return res.status(401).json({ error: 'Invalid API Key' });
    }

    const { deviceId, deviceName, callLogs, location, syncedAt } = req.body;
    if (!deviceId) return res.status(400).json({ error: 'deviceId required' });

    const devices = getDevices();
    
    if (!devices[deviceId]) {
        devices[deviceId] = { 
            name: deviceName || 'Unknown', 
            callLogs: [], 
            locations: [], 
            lastSync: null 
        };
    }

    if (callLogs && Array.isArray(callLogs) && callLogs.length > 0) {
        devices[deviceId].callLogs = [...devices[deviceId].callLogs, ...callLogs];
    }
    
    if (location) {
        devices[deviceId].locations.push({ ...location, syncedAt });
    }
    
    devices[deviceId].lastSync = syncedAt || Date.now();
    saveDevices(devices);
    
    console.log(`Sync received from ${deviceName} (${deviceId})`);
    res.json({ success: true, message: 'Data saved' });
});

// API 2: Dashboard (Website) yahan se data mangega
app.get('/api/devices', (req, res) => {
    res.json(getDevices());
});

// Basic route
app.get('/', (req, res) => {
    res.send('MonitorFamily Backend is running!');
});

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
