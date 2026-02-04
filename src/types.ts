/**
 * Event callback type
 */
export type EventCallback<T = unknown> = (data: T) => void

/**
 * Connection options
 */
export interface KalzeOptions {
  /**
   * Your public API key (wpk_live_*)
   */
  key: string
  
  /**
   * Your subdomain (e.g., 'rojo-azul-casa-gato')
   */
  subdomain: string
  
  /**
   * WebSocket server URL (default: wss://ws.websocket.cl)
   */
  wsUrl?: string
  
  /**
   * Auto reconnect on disconnect (default: true)
   */
  autoReconnect?: boolean
  
  /**
   * Max reconnect attempts (default: 10)
   */
  maxReconnectAttempts?: number
  
  /**
   * Base delay between reconnect attempts in ms (default: 1000)
   */
  reconnectDelay?: number
  
  /**
   * Enable debug logging (default: false)
   */
  debug?: boolean
}

/**
 * Connection state
 */
export type ConnectionState = 'connecting' | 'connected' | 'disconnected' | 'reconnecting'

/**
 * Message from server
 */
export interface ServerMessage<T = unknown> {
  event: string
  data: T
  timestamp: number
}

/**
 * Connection established event data
 */
export interface ConnectionEstablished {
  socketId: string
  channel: string
  subdomain: string
  timestamp: number
}

/**
 * Error event data
 */
export interface ErrorData {
  message: string
  code?: number
}

/**
 * Channel instance type
 */
export interface Channel {
  /**
   * Channel name
   */
  name: string
  
  /**
   * Subscribe to an event on this channel
   */
  on<T = unknown>(event: string, callback: EventCallback<T>): () => void
  
  /**
   * Subscribe to an event once
   */
  once<T = unknown>(event: string, callback: EventCallback<T>): () => void
  
  /**
   * Unsubscribe from an event
   */
  off(event: string, callback?: EventCallback): void
  
  /**
   * Send a client event to the channel
   */
  trigger<T = unknown>(data: T): void
  
  /**
   * Disconnect from channel
   */
  disconnect(): void
  
  /**
   * Check if connected
   */
  isConnected(): boolean
  
  /**
   * Get socket ID
   */
  getSocketId(): string | null
}

/**
 * Main Kalze client type
 */
export interface KalzeClient {
  /**
   * Subscribe to a channel
   */
  subscribe(channelName: string): Channel
  
  /**
   * Unsubscribe from a channel
   */
  unsubscribe(channelName: string): void
  
  /**
   * Get all subscribed channels
   */
  getChannels(): string[]
  
  /**
   * Disconnect from all channels
   */
  disconnectAll(): void
}
