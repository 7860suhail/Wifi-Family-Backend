import express from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import Database from 'better-sqlite3';
import crypto from 'crypto';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = Number(process.env.PORT || 3000);
const JWT_SECRET = process.env.JWT_SECRET || 'CHANGE_THIS_TO_A_LONG_RANDOM_SECRET';
if (JWT_SECRET.length < 32) console.warn('WARNING: set JWT_SECRET to a random 32+ character value in production.');

app.use(express.json({limit:'1mb'}));
app.use(express.urlencoded({extended:true, limit:'1mb'}));
app.use(express.static(path.join(__dirname,'public')));

const db = new Database(path.join(__dirname,'data.db'));
db.pragma('foreign_keys = ON');
db.exec(`
CREATE TABLE IF NOT EXISTS users (
 id INTEGER PRIMARY KEY AUTOINCREMENT,
 name TEXT NOT NULL,
 email TEXT NOT NULL UNIQUE,
 password_hash TEXT NOT NULL,
 created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS devices (
 id INTEGER PRIMARY KEY AUTOINCREMENT,
 user_id INTEGER NOT NULL,
 device_name TEXT NOT NULL,
 device_token_hash TEXT NOT NULL UNIQUE,
 consent_at TEXT NOT NULL,
 last_seen TEXT,
 created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
 FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
);
CREATE TABLE IF NOT EXISTS consent_log (
 id INTEGER PRIMARY KEY AUTOINCREMENT,
 device_id INTEGER NOT NULL,
 user_id INTEGER NOT NULL,
 action TEXT NOT NULL,
 created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
 FOREIGN KEY(device_id) REFERENCES devices(id) ON DELETE CASCADE,
 FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
);
`);

const hash = v => crypto.createHash('sha256').update(v).digest('hex');
const emailOk = v => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
const now = () => new Date().toISOString();

function sign(payload, expires='7d') { return jwt.sign(payload, JWT_SECRET, {expiresIn:expires}); }
function auth(req,res,next){
  const h=req.headers.authorization||'';
  if(!h.startsWith('Bearer ')) return res.status(401).json({ok:false,error:'Missing bearer token'});
  try { req.auth=jwt.verify(h.slice(7),JWT_SECRET); next(); }
  catch { return res.status(401).json({ok:false,error:'Invalid or expired token'}); }
}
function userOnly(req,res,next){
  if(req.auth?.type!=='user') return res.status(403).json({ok:false,error:'User token required'});
  next();
}
function deviceOnly(req,res,next){
  if(req.auth?.type!=='device') return res.status(403).json({ok:false,error:'Device token required'});
  next();
}

app.get('/api/health',(req,res)=>res.json({ok:true,service:'wifi-family-device-backend',time:now()}));

app.post('/api/auth/register', async (req,res)=>{
  try{
    const name=String(req.body.name||'').trim();
    const email=String(req.body.email||'').trim().toLowerCase();
    const password=String(req.body.password||'');
    if(name.length<2) return res.status(400).json({ok:false,error:'Name is required'});
    if(!emailOk(email)) return res.status(400).json({ok:false,error:'Valid email is required'});
    if(password.length<8) return res.status(400).json({ok:false,error:'Password must be at least 8 characters'});
    const existing=db.prepare('SELECT id FROM users WHERE email=?').get(email);
    if(existing) return res.status(409).json({ok:false,error:'Email already registered'});
    const passwordHash=await bcrypt.hash(password,12);
    const info=db.prepare('INSERT INTO users(name,email,password_hash) VALUES(?,?,?)').run(name,email,passwordHash);
    const token=sign({type:'user',userId:Number(info.lastInsertRowid)});
    res.json({ok:true,token,user:{id:Number(info.lastInsertRowid),name,email}});
  }catch(e){ console.error(e); res.status(500).json({ok:false,error:'Registration failed'}); }
});

app.post('/api/auth/login', async (req,res)=>{
  try{
    const email=String(req.body.email||'').trim().toLowerCase();
    const password=String(req.body.password||'');
    const user=db.prepare('SELECT * FROM users WHERE email=?').get(email);
    if(!user || !(await bcrypt.compare(password,user.password_hash))) return res.status(401).json({ok:false,error:'Invalid email or password'});
    const token=sign({type:'user',userId:user.id});
    res.json({ok:true,token,user:{id:user.id,name:user.name,email:user.email}});
  }catch(e){ console.error(e); res.status(500).json({ok:false,error:'Login failed'}); }
});

app.get('/api/me',auth,userOnly,(req,res)=>{
  const u=db.prepare('SELECT id,name,email,created_at FROM users WHERE id=?').get(req.auth.userId);
  if(!u) return res.status(404).json({ok:false,error:'User not found'});
  res.json({ok:true,user:u});
});

app.post('/api/devices',auth,userOnly,(req,res)=>{
  const deviceName=String(req.body.deviceName||'').trim().slice(0,100);
  const consent=req.body.consent===true;
  if(deviceName.length<1) return res.status(400).json({ok:false,error:'Device name is required'});
  if(!consent) return res.status(400).json({ok:false,error:'Explicit device consent is required'});
  const raw=crypto.randomBytes(32).toString('base64url');
  const info=db.prepare('INSERT INTO devices(user_id,device_name,device_token_hash,consent_at,last_seen) VALUES(?,?,?,?,?)').run(req.auth.userId,deviceName,hash(raw),now(),now());
  db.prepare('INSERT INTO consent_log(device_id,user_id,action) VALUES(?,?,?)').run(info.lastInsertRowid,req.auth.userId,'device_registered_with_consent');
  res.json({ok:true,device:{id:Number(info.lastInsertRowid),deviceName,consentAt:now()},deviceToken:raw,note:'Store this token securely; it is shown only once.'});
});

app.get('/api/devices',auth,userOnly,(req,res)=>{
  const rows=db.prepare('SELECT id,device_name AS deviceName,consent_at AS consentAt,last_seen AS lastSeen,created_at AS createdAt FROM devices WHERE user_id=? ORDER BY id DESC').all(req.auth.userId);
  res.json({ok:true,devices:rows});
});

app.post('/api/devices/:id/revoke',auth,userOnly,(req,res)=>{
  const id=Number(req.params.id);
  const d=db.prepare('SELECT id FROM devices WHERE id=? AND user_id=?').get(id,req.auth.userId);
  if(!d) return res.status(404).json({ok:false,error:'Device not found'});
  db.prepare('DELETE FROM devices WHERE id=?').run(id);
  res.json({ok:true});
});

app.post('/api/device/auth', (req,res)=>{
  const token=String(req.body.deviceToken||'');
  if(!token) return res.status(400).json({ok:false,error:'deviceToken required'});
  const d=db.prepare('SELECT id,user_id,device_name FROM devices WHERE device_token_hash=?').get(hash(token));
  if(!d) return res.status(401).json({ok:false,error:'Unknown or revoked device token'});
  db.prepare('UPDATE devices SET last_seen=? WHERE id=?').run(now(),d.id);
  const jwtToken=sign({type:'device',deviceId:d.id,userId:d.user_id},'30d');
  res.json({ok:true,token:jwtToken,device:{id:d.id,name:d.device_name}});
});

app.post('/api/device/heartbeat',auth,deviceOnly,(req,res)=>{
  const d=db.prepare('SELECT id,user_id FROM devices WHERE id=? AND user_id=?').get(req.auth.deviceId,req.auth.userId);
  if(!d) return res.status(401).json({ok:false,error:'Device revoked'});
  db.prepare('UPDATE devices SET last_seen=? WHERE id=?').run(now(),d.id);
  res.json({ok:true,time:now()});
});

app.get('/api/device/profile',auth,deviceOnly,(req,res)=>{
  const d=db.prepare('SELECT id,device_name AS deviceName,consent_at AS consentAt,last_seen AS lastSeen FROM devices WHERE id=? AND user_id=?').get(req.auth.deviceId,req.auth.userId);
  if(!d) return res.status(404).json({ok:false,error:'Device not found'});
  res.json({ok:true,device:d});
});

app.get('/api/consent-log',auth,userOnly,(req,res)=>{
  const rows=db.prepare('SELECT c.id,c.device_id AS deviceId,c.action,c.created_at AS createdAt,d.device_name AS deviceName FROM consent_log c JOIN devices d ON d.id=c.device_id WHERE c.user_id=? ORDER BY c.id DESC LIMIT 200').all(req.auth.userId);
  res.json({ok:true,items:rows});
});

app.use((req,res)=>{
  if(req.path.startsWith('/api/')) return res.status(404).json({ok:false,error:'API route not found'});
  res.sendFile(path.join(__dirname,'public','index.html'));
});

app.listen(PORT,()=>console.log(`Server running on http://localhost:${PORT}`));
