let socket = io();
socket.on('status', (message) => {
    document.getElementById('status').innerHTML = message;
    console.log(status);
});
