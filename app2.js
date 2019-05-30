const express = require('express');
const app = express();
const server = require('http').createServer(app);
const io = new require('socket.io')(server);
const morgan = require('morgan');
const axios = require('axios');
const bodyParser = require('body-parser');
const servers = new Map();

let id = 5;
let idLeader = 9;
let status = 'ok';
let isParticipant = true;
let isCoor = false;

servers.set(9, "http://localhost:3000");
servers.set(8, "http://localhost:3001");
app.use(morgan('short'));
app.use(bodyParser.json());
app.set('view engine', 'ejs');
server.listen(3002, function () {
    console.log('Listening port 3002')
});

app.get('/', function (req, res) {
    res.render('index',
        {id,
        idLeader
        });
});

app.post('/check', (req, res) => {
    sendMessage(`Respondiendo chequeo - solicitud enviada por ${req.body.id}`);
    res.send({serverStatus: status});
});

function checkLeader() {
    axios.post(servers.get(idLeader)+'/check', {id})
        .then( res => {
            if (res.data.serverStatus === 'ok'){
                sendMessage(`Chequeo al servidor ${idLeader}: ${res.data.serverStatus}`);
                setTimeout(checkLeader, 10000);
            }else {
                sendMessage(`El servidor ${idLeader} responde: ${res.data.serverStatus} ....
                    Empezando proceso de elección...`);
            }
        })
        .catch(error => {
            sendMessage(`Error en el chequeo: ${error}`);
        })
}

function sendMessage(message) {
    io.emit('status', message);
    console.log(`Mensaje enviado - ${message}`);
}

io.on('connection', function(socket){
    console.log('Se conectó alguien');
    socket.on('giveup', function (message) {
        status = 'fail';
        isParticipant = false;
        isCoor = false;
        sendMessage(`${message} a ser líder`);
    });
});

setTimeout(checkLeader, 5000);

