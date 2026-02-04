const DEFAULT_WS_URL = 'wss://ws.websocket.cl';
/**
 * Kalze Channel - Represents a connection to a specific channel
 */
export class KalzeChannel {
    constructor(channelName, options) {
        this.ws = null;
        this.socketId = null;
        this.state = 'disconnected';
        this.eventListeners = new Map();
        this.reconnectAttempts = 0;
        this.reconnectTimeout = null;
        this.heartbeatInterval = null;
        this.name = channelName;
        this.options = {
            key: options.key,
            subdomain: options.subdomain,
            wsUrl: options.wsUrl || DEFAULT_WS_URL,
            autoReconnect: options.autoReconnect ?? true,
            maxReconnectAttempts: options.maxReconnectAttempts ?? 10,
            reconnectDelay: options.reconnectDelay ?? 1000,
            debug: options.debug ?? false,
        };
        this.connect();
    }
    /**
     * Connect to the WebSocket server
     */
    connect() {
        if (this.state === 'connecting' || this.state === 'connected') {
            return;
        }
        this.state = this.reconnectAttempts > 0 ? 'reconnecting' : 'connecting';
        this.emit('state:change', { state: this.state });
        const url = `${this.options.wsUrl}/c/${this.options.subdomain}/${this.name}?key=${this.options.key}`;
        this.log(`Connecting to ${url}`);
        try {
            this.ws = new WebSocket(url);
            this.ws.onopen = () => {
                this.log('Connection opened');
            };
            this.ws.onmessage = (event) => {
                this.handleMessage(event.data);
            };
            this.ws.onclose = (event) => {
                this.handleClose(event.code, event.reason);
            };
            this.ws.onerror = (event) => {
                this.log('WebSocket error', event);
                this.emit('error', { message: 'WebSocket error' });
            };
        }
        catch (error) {
            this.log('Connection error', error);
            this.emit('error', { message: 'Failed to connect' });
            this.scheduleReconnect();
        }
    }
    /**
     * Handle incoming message
     */
    handleMessage(data) {
        try {
            const message = JSON.parse(data);
            this.log('Received:', message);
            // Handle system events
            switch (message.event) {
                case 'connection:established':
                    this.handleConnectionEstablished(message.data);
                    break;
                case 'pong':
                    // Heartbeat response
                    break;
                default:
                    // Emit to listeners
                    this.emit(message.event, message.data);
            }
        }
        catch (error) {
            this.log('Failed to parse message', error);
        }
    }
    /**
     * Handle connection established
     */
    handleConnectionEstablished(data) {
        this.socketId = data.socketId;
        this.state = 'connected';
        this.reconnectAttempts = 0;
        // Start heartbeat
        this.startHeartbeat();
        this.emit('connected', data);
        this.emit('state:change', { state: this.state });
        this.log(`Connected with socket ID: ${this.socketId}`);
    }
    /**
     * Handle connection close
     */
    handleClose(code, reason) {
        this.log(`Connection closed: ${code} - ${reason}`);
        this.stopHeartbeat();
        this.ws = null;
        this.socketId = null;
        this.state = 'disconnected';
        this.emit('disconnected', { code, reason });
        this.emit('state:change', { state: this.state });
        // Don't reconnect if intentionally closed or server refused
        if (code === 4000 || code === 4001 || code === 4002 || code === 4999) {
            this.log('Not reconnecting due to error code');
            return;
        }
        this.scheduleReconnect();
    }
    /**
     * Schedule reconnect
     */
    scheduleReconnect() {
        if (!this.options.autoReconnect)
            return;
        if (this.reconnectAttempts >= this.options.maxReconnectAttempts) {
            this.log('Max reconnect attempts reached');
            this.emit('reconnect:failed', { attempts: this.reconnectAttempts });
            return;
        }
        this.reconnectAttempts++;
        const delay = this.options.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1);
        this.log(`Scheduling reconnect attempt ${this.reconnectAttempts} in ${delay}ms`);
        this.emit('reconnecting', { attempt: this.reconnectAttempts, delay });
        this.reconnectTimeout = setTimeout(() => {
            this.connect();
        }, delay);
    }
    /**
     * Start heartbeat
     */
    startHeartbeat() {
        this.stopHeartbeat();
        this.heartbeatInterval = setInterval(() => {
            if (this.ws?.readyState === WebSocket.OPEN) {
                this.ws.send(JSON.stringify({ event: 'ping' }));
            }
        }, 25000);
    }
    /**
     * Stop heartbeat
     */
    stopHeartbeat() {
        if (this.heartbeatInterval) {
            clearInterval(this.heartbeatInterval);
            this.heartbeatInterval = null;
        }
    }
    /**
     * Emit event to listeners
     */
    emit(event, data) {
        const listeners = this.eventListeners.get(event);
        if (listeners) {
            for (const callback of listeners) {
                try {
                    callback(data);
                }
                catch (error) {
                    this.log(`Error in event listener for ${event}`, error);
                }
            }
        }
        // Also emit to wildcard listeners
        const wildcardListeners = this.eventListeners.get('*');
        if (wildcardListeners) {
            for (const callback of wildcardListeners) {
                try {
                    callback({ event, data });
                }
                catch (error) {
                    this.log(`Error in wildcard listener`, error);
                }
            }
        }
    }
    /**
     * Log message if debug is enabled
     */
    log(message, ...args) {
        if (this.options.debug) {
            console.log(`[Kalze:${this.name}] ${message}`, ...args);
        }
    }
    // Public API
    /**
     * Subscribe to an event
     */
    on(event, callback) {
        if (!this.eventListeners.has(event)) {
            this.eventListeners.set(event, new Set());
        }
        this.eventListeners.get(event).add(callback);
        // Return unsubscribe function
        return () => this.off(event, callback);
    }
    /**
     * Subscribe to an event once
     */
    once(event, callback) {
        const wrapper = (data) => {
            this.off(event, wrapper);
            callback(data);
        };
        return this.on(event, wrapper);
    }
    /**
     * Unsubscribe from an event
     */
    off(event, callback) {
        if (!callback) {
            this.eventListeners.delete(event);
        }
        else {
            const listeners = this.eventListeners.get(event);
            if (listeners) {
                listeners.delete(callback);
                if (listeners.size === 0) {
                    this.eventListeners.delete(event);
                }
            }
        }
    }
    /**
     * Send a client event to the channel
     */
    trigger(data) {
        if (this.ws?.readyState === WebSocket.OPEN) {
            this.ws.send(JSON.stringify({
                event: 'client:event',
                data,
            }));
        }
        else {
            this.log('Cannot trigger event: not connected');
        }
    }
    /**
     * Disconnect from channel
     */
    disconnect() {
        if (this.reconnectTimeout) {
            clearTimeout(this.reconnectTimeout);
            this.reconnectTimeout = null;
        }
        this.stopHeartbeat();
        if (this.ws) {
            this.ws.close(1000, 'Client disconnect');
            this.ws = null;
        }
        this.socketId = null;
        this.state = 'disconnected';
        this.eventListeners.clear();
    }
    /**
     * Check if connected
     */
    isConnected() {
        return this.state === 'connected';
    }
    /**
     * Get socket ID
     */
    getSocketId() {
        return this.socketId;
    }
    /**
     * Get connection state
     */
    getState() {
        return this.state;
    }
}
/**
 * Kalze Client - Main entry point
 */
export class Kalze {
    constructor(options) {
        this.channels = new Map();
        if (!options.key) {
            throw new Error('API key is required');
        }
        if (!options.subdomain) {
            throw new Error('Subdomain is required');
        }
        this.options = options;
    }
    /**
     * Subscribe to a channel
     */
    subscribe(channelName) {
        if (this.channels.has(channelName)) {
            return this.channels.get(channelName);
        }
        const channel = new KalzeChannel(channelName, this.options);
        this.channels.set(channelName, channel);
        return channel;
    }
    /**
     * Unsubscribe from a channel
     */
    unsubscribe(channelName) {
        const channel = this.channels.get(channelName);
        if (channel) {
            channel.disconnect();
            this.channels.delete(channelName);
        }
    }
    /**
     * Get all subscribed channels
     */
    getChannels() {
        return Array.from(this.channels.keys());
    }
    /**
     * Get a specific channel
     */
    getChannel(channelName) {
        return this.channels.get(channelName);
    }
    /**
     * Disconnect from all channels
     */
    disconnectAll() {
        for (const channel of this.channels.values()) {
            channel.disconnect();
        }
        this.channels.clear();
    }
}
// Default export
export default Kalze;
//# sourceMappingURL=client.js.map