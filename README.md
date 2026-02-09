# kalze-ws

Official WebSocket client for [websocket.cl](https://websocket.cl) - Real-time connections made easy.

## Installation

```bash
npm install kalze-ws
```

## Quick Start

```typescript
import Kalze from 'kalze-ws'

// Initialize client with your credentials
const kalze = new Kalze({
  key: 'wpk_live_your_public_key',
  subdomain: 'your-subdomain',
})

// Subscribe to a channel
const channel = kalze.subscribe('my-channel')

// Listen for events
channel.on('connected', (data) => {
  console.log('Connected!', data.socketId)
})

channel.on('my-event', (data) => {
  console.log('Received:', data)
})

// Handle disconnection
channel.on('disconnected', ({ code, reason }) => {
  console.log('Disconnected:', code, reason)
})
```

## Configuration Options

```typescript
const kalze = new Kalze({
  // Required
  key: 'wpk_live_...',           // Your public API key
  subdomain: 'your-subdomain',   // Your subdomain

  // Optional
  wsUrl: 'wss://ws.websocket.cl', // WebSocket server URL
  autoReconnect: true,            // Auto reconnect on disconnect
  maxReconnectAttempts: 10,       // Max reconnect attempts
  reconnectDelay: 1000,           // Base delay between reconnects (ms)
  debug: false,                   // Enable debug logging
  connectionTimeoutMs: 10000,     // Handshake timeout
  maxQueuedMessages: 100,         // Queue while connecting
})
```

## Channel API

### Subscribing to Events

```typescript
const channel = kalze.subscribe('notifications')

// Subscribe to a specific event
channel.on('new-notification', (data) => {
  console.log('New notification:', data)
})

// Subscribe to all events (wildcard)
channel.on('*', ({ event, data }) => {
  console.log(`Event: ${event}`, data)
})

// Subscribe once
channel.once('welcome', (data) => {
  console.log('Welcome message:', data)
})
```

### Unsubscribing

```typescript
// Unsubscribe specific callback
const unsubscribe = channel.on('event', callback)
unsubscribe() // or channel.off('event', callback)

// Unsubscribe all listeners for an event
channel.off('event')

// Disconnect from channel
channel.disconnect()
```

### Client Events

Send events to other clients on the same channel:

```typescript
channel.trigger('cursor-move', {
  type: 'cursor-move',
  x: 100,
  y: 200
})

// Legacy signature is also supported:
channel.trigger({ any: 'payload' })
```

### Connection State

```typescript
// Check if connected
if (channel.isConnected()) {
  // ...
}

// Get socket ID
const socketId = channel.getSocketId()

// Get connection state
const state = channel.getState() // 'connecting' | 'connected' | 'disconnected' | 'reconnecting'

// Listen for state changes
channel.on('state:change', ({ state }) => {
  console.log('State:', state)
})
```

### System Events

```typescript
// Connection established
channel.on('connected', ({ socketId, channel, subdomain }) => {})

// Disconnected
channel.on('disconnected', ({ code, reason }) => {})

// Reconnecting
channel.on('reconnecting', ({ attempt, delay }) => {})

// Reconnection failed
channel.on('reconnect:failed', ({ attempts }) => {})

// Error (includes error code when applicable)
channel.on('error', ({ code, message }) => {
  console.error(code, message)
})
```

## Production Notes

```typescript
// Wait for connection before critical operations
channel.on('connected', () => {
  channel.trigger('app:ready', { ts: Date.now() })
})

// Observe reconnect loop
channel.on('reconnecting', ({ attempt, delay }) => {
  console.log(`Reconnect #${attempt} in ${delay}ms`)
})

// Handle auth/limit errors
channel.on('error', ({ code, message }) => {
  if (code === 4403 || code === 4401 || code === 4408) {
    console.error('Fatal connection error:', message)
  }
})
```

## Multiple Channels

```typescript
const chat = kalze.subscribe('chat')
const notifications = kalze.subscribe('notifications')
const presence = kalze.subscribe('presence')

// Get all channels
const channels = kalze.getChannels() // ['chat', 'notifications', 'presence']

// Get specific channel
const chatChannel = kalze.getChannel('chat')

// Unsubscribe from a channel
kalze.unsubscribe('notifications')

// Disconnect from all channels
kalze.disconnectAll()
```

## TypeScript

Full TypeScript support with type definitions:

```typescript
import Kalze, { KalzeOptions, ConnectionState } from 'kalze-ws'

interface NotificationData {
  id: string
  message: string
  createdAt: string
}

const channel = kalze.subscribe('notifications')

channel.on<NotificationData>('new-notification', (data) => {
  // data is typed as NotificationData
  console.log(data.message)
})
```

## Server-Side Integration

To send messages from your server, use the Kalze User API:

```typescript
// Server-side (Node.js)
const response = await fetch('https://api.websocket.cl/broadcast/my-channel', {
  method: 'POST',
  headers: {
    'Authorization': 'Bearer wsk_live_your_secret_key',
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    event: 'new-notification',
    data: {
      id: '123',
      message: 'Hello World!',
      createdAt: new Date().toISOString(),
    }
  })
})
```

## License

MIT © [Kalze SpA](https://kalze.z8.cl)
