const express = require('express');
const http = require('http');
const cors = require('cors');
const socketIO = require('socket.io');
const { v4: uuidv4 } = require('uuid');
const MongoClient = require('mongodb').MongoClient;
const webrtc = require('wrtc')
const bodyParser = require('body-parser');
const jwt = require('jsonwebtoken');
const app = express();
const fs = require('fs');
const options = {
    key: fs.readFileSync('./localhost+2-key.pem'),
    cert: fs.readFileSync('./localhost+2.pem'),
    requestCert: false,
    rejectUnauthorized: false,
};
const server = http.createServer(options, app);
const bcrypt = require('bcryptjs')
const io = socketIO(server, {
    cors: ['http://localhost:3000']
});

const mongoURI = "mongodb+srv://mzubairkhanofficial:f1OrndUbAZjTEnGx@streamingcluster.ycaox7x.mongodb.net/";

const client = new MongoClient(mongoURI);
client.connect();

const db = client.db("db");
const collection = db.collection('test');

let senderStream;

app.use(cors())
app.use(express.static('public'));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

let roomParam;
let rooms = [];

io.on('connect', (socket) => {
    socket.on("room creation", (data) => {
        const roomId = uuidv4();
        roomParam = roomId;
        rooms.push({ roomId, senderStream, name: data });
        socket.emit("roomId", roomParam)
    })


   socket.on("Join Room",  (data) => {
        socket.join(data)
   })


    socket.emit("roomId", roomParam)
    socket.emit("room-available", rooms)
    socket.on("stop room", (data) => {

        try {
            const newArray = rooms.filter((obj) => obj.roomId !== data);

            rooms = newArray;

        io.to(data).emit("Room Exited", "Room was stopped")

        socket.leave(data)

        } catch (err) {
            console.log(err)
        }
    })
})

async function enter() {
    let data = {
        email: "muzmmil.khan16@gmail.com",
        password: await bcrypt.hash("12345678", 10)
    }
    await collection.insertOne(data);
}

app.get("/check", (req, res) => {
    res.json({ MessageChannel: "Working"})
})
app.post('/login', async (req, res) => {
    const { email, password } = req.body;

    // Find the user by username in the database
    const user = await collection.findOne({ email });
    // Check if the user exists
    if (!user) {
        return res.status(404).json({ message: 'User not found' });
    }

    // Check if the submitted password matches the stored hashed password
    if (user && (await bcrypt.compare(password, user.password))) {
        // Passwords match; user is authenticated
        const token = jwt.sign({ userId: user._id, email: user.email }, 'streamNow', {
            expiresIn: '1h', // Token expiration time (e.g., 1 hour)
        });
        return res.status(200).json({ token });
    } else {
        // Passwords do not match; authentication failed
        return res.status(401).json({ message: 'Wrong Password' });
    }
});

app.post(`/consumer/:id`, async ({ body, params }, res) => {
    try {
        let id = params.id
        const peer = new webrtc.RTCPeerConnection({
            iceServers: [
                {
                    urls: "stun:stun.stunprotocol.org"
                }
            ]
        });
        const desc = new webrtc.RTCSessionDescription(body.sdp);
        await peer.setRemoteDescription(desc);
        const matchingRoom = rooms.find((room) => room.roomId === id);
        if (matchingRoom) {
            let stream = matchingRoom.senderStream;
            stream.getTracks().forEach(track => peer.addTrack(track, stream));
        } else {
            return res.status(402).send("No Room Found")
        }
        const answer = await peer.createAnswer();
        await peer.setLocalDescription(answer);
        const payload = {
            sdp: peer.localDescription
        }

        res.json(payload);
    } catch (err) {
        return res.status(402).send("No Room Found")
    }
});

app.post(`/broadcast/${roomParam}`, async ({ body }, res) => {
    try {
        const peer = new webrtc.RTCPeerConnection({
            iceServers: [
                {
                    urls: "stun:stun.stunprotocol.org"
                }
            ]
        });
        peer.ontrack = (e) => handleTrackEvent(e, peer);
        const desc = new webrtc.RTCSessionDescription(body.sdp);
        await peer.setRemoteDescription(desc);
        const answer = await peer.createAnswer();
        await peer.setLocalDescription(answer);
        const payload = {
            sdp: peer.localDescription
        }

        res.json(payload);
    } catch (err) {
        return res.status(402).send(err)
    }
});

function handleTrackEvent(e, peer) {
    senderStream = e.streams[0];
};



server.listen(8000, () => console.log("Started"));