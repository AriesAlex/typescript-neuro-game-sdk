import type { JSONSchema7, JSONSchema7Object } from "json-schema"

/**
 * Proposed commands, not used by Neuro yet:
 * - "actions/reregister_all"
 * - "shutdown/graceful"
 * - "shutdown/immediate"
 * 
 * As suck, this SDK does not implement handling of those commands.
 */
export type IncomingCommands = "action"
  | "actions/reregister_all"
  | "shutdown/graceful"
  | "shutdown/immediate"

export type IncomingData = GracefulShutdownMessageData | ActionMessageData

/**
 * Data for 'shutdown/graceful' from Neuro.
 */
export interface GracefulShutdownMessageData {
  /** 
   * Whether or not Neuro wants to shut down the game.
   * If `true`, save the game and return to main menu if possible.
   * If `false`, cancel the shutdown process.
   */
  wants_shutdown: boolean
}

/**
 * Messages sent by the game (client) to Neuro (server).
 */
export interface OutgoingMessage {
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
export interface IncomingMessage {
  /** The websocket command. */
  command: IncomingCommands

  /** The command data, may not be present for some commands. */
  data?: IncomingData
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
  schema?: Omit<JSONSchema7, 'type'> & { type: 'object' } // for top-level schema it must be an object
}

/**
 * This is parsed action data received from Neuro, ready to be used by handlers.
 */
export interface ActionData<T extends JSONSchema7Object | undefined = any> {
  /**
   * The ID of the action attempt, assigned by the server.
   * You will want to use this when returning action results.
   */
  id: string
  /**
   * The name of the action that Neuro wants to execute.
   */
  name: string
  /**
   * Parameter data sent from Neuro.
   * This will automatically be parsed into a JSON object for you.
   * You also don't need to worry about this being potentially invalid JSON, as the SDK automatically handles that.
   * 
   * If no params are sent, this property will simply be an empty object {}.
   */
  params: T
}

/**
 * Data for a 'context' message.
 */
export interface ContextMessageData {
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
export interface RegisterActionsMessageData {
  /** An array of actions to be registered. */
  actions: Action[]
}

/**
 * Data for 'actions/unregister' message.
 */
export interface UnregisterActionsMessageData {
  /** The names of the actions to unregister. */
  action_names: string[]
}

/**
 * Data for 'actions/force' message.
 */
export interface ForceActionsMessageData {
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
   * Ranges from `low` to `critical`. `critical` cuts off speech immediately, `medium` and `high` does some prompting to finish speaking earlier/respond ASAP.
   * Previously always set to low.
   */
  priority?: ActionForcePriorityEnum
}

export const enum ActionForcePriorityEnum {
  LOW = "low",
  MEDIUM = "medium",
  HIGH = "high",
  CRITICAL = "critical",
}

/**
 * Data for 'action/result' message.
 */
export interface ActionResultMessageData {
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
export interface ActionMessageData {
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
export type ActionHandler = (actionData: ActionData) => void
