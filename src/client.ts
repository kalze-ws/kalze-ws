import type { 
  KalzeOptions, 
  EventCallback, 
  ConnectionState, 
  ServerMessage,
  ConnectionEstablished,
  Channel
} from './types.js'

const DEFAULT_WS_URL = 'wss://ws.websocket.cl'

/**
 * Kalze Channel - Represents a connection to a specific channel
 */
export class KalzeChannel implements Channel {
  public name: string
  
  private options: Required<KalzeOptions>
  private ws: WebSocket | null = null
  private socketId: string | null = null
  private state: ConnectionState = 'disconnected'
  private eventListeners: Map<string, Set<EventCallback>> = new Map()
  private reconnectAttempts = 0
  private reconnectTimeout: ReturnType<typeof setTimeout> | null = null
  private heartbeatInterval: ReturnType<typeof setInterval> | null = null
  
  constructor(channelName: string, options: KalzeOptions) {
    this.name = channelName
    this.options = {
      key: options.key,
      subdomain: options.subdomain,
      wsUrl: options.wsUrl || DEFAULT_WS_URL,
      autoReconnect: options.autoReconnect ?? true,
      maxReconnectAttempts: options.maxReconnectAttempts ?? 10,
      reconnectDelay: options.reconnectDelay ?? 1000,
      debug: options.debug ?? false,
    }
    
    this.connect()
  }
  
  /**
   * Connect to the WebSocket server
   */
  private connect(): void {
    if (this.state === 'connecting' || this.state === 'connected') {
      return
    }

    if (!this.isValidPublicKey(this.options.key)) {
      this.emit('error', {
        code: 4403,
        message: 'Invalid public API key format. Expected wpk_live_*',
      })
      return
    }
    
    this.state = this.reconnectAttempts > 0 ? 'reconnecting' : 'connecting'
    this.emit('state:change', { state: this.state })
    
    const url = `${this.options.wsUrl}/c/${this.options.subdomain}/${this.name}?key=${this.options.key}`
    
    this.log(`Connecting to ${url}`)
    
    try {
      this.ws = new WebSocket(url)
      
      this.ws.onopen = () => {
        this.log('Connection opened')
      }
      
      this.ws.onmessage = (event) => {
        this.handleMessage(event.data)
      }
      
      this.ws.onclose = (event) => {
        this.handleClose(event.code, event.reason)
      }
      
      this.ws.onerror = (event) => {
        this.log('WebSocket error', event)
        this.emit('error', { message: 'WebSocket error' })
      }
    } catch (error) {
      this.log('Connection error', error)
      this.emit('error', { message: 'Failed to connect' })
      this.scheduleReconnect()
    }
  }
  
  /**
   * Handle incoming message
   */
  private handleMessage(data: string): void {
    try {
      const message: ServerMessage = JSON.parse(data)
      this.log('Received:', message)
      
      // Handle system events
      switch (message.event) {
        case 'connection:established':
          this.handleConnectionEstablished(message.data as ConnectionEstablished)
          break
          
        case 'pong':
          // Heartbeat response
          break
          
        default:
          // Emit to listeners
          this.emit(message.event, message.data)
      }
    } catch (error) {
      this.log('Failed to parse message', error)
    }
  }
  
  /**
   * Handle connection established
   */
  private handleConnectionEstablished(data: ConnectionEstablished): void {
    this.socketId = data.socketId
    this.state = 'connected'
    this.reconnectAttempts = 0
    
    // Start heartbeat
    this.startHeartbeat()
    
    this.emit('connected', data)
    this.emit('state:change', { state: this.state })
    
    this.log(`Connected with socket ID: ${this.socketId}`)
  }
  
  /**
   * Handle connection close
   */
  private handleClose(code: number, reason: string): void {
    this.log(`Connection closed: ${code} - ${reason}`)

    const mappedMessage = this.getCloseReasonMessage(code, reason)
    if (mappedMessage) {
      this.emit('error', { code, message: mappedMessage })
    }
    
    this.stopHeartbeat()
    this.ws = null
    this.socketId = null
    this.state = 'disconnected'
    
    this.emit('disconnected', { code, reason })
    this.emit('state:change', { state: this.state })
    
    // Don't reconnect if intentionally closed or server refused
    if (code === 4000 || code === 4001 || code === 4002 || code === 4401 || code === 4403 || code === 4408 || code === 4999) {
      this.log('Not reconnecting due to error code')
      return
    }
    
    this.scheduleReconnect()
  }
  
  /**
   * Schedule reconnect
   */
  private scheduleReconnect(): void {
    if (!this.options.autoReconnect) return
    if (this.reconnectAttempts >= this.options.maxReconnectAttempts) {
      this.log('Max reconnect attempts reached')
      this.emit('reconnect:failed', { attempts: this.reconnectAttempts })
      return
    }
    
    this.reconnectAttempts++
    const delay = this.options.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1)
    
    this.log(`Scheduling reconnect attempt ${this.reconnectAttempts} in ${delay}ms`)
    this.emit('reconnecting', { attempt: this.reconnectAttempts, delay })
    
    this.reconnectTimeout = setTimeout(() => {
      this.connect()
    }, delay)
  }
  
  /**
   * Start heartbeat
   */
  private startHeartbeat(): void {
    this.stopHeartbeat()
    this.heartbeatInterval = setInterval(() => {
      if (this.ws?.readyState === WebSocket.OPEN) {
        this.ws.send(JSON.stringify({ event: 'ping' }))
      }
    }, 25000)
  }
  
  /**
   * Stop heartbeat
   */
  private stopHeartbeat(): void {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval)
      this.heartbeatInterval = null
    }
  }
  
  /**
   * Emit event to listeners
   */
  private emit(event: string, data: unknown): void {
    const listeners = this.eventListeners.get(event)
    if (listeners) {
      for (const callback of listeners) {
        try {
          callback(data)
        } catch (error) {
          this.log(`Error in event listener for ${event}`, error)
        }
      }
    }
    
    // Also emit to wildcard listeners
    const wildcardListeners = this.eventListeners.get('*')
    if (wildcardListeners) {
      for (const callback of wildcardListeners) {
        try {
          callback({ event, data })
        } catch (error) {
          this.log(`Error in wildcard listener`, error)
        }
      }
    }
  }
  
  /**
   * Log message if debug is enabled
   */
  private log(message: string, ...args: unknown[]): void {
    if (this.options.debug) {
      console.log(`[Kalze:${this.name}] ${message}`, ...args)
    }
  }

  private isValidPublicKey(key: string): boolean {
    return /^wpk_live_[A-Za-z0-9_-]{43}$/.test(key)
  }

  private getCloseReasonMessage(code: number, reason: string): string | null {
    if (reason) return reason

    switch (code) {
      case 4401:
        return 'Missing API key (?key=...)'
      case 4403:
        return 'Invalid API key'
      case 4408:
        return 'Connection limit exceeded'
      case 4000:
        return 'Invalid path. Expected /c/:subdomain/:channel'
      default:
        return code >= 4000 ? `Connection rejected (${code})` : null
    }
  }
  
  // Public API
  
  /**
   * Subscribe to an event
   */
  on<T = unknown>(event: string, callback: EventCallback<T>): () => void {
    if (!this.eventListeners.has(event)) {
      this.eventListeners.set(event, new Set())
    }
    this.eventListeners.get(event)!.add(callback as EventCallback)
    
    // Return unsubscribe function
    return () => this.off(event, callback as EventCallback)
  }
  
  /**
   * Subscribe to an event once
   */
  once<T = unknown>(event: string, callback: EventCallback<T>): () => void {
    const wrapper: EventCallback = (data) => {
      this.off(event, wrapper)
      callback(data as T)
    }
    return this.on(event, wrapper)
  }
  
  /**
   * Unsubscribe from an event
   */
  off(event: string, callback?: EventCallback): void {
    if (!callback) {
      this.eventListeners.delete(event)
    } else {
      const listeners = this.eventListeners.get(event)
      if (listeners) {
        listeners.delete(callback)
        if (listeners.size === 0) {
          this.eventListeners.delete(event)
        }
      }
    }
  }
  
  /**
   * Send a client event to the channel
   */
  trigger<T = unknown>(data: T): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({
        event: 'client:event',
        data,
      }))
    } else {
      this.log('Cannot trigger event: not connected')
    }
  }
  
  /**
   * Disconnect from channel
   */
  disconnect(): void {
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout)
      this.reconnectTimeout = null
    }
    
    this.stopHeartbeat()
    
    if (this.ws) {
      this.ws.close(1000, 'Client disconnect')
      this.ws = null
    }
    
    this.socketId = null
    this.state = 'disconnected'
    this.eventListeners.clear()
  }
  
  /**
   * Check if connected
   */
  isConnected(): boolean {
    return this.state === 'connected'
  }
  
  /**
   * Get socket ID
   */
  getSocketId(): string | null {
    return this.socketId
  }
  
  /**
   * Get connection state
   */
  getState(): ConnectionState {
    return this.state
  }
}

/**
 * Kalze Client - Main entry point
 */
export class Kalze {
  private options: KalzeOptions
  private channels: Map<string, KalzeChannel> = new Map()
  
  constructor(options: KalzeOptions) {
    if (!options.key) {
      throw new Error('API key is required')
    }
    if (!options.subdomain) {
      throw new Error('Subdomain is required')
    }
    
    this.options = options
  }
  
  /**
   * Subscribe to a channel
   */
  subscribe(channelName: string): KalzeChannel {
    if (this.channels.has(channelName)) {
      return this.channels.get(channelName)!
    }
    
    const channel = new KalzeChannel(channelName, this.options)
    this.channels.set(channelName, channel)
    return channel
  }
  
  /**
   * Unsubscribe from a channel
   */
  unsubscribe(channelName: string): void {
    const channel = this.channels.get(channelName)
    if (channel) {
      channel.disconnect()
      this.channels.delete(channelName)
    }
  }
  
  /**
   * Get all subscribed channels
   */
  getChannels(): string[] {
    return Array.from(this.channels.keys())
  }
  
  /**
   * Get a specific channel
   */
  getChannel(channelName: string): KalzeChannel | undefined {
    return this.channels.get(channelName)
  }
  
  /**
   * Disconnect from all channels
   */
  disconnectAll(): void {
    for (const channel of this.channels.values()) {
      channel.disconnect()
    }
    this.channels.clear()
  }
}

// Default export
export default Kalze
