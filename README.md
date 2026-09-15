# Family Device Backend

Ready-to-run Node.js backend for account authentication and explicit device authorization.

## Included
- Register / login with bcrypt password hashing
- JWT user sessions
- Device registration with one-time device token
- Device authentication + heartbeat
- Device listing and revocation
- Consent log
- SQLite database
- Simple mobile-friendly dashboard
- Health endpoint

## Run
1. Install Node.js 20+.
2. Copy `.env.example` to `.env` and set a strong `JWT_SECRET` (or export it in the environment).
3. Run `npm install`.
4. Run `npm start`.
5. Put the server behind HTTPS before using it over the internet.

## Render
Create a Node Web Service, connect this folder/repository, build command `npm install`, start command `npm start`. Set `JWT_SECRET` as an environment variable. For production, use persistent storage/database rather than relying on an ephemeral filesystem.

## APK integration
The safe integration point is `/api/device/auth` with the device token, followed by `/api/device/heartbeat` using the returned bearer token. Keep the device token protected and only provision devices with the owner's/authorized user's explicit consent.

This package intentionally does not implement covert collection or remote-control endpoints for SMS, call recordings, microphones, screenshots, contacts, social messages, or similar private content.
