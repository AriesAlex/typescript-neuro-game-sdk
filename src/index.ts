import WebSocket from 'modern-isomorphic-ws'
import type { JSONSchema7Object } from 'json-schema';
import { ActionHandler, OutgoingMessage, IncomingMessage, ActionMessageData, ActionData, ContextMessageData, Action, RegisterActionsMessageData, UnregisterActionsMessageData, ActionForcePriorityEnum, ForceActionsMessageData, ActionResultMessageData } from './types';

export { Action, ActionData, ActionForcePriorityEnum } from "./types"

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
   * Function to run on connection to the Neuro API.
   */
  public onConnected: () => void

  /**
   * Array of handlers for incoming actions from Neuro-sama.
   */
  public actionHandlers: ActionHandler[] = []

  /**
   * Handler for WebSocket 'close' events.
   */
  public onClose?: (event: WebSocket.CloseEvent) => void

  /**
   * Handler for WebSocket 'error' events.
   */
  public onError?: (error: WebSocket.ErrorEvent) => void

  /**
   * Creates an instance of NeuroClient.
   * @param url The WebSocket server URL.
   * @param game The game name.
   * @param onConnected Callback invoked when the WebSocket connection is established.
   */
  constructor(url: string, game: string, onConnected: () => void) {
    this.url = url
    this.game = game
    this.onConnected = onConnected
    this.connect()
  }

  /**
   * Initializes the WebSocket connection.
   * @param onConnected Callback invoked when the WebSocket connection is established.
   */
  protected connect() {
    this.ws = new WebSocket(this.url)

    this.ws.onopen = () => {
      console.log('[NeuroClient] Connected to Neuro-sama server.')
      this.sendStartup()
      this.onConnected()
    }

    this.ws.onmessage = (event: WebSocket.MessageEvent) => {
      const data = typeof event.data === 'string' ? event.data : ''
      this.handleMessage(data)
    }

    this.ws.onclose = (event: WebSocket.CloseEvent) => {
      if (this.onClose) {
        this.onClose(event)
      } else {
        console.log('[NeuroClient] WebSocket connection closed:', event)
      }
    }

    this.ws.onerror = (error: WebSocket.ErrorEvent) => {
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
  protected sendMessage(message: OutgoingMessage) {
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
        this.handleActionMessage(message.data as ActionMessageData)
        break
      default:
        console.warn('[NeuroClient] Received unknown/unimplemented command:', message.command)
    }
  }

  /**
   * Handles 'action' messages from Neuro-sama.
   * @param data The action message data.
   */
  protected handleActionMessage(data: ActionMessageData) {
    let actionParams: JSONSchema7Object = {}
    if (data.data) {
      try {
        actionParams = JSON.parse(data.data)
      } catch (error: unknown) {
        const errorMessage = `Invalid action data: ${(error as Error).message}`
        this.sendActionResult(data.id, false, errorMessage)
        console.error(`[NeuroClient] ${errorMessage}`)
        return
      }
    }

    if (this.actionHandlers.length > 0) {
      for (const handler of this.actionHandlers) {
        handler({ id: data.id, name: data.name, params: actionParams } as ActionData)
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
   * @param priority The action force's priority level. Defaults to `low`.
   */
  public forceActions(
    query: string,
    actionNames: string[],
    state?: string,
    ephemeralContext: boolean = false,
    priority: ActionForcePriorityEnum = ActionForcePriorityEnum.LOW
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
    if (!success) console.warn(`[NeuroClient] Empty messageText field even though success was false!`)
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
