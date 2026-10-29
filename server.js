// CodeAlpha - Real-Time Communication App
// Video conferencing (WebRTC), screen sharing, file sharing, whiteboard, chat
// User auth via sessions

const express = require('express');
const http = require('http');
const session = require('express-session');
const bodyParser = require('body-parser');
const bcrypt = require('bcryptjs');
const Database = require('better-sqlite3');
const path = require('path');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server, { maxHttpBufferSize: 1e8 }); // 100MB for file sharing
const PORT = process.env.PORT || 3003;

const db = new Database('rtc.db');
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    email TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL
  );
`);

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

const sessionMiddleware = session({
  secret: 'codealpha-rtc-secret',
  resave: false,
  saveUninitialized: true
});
app.use(sessionMiddleware);
io.engine.use(sessionMiddleware);

app.use((req, res, next) => {
  res.locals.user = req.session.user || null;
  next();
});

function requireLogin(req, res, next) {
  if (!req.session.user) return res.redirect('/login');
  next();
}

// Auth
app.get('/register', (req, res) => res.render('register', { error: null }));
app.post('/register', (req, res) => {
  try {
    const hash = bcrypt.hashSync(req.body.password, 10);
    db.prepare('INSERT INTO users (username, email, password) VALUES (?,?,?)').run(req.body.username, req.body.email, hash);
    res.redirect('/login');
  } catch { res.render('register', { error: 'Already exists.' }); }
});
app.get('/login', (req, res) => res.render('login', { error: null }));
app.post('/login', (req, res) => {
  const u = db.prepare('SELECT * FROM users WHERE email=?').get(req.body.email);
  if (!u || !bcrypt.compareSync(req.body.password, u.password)) return res.render('login', { error: 'Invalid' });
  req.session.user = { id: u.id, username: u.username };
  res.redirect('/');
});
app.get('/logout', (req, res) => req.session.destroy(() => res.redirect('/')));

app.get('/', requireLogin, (req, res) => res.render('home'));

app.get('/room/:id', requireLogin, (req, res) => {
  res.render('room', { roomId: req.params.id });
});

// Signaling for WebRTC + whiteboard + chat + file sharing
io.on('connection', (socket) => {
  const user = socket.request.session?.user;
  if (!user) { socket.disconnect(); return; }

  socket.on('join-room', (roomId) => {
    socket.join(roomId);
    socket.data.roomId = roomId;
    socket.data.username = user.username;
    socket.to(roomId).emit('user-joined', { socketId: socket.id, username: user.username });

    // Send existing participants to new user
    const sockets = Array.from(io.sockets.adapter.rooms.get(roomId) || []);
    const peers = sockets.filter(s => s !== socket.id).map(s => {
      const sock = io.sockets.sockets.get(s);
      return { socketId: s, username: sock?.data?.username };
    });
    socket.emit('existing-users', peers);
  });

  // WebRTC signaling
  socket.on('offer', ({ target, sdp }) => io.to(target).emit('offer', { from: socket.id, username: user.username, sdp }));
  socket.on('answer', ({ target, sdp }) => io.to(target).emit('answer', { from: socket.id, sdp }));
  socket.on('ice-candidate', ({ target, candidate }) => io.to(target).emit('ice-candidate', { from: socket.id, candidate }));

  // Chat
  socket.on('chat-message', (msg) => {
    io.to(socket.data.roomId).emit('chat-message', { username: user.username, text: msg, time: new Date().toLocaleTimeString() });
  });

  // Whiteboard
  socket.on('draw', (data) => socket.to(socket.data.roomId).emit('draw', data));
  socket.on('clear-board', () => socket.to(socket.data.roomId).emit('clear-board'));

  // File sharing
  socket.on('share-file', (data) => {
    io.to(socket.data.roomId).emit('file-received', { ...data, username: user.username });
  });

  socket.on('disconnect', () => {
    if (socket.data.roomId) {
      socket.to(socket.data.roomId).emit('user-left', { socketId: socket.id, username: user.username });
    }
  });
});

server.listen(PORT, () => console.log(`RTC app running on http://localhost:${PORT}`));
