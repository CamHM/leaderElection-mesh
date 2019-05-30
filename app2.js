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
    res.render('index', {id, idLeader }); //El servidor responde la petición con el index.ejs, su id y el id del líder
});

app.post('/check', (req, res) => {  //Recibe petición para determinar estado
    sendMessage(`Respondiendo chequeo - solicitud enviada por ${req.body.id}`);
    res.send({serverStatus: status});   //El servidor responde con su status actual
});

app.post('/isCoor', (req, res) => {     //Petición para saber si el servidor es coordinador de elección
    sendMessage(`Llega pregunta de si soy coordinador: ${isCoor} - Pregunta realizada por ${req.body.id}`);
    res.send({isCoor});
});

app.post('/election', (req, res) => {       //Petición de proceso de elcción
    if (!isParticipant) {
        sendMessage(`El servidor ${req.body.id} ha enviado petición de elección - Respuesta: No`);
        res.send({accept: 'no'});   //Si no está participando rechaza la solicitud de elección
    } else {
        sendMessage(`El servidor ${req.body.id} ha enviado petición de elección - Respuesta: ok`);
        res.send({accept: 'ok'});   //Si está participando acepta la solicitud de elección
    }
});

app.post('/beCoor', (req, res) => {     //Petición al servidor para que sea el nuevo coordinador de elección
    startElection();     //Al ser el nuevo coordinador inicia nuevamente el proceso de elección con los servidores mayores a él
    sendMessage(`El servidor ${req.body.id} me cedió el puesto de coordinador`);
    res.send('ok');
});

app.post('/newLeader', (req, res) => {      //Recepción del id del nuevo líder (Resultado de elección)
    idLeader = req.body.idLeader;
    res.send('ok');
    io.emit('newLeader', idLeader);     //Le dice al index.ejs que actualice su información del id del líder
    checkLeader();
});

function checkLeader() {        //Chequeo de salud del líder
    if(id !== idLeader){
        axios.post(servers.get(idLeader)+'/check', {id})
            .then( res => {
                if (res.data.serverStatus === 'ok'){
                    sendMessage(`Chequeo al servidor ${idLeader}: ${res.data.serverStatus}`);
                    setTimeout(checkLeader, 5000); //Si el líder responde 'ok' volverá a chequearlo en 10 segundos
                }else {
                    sendMessage(`El servidor ${idLeader} responde: ${res.data.serverStatus} ....
                    Empezando proceso de selección de coordinador...`);
                    askCoor();      //Si la respuesta del líder es negativa, el servidor pregunta a los demás servidores de la red si alguno es coordinador
                }
            })
            .catch(error => {
                sendMessage(`Error en el chequeo: ${error}`); //En caso de ocurrir algún error, este se reporta en el indec.ejs
            })
    }
}

function askCoor() {        //Preguntar si algún servidor ya es coordinador de elección
    servers.forEach((value, key) => {
        axios.post(value+'/isCoor', {id})   //Pregunta a cada servidor que tiene enlazado si ya es coordinador
            .then(res => {
                console.log(res.data);
                if (res.data.isCoor === 'true') {      //Si ya hay alguien..
                    sendMessage(`El coordinador ya es ${key}`);     //notifica en el index..
                    return true;        // Deja de preguntar y sale del método
                }else {
                    sendMessage(`El servidor ${key} dice que no es coordinador`);
                }
            })
            .catch(error => {
                sendMessage(`Error al solicitar isCoor: ${error}`);
            });
    });
    startElection();    //En caso de que ninguno responda que es coordinador, el servidor asume esta posición y empieza la elección
}

function startElection() {
    console.log('inicia elección');
    let response = false;  //Alguien ha respondido ok?
    isCoor = true;      //Se vuelve coordinador
    sendMessage(`Ahora soy coordinador`);
    servers.forEach(((value, key) => {
        if (key > id) {                 //Pregunta a los servidores con id mayor al de él si alguno quiere ser líder y participar en la elección
            axios.post(value+'/election', {id})
                .then(res => {
                    if (res.data.accept === 'ok' && !response) {    //Si el servidor acepta y nadie ha aceptado antes, el coordinador actual cede su posición al servidor
                        response = true;
                        isCoor = false;
                        sendMessage(`Dejo de ser coordinador`);
                        axios.post(value+'/beCoor', {id});
                    }
                })
        }
    }));
    setTimeout(() => {      //Si ningún servidor responde después de 15 segundos, el coordinador actual será el nuevo líder
        if (!response) {
            idLeader = id;
            sendMessage('Seré líder');
            io.emit('newLeader', idLeader);
            servers.forEach(((value) => {
                axios.post(value+'/newLeader', {idLeader});  //Se envía actualización de líder a los servidores conectados
            }))
        }
    }, 15000);
}

//Método encargado de enviar un mensaje al cliente a través de sockets
function sendMessage(message) {
    io.emit('status', message);
    console.log(`Mensaje enviado - ${message}`);
}

io.on('connection', function(socket){       //Establecimiento de conección y escucha del socket
    console.log('Se conectó alguien');
    socket.on('giveup', function (message) {    //Al recibir la orden, el servidor renuncia a ser líder
        status = 'fail';
        isParticipant = false;
        isCoor = false;
        sendMessage(`${message} a ser líder`);
    });
});

setTimeout(checkLeader, 5000);

