const express = require('express');
const cors = require('cors');
const nodemailer = require('nodemailer');
const crypto = require('crypto');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cors());

const uploadDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadDir)){
    fs.mkdirSync(uploadDir);
}
app.use('/uploads', express.static(uploadDir));

const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, 'uploads/'),
    filename: (req, file, cb) => cb(null, Date.now() + '-' + file.originalname)
});
const upload = multer({ storage: storage });

let users = [];
let deviceStatus = {
    battery: "50%",
    charging: "Not Charging",
    health: "Good",
    temperature: "28°C",
    location: "28.6139, 77.2090",
    deviceModel: "Android Device",
    simOperator: "Jio / Airtel",
    phoneNumber: "+91 9876543210",
    networkType: "Wi-Fi",
    ringerMode: "Ringing"
};

const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: 'apka.email@gmail.com',
        pass: 'apka_gmail_app_password'
    }
});

app.post('/api/register', (req, res) => {
    const { name, email, password } = req.body;
    if (!email || !password) return res.status(400).json({ success: false, message: 'Email aur password zaroori hain!' });
    if (users.find(u => u.email === email)) return res.status(400).json({ success: false, message: 'Email pehle se registered hai!' });
    users.push({ name, email, password, resetToken: null, resetExpires: null });
    res.json({ success: true, message: 'Account registered successfully!' });
});

app.post('/api/login', (req, res) => {
    const { email, password } = req.body;
    const user = users.find(u => u.email === email && u.password === password);
    if (!user) return res.status(401).json({ success: false, message: 'Galat Email ya Password!' });
    res.json({ success: true, name: user.name, email: user.email });
});

app.post('/api/forgot-password', (req, res) => {
    const { email } = req.body;
    const user = users.find(u => u.email === email);
    if (!user) return res.status(404).json({ success: false, message: 'Email registered nahi hai!' });

    const token = crypto.randomBytes(20).toString('hex');
    user.resetToken = token;
    user.resetExpires = Date.now() + 3600000;
    const resetLink = `https://7860monitor.netlify.app/?token=${token}`;

    transporter.sendMail({
        from: 'apka.email@gmail.com',
        to: email,
        subject: 'Password Reset Link',
        text: `Reset link: ${resetLink}`
    }, (err) => {
        if (err) return res.status(500).json({ success: false, message: 'Email error: ' + err.message });
        res.json({ success: true, message: 'Reset link email par bhej diya gaya hai!' });
    });
});

app.post('/api/reset-password', (req, res) => {
    const { token, newPassword } = req.body;
    const user = users.find(u => u.resetToken === token && u.resetExpires > Date.now());
    if (!user) return res.status(400).json({ success: false, message: 'Invalid ya expired link!' });
    user.password = newPassword;
    user.resetToken = null;
    user.resetExpires = null;
    res.json({ success: true, message: 'Password update ho gaya!' });
});

app.post('/api/upload-picture', upload.single('image'), (req, res) => {
    if (!req.file) return res.status(400).json({ success: false, message: 'No file' });
    res.json({ success: true, message: 'Uploaded' });
});

app.get('/api/pictures', (req, res) => {
    fs.readdir(uploadDir, (err, files) => {
        if (err) return res.json({ success: false, pictures: [] });
        const list = files.map(f => ({ filename: f, url: `https://wifi-family-backend.onrender.com/uploads/${f}` }));
        res.json({ success: true, pictures: list });
    });
});

app.post('/api/update-status', (req, res) => {
    const data = req.body;
    Object.assign(deviceStatus, data);
    res.json({ success: true });
});

app.get('/api/device-status', (req, res) => {
    res.json({ success: true, ...deviceStatus });
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
