const express = require('express');
const app = express();
const server = require('http').createServer(app);
const io = new require('socket.io')(server);
const morgan = require('morgan');
const axios = require('axios');
const bodyParser = require('body-parser');
const servers = new Map();

let id = 9;
let idLeader = 9;
let status = 'ok';
let isParticipant = true;
let isCoor = true;

//Inicialización del servidor
servers.set(5, "http://localhost:3001");
servers.set(8, "http://localhost:3002");
app.use(morgan('short'));
app.use(bodyParser.json());
app.set('view engine', 'ejs');
server.listen(3000, function () {
    console.log('Listening port 3000');
});
//El servidor responde la petición con el index.ejs, su id y el id del líder
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
    axios.post(servers.get(idLeader)+'/check')
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

//Método encargado de enviar un mensaje al cliente a través de sockets
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
