const express = require('express');
const fs = require('fs');
const path = require('path');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3000;
const API_KEY = 'monitor-family-secret-7860'; // Ye wahi key hai jo Android app mein hai
const DATA_FILE = path.join(__dirname, 'devices.json');

// Middleware
app.use(express.json());
app.use(cors()); // Zaroori hai taaki Netlify website is backend se baat kar sake

// Helper functions: Data ko file mein save/read karne ke liye
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

// 1. API: Android app yahan data bhejegi
app.post('/api/sync', (req, res) => {
    const apiKey = req.headers['x-api-key'];
    if (apiKey !== API_KEY) {
        return res.status(401).json({ error: 'Invalid API Key' });
    }

    const { deviceId, deviceName, callLogs, location, syncedAt } = req.body;
    if (!deviceId) return res.status(400).json({ error: 'deviceId required' });

    const devices = getDevices();
    
    // Agar device pehli baar sync kar raha hai
    if (!devices[deviceId]) {
        devices[deviceId] = { name: deviceName || 'Unknown', callLogs: [], locations: [], lastSync: null };
    }

    // Naye call logs add karein
    if (callLogs && Array.isArray(callLogs) && callLogs.length > 0) {
        devices[deviceId].callLogs = [...devices[deviceId].callLogs, ...callLogs];
    }
    
    // Nayi location add karein
    if (location) {
        devices[deviceId].locations.push({ ...location, syncedAt });
    }
    
    devices[deviceId].lastSync = syncedAt || Date.now();
    saveDevices(devices);
    
    console.log(`Sync received from ${deviceName} (${deviceId})`);
    res.json({ success: true, message: 'Data saved' });
});

// 2. API: Dashboard (Website) yahan se data mangega
app.get('/api/devices', (req, res) => {
    // Aap chahein toh yahan bhi API key check kar sakte hain
    res.json(getDevices());
});

// Basic route
app.get('/', (req, res) => {
    res.send('MonitorFamily Backend is running!');
});

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
