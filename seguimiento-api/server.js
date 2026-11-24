const http = require('http');
const server = http.createServer((req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Content-Type', 'application/json');
  if (req.url === '/devices') {
    res.end(JSON.stringify([
      { id: '1', nombre: 'PC Oficina Principal', tipo: 'Computador', estado: 'online', ip: '192.168.1.50' },
      { id: '2', nombre: 'Cámara Bodega Central', tipo: 'Cámara IP', estado: 'online', ip: '192.168.1.101' },
      { id: '3', nombre: 'Cámara Acceso Perimetral', tipo: 'Cámara IP', estado: 'offline', ip: '192.168.1.102' }
    ]));
  } else {
    res.end(JSON.stringify({ mensaje: 'API de seguimiento funcionando correctamente' }));
  }
});
server.listen(3001, '127.0.0.1', () => {
  console.log('Servidor backend corriendo en http://127.0.0.1:3001');
});
