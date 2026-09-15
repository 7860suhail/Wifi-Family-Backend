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

const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, 'uploads/');
    },
    filename: (req, file, cb) => {
        cb(null, Date.now() + '-' + file.originalname);
    }
});
const upload = multer({ storage: storage });

let users = [];

const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: 'apka.email@gmail.com',
        pass: 'apka_gmail_app_password'
    }
});

app.post('/api/register', (req, res) => {
    const { name, email, password } = req.body;
    if (!email || !password) {
        return res.status(400).json({ success: false, message: 'Email aur password zaroori hain!' });
    }
    const existingUser = users.find(u => u.email === email);
    if (existingUser) {
        return res.status(400).json({ success: false, message: 'Yeh email pehle se registered hai!' });
    }
    users.push({ name, email, password, resetToken: null, resetExpires: null });
    res.json({ success: true, message: 'Account successfully registered!' });
});

app.post('/api/login', (req, res) => {
    const { email, password } = req.body;
    const user = users.find(u => u.email === email && u.password === password);
    if (!user) {
        return res.status(401).json({ success: false, message: 'Galat Email ya Password hai!' });
    }
    res.json({ success: true, name: user.name, email: user.email });
});

app.post('/api/forgot-password', (req, res) => {
    const { email } = req.body;
    const user = users.find(u => u.email === email);
    if (!user) {
        return res.status(404).json({ success: false, message: 'Yeh email registered nahi hai!' });
    }

    const token = crypto.randomBytes(20).toString('hex');
    user.resetToken = token;
    user.resetExpires = Date.now() + 3600000;

    const resetLink = `https://7860monitor.netlify.app/?token=${token}`;

    const mailOptions = {
        from: 'apka.email@gmail.com',
        to: email,
        subject: 'Password Reset Link - Device Control Panel',
        text: `Hello ${user.name},\n\nAapne password reset karne ki request ki hai. Niche diye gaye link par click karke apna naya password set karein:\n\n${resetLink}\n\nYeh link 1 ghante mein expire ho jayega.`
    };

    transporter.sendMail(mailOptions, (error, info) => {
        if (error) {
            return res.status(500).json({ success: false, message: 'Email bhejne mein error aayi: ' + error.message });
        }
        res.json({ success: true, message: 'Password reset link aapke email par bhej diya gaya hai!' });
    });
});

app.post('/api/reset-password', (req, res) => {
    const { token, newPassword } = req.body;
    const user = users.find(u => u.resetToken === token && u.resetExpires > Date.now());

    if (!user) {
        return res.status(400).json({ success: false, message: 'Invalid ya expired reset link hai!' });
    }

    user.password = newPassword;
    user.resetToken = null;
    user.resetExpires = null;

    res.json({ success: true, message: 'Password successfully update ho gaya! Ab aap login kar sakte hain.' });
});

app.post('/api/upload-picture', upload.single('image'), (req, res) => {
    if (!req.file) {
        return res.status(400).json({ success: false, message: 'Koi picture receive nahi hui!' });
    }
    res.json({ success: true, message: 'Picture uploaded successfully!' });
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
