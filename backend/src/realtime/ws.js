import { WebSocketServer } from 'ws';

let wss = null;

export const initWebSocket = (server) => {
  wss = new WebSocketServer({ server, path: '/ws' });

  wss.on('connection', (ws) => {
    console.log('WebSocket client connected');

    ws.on('message', (message) => {
      console.log('Received:', message.toString());
    });

    ws.on('close', () => {
      console.log('WebSocket client disconnected');
    });

    ws.send(JSON.stringify({
      type: 'connected',
      payload: { message: 'Connected to attendance system' }
    }));
  });

  return wss;
};

export const broadcast = (data) => {
  if (!wss) {
    console.log('WebSocket server not initialized, cannot broadcast');
    return;
  }

  const message = JSON.stringify(data);
  const clientCount = wss.clients.size;
  const readyClients = Array.from(wss.clients).filter(client => client.readyState === 1).length;

  console.log('=== Broadcasting WebSocket message ===');
  console.log('Message type:', data.type);
  console.log('Total clients:', clientCount);
  console.log('Ready clients:', readyClients);
  console.log('Message data:', JSON.stringify(data, null, 2));

  let sentCount = 0;
  wss.clients.forEach((client) => {
    if (client.readyState === 1) {
      try {
        client.send(message);
        sentCount++;
        console.log(`Message sent to client ${sentCount}`);
      } catch (error) {
        console.error('Error sending message to client:', error);
      }
    } else {
      console.log('Client not ready, state:', client.readyState);
    }
  });

  console.log(`Broadcast complete: ${sentCount} client(s) received the message`);
};
