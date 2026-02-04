import type { KalzeOptions, EventCallback, ConnectionState, Channel } from './types.js';
/**
 * Kalze Channel - Represents a connection to a specific channel
 */
export declare class KalzeChannel implements Channel {
    name: string;
    private options;
    private ws;
    private socketId;
    private state;
    private eventListeners;
    private reconnectAttempts;
    private reconnectTimeout;
    private heartbeatInterval;
    constructor(channelName: string, options: KalzeOptions);
    /**
     * Connect to the WebSocket server
     */
    private connect;
    /**
     * Handle incoming message
     */
    private handleMessage;
    /**
     * Handle connection established
     */
    private handleConnectionEstablished;
    /**
     * Handle connection close
     */
    private handleClose;
    /**
     * Schedule reconnect
     */
    private scheduleReconnect;
    /**
     * Start heartbeat
     */
    private startHeartbeat;
    /**
     * Stop heartbeat
     */
    private stopHeartbeat;
    /**
     * Emit event to listeners
     */
    private emit;
    /**
     * Log message if debug is enabled
     */
    private log;
    /**
     * Subscribe to an event
     */
    on<T = unknown>(event: string, callback: EventCallback<T>): () => void;
    /**
     * Subscribe to an event once
     */
    once<T = unknown>(event: string, callback: EventCallback<T>): () => void;
    /**
     * Unsubscribe from an event
     */
    off(event: string, callback?: EventCallback): void;
    /**
     * Send a client event to the channel
     */
    trigger<T = unknown>(data: T): void;
    /**
     * Disconnect from channel
     */
    disconnect(): void;
    /**
     * Check if connected
     */
    isConnected(): boolean;
    /**
     * Get socket ID
     */
    getSocketId(): string | null;
    /**
     * Get connection state
     */
    getState(): ConnectionState;
}
/**
 * Kalze Client - Main entry point
 */
export declare class Kalze {
    private options;
    private channels;
    constructor(options: KalzeOptions);
    /**
     * Subscribe to a channel
     */
    subscribe(channelName: string): KalzeChannel;
    /**
     * Unsubscribe from a channel
     */
    unsubscribe(channelName: string): void;
    /**
     * Get all subscribed channels
     */
    getChannels(): string[];
    /**
     * Get a specific channel
     */
    getChannel(channelName: string): KalzeChannel | undefined;
    /**
     * Disconnect from all channels
     */
    disconnectAll(): void;
}
export default Kalze;
//# sourceMappingURL=client.d.ts.map