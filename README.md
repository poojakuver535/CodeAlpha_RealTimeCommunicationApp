# CodeAlpha - Real-Time Communication App

Video conferencing + collaboration tool built for the CodeAlpha Full Stack Internship.

## Features
- Multi-user video calling (WebRTC mesh)
- Screen sharing
- File sharing (up to 50MB per file)
- Collaborative whiteboard (drawing in real time)
- In-room chat
- User authentication (register/login)
- Session-secured signaling (socket.io)

## Tech Stack
- Backend: Node.js + Express + socket.io
- Signaling: WebRTC via socket.io
- STUN server: Google public (`stun:stun.l.google.com:19302`)
- Database: SQLite (better-sqlite3) for users
- Views: EJS

## Run
```bash
npm install
npm start
```
Open http://localhost:3003 in two browser tabs/windows, register two users, log in to each, and join the same room.

## Browser Requirement
Camera/microphone access requires `localhost` or HTTPS. Chrome/Firefox/Edge work.

## Security Notes
- Passwords hashed with bcryptjs
- Sessions managed server-side
- Signaling tied to authenticated sessions
- WebRTC traffic is encrypted end-to-end by browsers (DTLS-SRTP)

## Author
Built for CodeAlpha Internship.
