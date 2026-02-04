// Main exports
export { Kalze, KalzeChannel } from './client.js'

// Types
export type {
  KalzeOptions,
  EventCallback,
  ConnectionState,
  ServerMessage,
  ConnectionEstablished,
  ErrorData,
  Channel,
  KalzeClient,
} from './types.js'

// Default export
import { Kalze } from './client.js'
export default Kalze
