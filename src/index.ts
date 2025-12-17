import WebSocket from 'modern-isomorphic-ws'

/**
 * Messages sent by the game (client) to Neuro (server).
 */
interface OutgoingMessage {
  /** The websocket command. */
  command: string

  /**
   * The game name, used to identify the game.
   * Should always be the same and should not change.
   */
  game: string

  /**
   * The command data, different depending on which command is sent.
   * Some commands may not have any data, in which case this object will be either undefined or {}.
   */
  data?: any
}

/**
 * Messages sent by Neuro (server) to the game (client).
 */
interface IncomingMessage {
  /** The websocket command. */
  command: string

  /** The command data, may not be present for some commands. */
  data?: any
}

/**
 * An action is a registerable command that Neuro can execute whenever she wants.
 */
export interface Action {
  /**
   * The name of the action, which is its unique identifier.
   * Should be a lowercase string with words separated by underscores or dashes.
   */
  name: string

  /**
   * A plaintext description of what this action does.
   * This information will be directly received by Neuro.
   */
  description: string

  /**
   * A valid simple JSON schema object that describes how the response data should look like.
   * If your action does not have any parameters, you can omit this field or set it to {}.
   */
  schema?: any
}

/**
 * Data for a 'context' message.
 */
interface ContextMessageData {
  /**
   * A plaintext message that describes what is happening in the game.
   * This information will be directly received by Neuro.
   */
  message: string

  /**
   * If `true`, the message will be added to Neuro's context without prompting her to respond to it.
   * If `false`, Neuro might respond to the message directly, unless she is busy talking to someone else or to chat.
   */
  silent: boolean
}

/**
 * Data for 'actions/register' message.
 */
interface RegisterActionsMessageData {
  /** An array of actions to be registered. */
  actions: Action[]
}

/**
 * Data for 'actions/unregister' message.
 */
interface UnregisterActionsMessageData {
  /** The names of the actions to unregister. */
  action_names: string[]
}

/**
 * Data for 'actions/force' message.
 */
interface ForceActionsMessageData {
  /**
   * An arbitrary string that describes the current state of the game.
   * This can be plaintext, JSON, Markdown, or any other format.
   * This information will be directly received by Neuro.
   */
  state?: string

  /**
   * A plaintext message that tells Neuro what she is currently supposed to be doing.
   * This information will be directly received by Neuro.
   */
  query: string

  /**
   * If `false`, the context provided in the `state` and `query` parameters will be remembered by Neuro after the actions force is completed.
   * If `true`, Neuro will only remember it for the duration of the actions force.
   */
  ephemeral_context?: boolean

  /** The names of the actions that Neuro should choose from. */
  action_names: string[]

  /**
   * The priority of action forces.
   * Ranges from 'low' to 'critical'. 'critical' cuts off speech immediately.
   * Previously set to low.
   */
  priority?: ActionForcePriority
}

type ActionForcePriority = "low" | "medium" | "high" | "critical"

/**
 * Data for 'action/result' message.
 */
interface ActionResultMessageData {
  /**
   * The id of the action that this result is for.
   * This is grabbed from the action message directly.
   */
  id: string

  /**
   * Whether or not the action was successful.
   * If this is `false` and this action is part of an actions force, the whole actions force will be immediately retried by Neuro.
   */
  success: boolean

  /**
   * A plaintext message that describes what happened when the action was executed.
   * If not successful, this should be an error message.
   * If successful, this can either be empty, or provide a small context to Neuro regarding the action she just took.
   * This information will be directly received by Neuro.
   */
  message?: string
}

/**
 * Data for 'action' message received from Neuro.
 */
interface ActionMessageData {
  /**
   * A unique id for the action. You should use it when sending back the action result.
   */
  id: string

  /** The name of the action that Neuro is trying to execute. */
  name: string

  /**
   * The JSON-stringified data for the action, as sent by Neuro.
   * This should be an object that matches the JSON schema you provided when registering the action.
   * If you did not provide a schema, this parameter will usually be undefined.
   */
  data?: string
}

/**
 * The type of the action handler function.
 */
type ActionHandler = (actionData: {
  id: string
  name: string
  params: any
}) => void

/**
 * The NeuroClient class handles communication with Neuro-sama's server.
 */
export class NeuroClient {
  /**
   * The WebSocket connection to Neuro-sama's server.
   */
  public ws?: WebSocket

  /**
   * The game name, used to identify the game.
   */
  public game: string

  /**
   * The WebSocket server URL.
   */
  public url: string

  /**
   * Array of handlers for incoming actions from Neuro-sama.
   */
  public actionHandlers: ActionHandler[] = []

  /**
   * Handler for WebSocket 'close' events.
   */
  public onClose?: (event: any) => void

  /**
   * Handler for WebSocket 'error' events.
   */
  public onError?: (error: any) => void

  /**
   * Creates an instance of NeuroClient.
   * @param url The WebSocket server URL.
   * @param game The game name.
   * @param onConnected Callback invoked when the WebSocket connection is established.
   */
  constructor(url: string, game: string, onConnected: () => void) {
    this.url = url
    this.game = game
    this.connect(onConnected)
  }

  /**
   * Initializes the WebSocket connection.
   * @param onConnected Callback invoked when the WebSocket connection is established.
   */
  private connect(onConnected: () => void) {
    this.ws = new WebSocket(this.url)

    this.ws.onopen = () => {
      console.log('[NeuroClient] Connected to Neuro-sama server.')
      this.sendStartup()
      onConnected()
    }

    this.ws.onmessage = (event: any) => {
      const data = typeof event.data === 'string' ? event.data : ''
      this.handleMessage(data)
    }

    this.ws.onclose = (event: any) => {
      if (this.onClose) {
        this.onClose(event)
      } else {
        console.log('[NeuroClient] WebSocket connection closed:', event)
      }
    }

    this.ws.onerror = (error: any) => {
      if (this.onError) {
        this.onError(error)
      } else {
        console.error('[NeuroClient] WebSocket error:', error)
      }
    }
  }

  /**
   * Sends the 'startup' message to inform Neuro-sama that the game is running.
   */
  private sendStartup() {
    const message: OutgoingMessage = {
      command: 'startup',
      game: this.game,
    }
    this.sendMessage(message)
  }

  /**
   * Sends a message over the WebSocket connection.
   * @param message The message to send.
   */
  private sendMessage(message: OutgoingMessage) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(message))
    } else {
      console.error(
        '[NeuroClient] WebSocket is not open. Ready state:',
        this.ws ? this.ws.readyState : 'No WebSocket instance'
      )
    }
  }

  /**
   * Handles incoming messages from Neuro-sama.
   * @param data The message data received.
   */
  private handleMessage(data: any) {
    let message: IncomingMessage
    try {
      message = JSON.parse(data)
    } catch (error: any) {
      console.error('[NeuroClient] Invalid JSON received:', data)
      return
    }
    switch (message.command) {
      case 'action':
        this.handleActionMessage(message.data)
        break
      default:
        console.warn('[NeuroClient] Received unknown command:', message.command)
    }
  }

  /**
   * Handles 'action' messages from Neuro-sama.
   * @param data The action message data.
   */
  private handleActionMessage(data: ActionMessageData) {
    let actionParams: any = {}
    if (data.data) {
      try {
        actionParams = JSON.parse(data.data)
      } catch (error: any) {
        const errorMessage = `Invalid action data: ${error.message}`
        this.sendActionResult(data.id, false, errorMessage)
        console.error(`[NeuroClient] ${errorMessage}`)
        return
      }
    }

    if (this.actionHandlers.length > 0) {
      for (const handler of this.actionHandlers) {
        handler({ id: data.id, name: data.name, params: actionParams })
      }
    } else {
      console.warn('[NeuroClient] No action handlers registered.')
    }
  }

  /**
   * Sends a 'context' message to let Neuro know about something that is happening in game.
   * @param messageText A plaintext message that describes what is happening in the game.
   * @param silent If true, the message will be added to Neuro's context without prompting her to respond to it.
   */
  public sendContext(messageText: string, silent: boolean = false) {
    const message: OutgoingMessage = {
      command: 'context',
      game: this.game,
      data: {
        message: messageText,
        silent: silent,
      } as ContextMessageData,
    }
    this.sendMessage(message)
  }

  /**
   * Registers one or more actions for Neuro to use.
   * @param actions An array of actions to be registered.
   */
  public registerActions(actions: Action[]) {
    const message: OutgoingMessage = {
      command: 'actions/register',
      game: this.game,
      data: {
        actions: actions,
      } as RegisterActionsMessageData,
    }
    this.sendMessage(message)
  }

  /**
   * Unregisters one or more actions, preventing Neuro from using them anymore.
   * @param actionNames The names of the actions to unregister.
   */
  public unregisterActions(actionNames: string[]) {
    const message: OutgoingMessage = {
      command: 'actions/unregister',
      game: this.game,
      data: {
        action_names: actionNames,
      } as UnregisterActionsMessageData,
    }
    this.sendMessage(message)
  }

  /**
   * Forces Neuro to execute one of the listed actions as soon as possible.
   * Note that this might take a bit if she is already talking.
   * @param query A plaintext message that tells Neuro what she is currently supposed to be doing.
   * @param actionNames The names of the actions that Neuro should choose from.
   * @param state An arbitrary string that describes the current state of the game.
   * @param ephemeralContext If true, Neuro will only remember the context for the duration of the actions force.
   * @param priority
   */
  public forceActions(
    query: string,
    actionNames: string[],
    state?: string,
    ephemeralContext: boolean = false,
    priority: ActionForcePriority = "low"
  ) {
    const message: OutgoingMessage = {
      command: 'actions/force',
      game: this.game,
      data: {
        state: state,
        query: query,
        ephemeral_context: ephemeralContext,
        priority,
        action_names: actionNames,
      } as ForceActionsMessageData,
    }
    this.sendMessage(message)
  }

  /**
   * Sends an action result message to Neuro-sama.
   * Needs to be sent as soon as possible after an action is validated, to allow Neuro to continue.
   * @param id The id of the action that this result is for.
   * @param success Whether or not the action was successful.
   * @param messageText A plaintext message that describes what happened when the action was executed.
   */
  public sendActionResult(id: string, success: boolean, messageText?: string) {
    const message: OutgoingMessage = {
      command: 'action/result',
      game: this.game,
      data: {
        id: id,
        success: success,
        message: messageText,
      } as ActionResultMessageData,
    }
    this.sendMessage(message)
  }

  /**
   * Registers an action handler to process incoming actions from Neuro-sama.
   * Multiple handlers can be registered.
   * @param handler The action handler function.
   */
  public onAction(handler: ActionHandler) {
    this.actionHandlers.push(handler)
  }

  /**
   * Closes the WebSocket connection.
   */
  public disconnect() {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.close()
    }
  }
}
