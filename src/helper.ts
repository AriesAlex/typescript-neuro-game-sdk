import { validate } from "jsonschema";
import { NeuroClient } from ".";
import { JSONSchema7Object } from "json-schema";
import { Action, ActionData, ActionForcePriorityEnum, ActionMessageData, OutgoingMessage, RegisterActionsMessageData, UnregisterActionsMessageData } from "./types";

export { Action, ActionData, ActionForcePriorityEnum } from "./types"

/**
 * This is a wrapper class intended to help automate some common actions with the NeuroClient.
 */
export class NeuroClientWrapper extends NeuroClient {
    public actionHandled: boolean = true

    constructor(url: string, game: string, onConnected: () => void = () => undefined) {
        super(url, game, onConnected)
        this.actionHandlers.push(this.actionHandler)
        this.handleActionMessage = this.actionHandler
    }

    /**
     * Handler for logging events with the SDK.
     * @param message The message to log
     * @param level The log level of the message.
     */
    public loggingHandler: (message: string, type: LogLevel) => void = (message: string, level: LogLevel) => {
        switch (level) {
            case LogLevel.DEBUG:
                console.debug(message)
                break
            case LogLevel.LOG:
                console.log(message)
                break
            case LogLevel.INFO:
                console.info(message)
                break
            case LogLevel.WARN:
                console.warn(message)
                break
            case LogLevel.ERROR:
                console.error(message)
                break
        }
    }

    /**
     * Reconnects the NeuroClient.
     * @param url The Neuro API URl. If this is not provided, the existing URL will be used.
     */
    public reconnect(url?: string) {
        this.disconnect()
        if (url) this.url = url
        this.connect()
    }

    //public postActionCheckHandler: () => void

    private registeredActions: Action[] = []

    private actionHandler(data: ActionMessageData) {
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

        const action = this.registeredActions.find((a) => a.name === data.name)
        if (!action) {
            this.sendActionResult(data.id, true, `[NeuroClientWrapper] Unknown action: "${data.name}"`)
            return
        }
        if (action.schema) {
            const schemaValidationResult = validate(actionParams, action.schema)
            if (!schemaValidationResult.valid) {
                const messagesArray: string[] = []
                schemaValidationResult.errors.map((err) => {
                    if (err.stack.startsWith('instance.')) messagesArray.push(err.stack.substring(9));
                    else messagesArray.push(err.stack);
                });
                if (messagesArray.length === 0) messagesArray.push('Unknown schema validation error.');
                const schemaFailures = `- ${messagesArray.join('\n- ')}`;
                const message = `[NeuroClientWrapper] Your inputs for the action "${data.name}" did not pass schema validation.\n\n' + schemaFailures + '\n\nPlease pay attention to the schema and the above errors if you choose to retry.`;
                this.sendActionResult(data.id, false, message)
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

    public registerActions(actions: Action[]) {
        const knownActions: string[] = []
        for (const a of actions) if (this.registeredActions.find(_a => a.name === _a.name)) knownActions.push(a.name);
        if (knownActions.length !== 0) this.loggingHandler(`Duplicate action registered: "${knownActions.join('", "')}"\nThe Neuro server will ignore those registrations.`, LogLevel.WARN);
        this.registeredActions.push(...actions)

        const message: OutgoingMessage = {
            command: 'actions/register',
            game: this.game,
            data: {
                actions,
            } as RegisterActionsMessageData,
        }

        this.sendMessage(message)
    }

    public unregisterActions(actionNames: string[]) {
        const unknownNames: string[] = []
        for (const n of actionNames) {
            const action = this.registeredActions.findIndex(a => a.name === n)
            if (action === -1) unknownNames.push(this.registeredActions[action].name)
            else this.registeredActions.splice(action, 1)
        }
        if (unknownNames.length !== 0) this.loggingHandler(`Actions not registered: "${unknownNames.join('", "')}"\nThe Neuro server will ignore those unregistrations.`, LogLevel.INFO)
        
        const message: OutgoingMessage = {
            command: 'actions/unregister',
            game: this.game,
            data: {
                action_names: actionNames,
            } as UnregisterActionsMessageData,
        }

        this.sendMessage(message)
    }
}

export enum LogLevel {
    DEBUG,
    LOG,
    INFO,
    WARN,
    ERROR,
}

/**
 * This class is a wrapper class for the {@link NeuroClient} that:
 * - handles some common uses and actions with the client;
 * - stores info to allow it to be used as a stateful wrapper; and
 * - add new features that are unnecessary to the "barebones" client class.
 * 
 * This wrapper aims to be as close to 100% backwards compatible as possible, in terms of consumer interactions.
 */
export class _wrapper {
    private client: NeuroClient

    private initClient(url: string, game: string) {
        const client = new NeuroClient(url, game, () => {
            client.actionHandlers.push(this.actionHandler)
            this.actionsArray = []
        })
        return client
    }

    /**
     * Can be used to set if this is a dev environment, which can enable additional logging.
     */
    public isDev: boolean = false

    /**
     * Disconnects and reconnects the NeuroClient.
     * @param client If you would like to provide your own NeuroClient, you may do so here.
     */
    public reloadClient(client?: NeuroClient) {
        this.client.disconnect()
        this.client = client ?? this.initClient(this.client.url, this.client.game)
    }

    /**
     * This static method allows you to create a new wrapper using details from your old NeuroClient.
     * Your old NeuroClient will be disconnected and a new NeuroClient will be established.
     */
    static fromNeuroClientDetails(client: NeuroClient): _wrapper {
        client.disconnect()
        const newClient = new _wrapper(client.url, client.game)
        newClient.client = client
        return newClient
    }

    static fromNeuroClient(client: NeuroClient): _wrapper {
        const newWrapper = new _wrapper("", "")
        newWrapper.client = client
        return newWrapper
    }

    constructor(url: string, game: string) {
        this.client = this.initClient(url, game)
        if (process.env.NODE_ENV === "development") this.isDev = true
    }

    /**
     * Handler for logging events with the SDK.
     * @param message The message to log
     * @param level The log level of the message.
     */
    public loggingHandler: (message: string, type: LogLevel) => void = (message: string, level: LogLevel) => {
        switch (level) {
            case LogLevel.DEBUG:
                console.debug(message)
                break
            case LogLevel.LOG:
                console.log(message)
                break
            case LogLevel.INFO:
                console.info(message)
                break
            case LogLevel.WARN:
                console.warn(message)
                break
            case LogLevel.ERROR:
                console.error(message)
                break
        }
    }

    public actionsArray: Action[] = []

    private actionHandler(actionData: ActionData) {
        const action = this.actionsArray.find((a) => a.name === actionData.name)
        if (!action) {
            this.client.sendActionResult(actionData.id, true, `[NeuroClient] Unknown action: "${actionData.name}"`)
            return
        }
        if (action.schema) {
            const schemaValidation = validate(actionData.params, action.schema)
            if (!schemaValidation.valid) { }
        }
    }

    public registerActions(actions: Action[]) {
        const knownActions: string[] = []
        for (const a of actions) if (this.actionsArray.find(_a => a.name === _a.name)) knownActions.push(a.name);
        if (knownActions.length !== 0) console.warn(`Duplicate action registered: "${knownActions.join('", "')}"\nThe Neuro server will ignore those registrations.`);
        this.actionsArray.push(...actions)
        this.client.registerActions(actions)
    }

    public unregisterActions(actionNames: string[]) {
        const unknownNames: string[] = []
        for (const n of actionNames) {
            const action = this.actionsArray.findIndex(a => a.name === n)
            if (action === -1) unknownNames.push(this.actionsArray[action].name)
            else this.actionsArray.splice(action, 1)
        }
        if (unknownNames.length !== 0) console.warn(`Actions not registered: "${unknownNames.join('", "')}"\nThe Neuro server will ignore those unregistrations.`)
        this.client.unregisterActions(actionNames)
    }

    public sendContext(context: string, silent: boolean = true) {
        this.sendContext(context, silent)
    }

    public forceActions(query: string, action_names: string[], state?: string, ephemeral_context: boolean = false, priority: ActionForcePriorityEnum = ActionForcePriorityEnum.LOW) {
        this.forceActions(query, action_names, state, ephemeral_context, priority)
    }

    public disconnect() {
        this.client.disconnect()
    }
}
