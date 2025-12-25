import { validate } from "jsonschema";
import { NeuroClient } from ".";
import { JSONSchema7Object } from "json-schema";
import { Action, ActionData, ActionForcePriorityEnum, ActionMessageData, ContextMessageData, ForceActionsMessageData, IncomingMessage, OutgoingMessage, RegisterActionsMessageData, UnregisterActionsMessageData } from "./types";

export { Action, ActionData, ActionForcePriorityEnum } from "./types"

/**
 * This is a wrapper class intended to help automate some common actions with the NeuroClient.
 */
export class NeuroClientWrapper extends NeuroClient {
    public actionHandled: boolean = true

    constructor(url: string, game: string, onConnected: () => void = () => undefined) {
        super(url, game, onConnected)
        this.actionHandlers.push(this.handleActionMessage)
        this.handleActionMessage = this.handleActionMessage
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

    protected handleMessage(data: any): void {
        let message: IncomingMessage
        try {
            message = JSON.parse(data)
        } catch (error: any) {
            this.loggingHandler(`[NeuroClientWrapper] Invalid JSON received: ${data}`, LogLevel.ERROR)
            return
        }
        switch (message.command) {
            case 'action':
                this.handleActionMessage(message.data as ActionMessageData)
                break
            case 'actions/reregister_all':
                this.registerActions(this.registeredActions)
                break
            default:
                this.loggingHandler(`[NeuroClientWrapper] Received unknown/unimplemented command: ${message.command}`, LogLevel.WARN)
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

    protected handleActionMessage(data: ActionMessageData) {
        let actionParams: JSONSchema7Object = {}
        if (data.data) {
            try {
                actionParams = JSON.parse(data.data)
            } catch (error: unknown) {
                const errorMessage = `Invalid action data: ${(error as Error).message}`
                this.sendActionResult(data.id, false, errorMessage)
                console.error(`[NeuroClientWrapper] ${errorMessage}`)
                return
            }
        }

        const action = this.registeredActions.find((a) => a.name === data.name)
        if (!action) {
            this.sendActionResult(data.id, true, `[NeuroClientWrapper] Unknown action: "${data.name}"`)
            return
        }
        if (action.schema && Object.keys(action.schema).length !== 0) {
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
            this.loggingHandler('[NeuroClientWrapper] No action handlers registered.', LogLevel.ERROR)
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

    public forceActions(query: string, actionNames: string[], state?: string, ephemeralContext?: boolean, priority?: ActionForcePriorityEnum): void {
        let unknownNames: string[] = []
        for (const name of actionNames) {
            if (!this.registeredActions.find(a => a.name === name)) unknownNames.push(name)
        }
        if (unknownNames.length === actionNames.length) this.loggingHandler("All specified actions are unknown to Neuro, the action force will be dropped.", LogLevel.ERROR)
        else if (unknownNames.length > 1) this.loggingHandler(`Unknown actions specified in force: "${unknownNames.join('", "')}". These actions will not be considered by Neuro.`, LogLevel.WARN)
        const message: OutgoingMessage = {
            command: 'actions/force',
            game: this.game,
            data: {
                state,
                query,
                ephemeral_context: ephemeralContext,
                priority,
                action_names: actionNames,
            } as ForceActionsMessageData,
        }
        this.sendMessage(message)
    }

    public sendContext(messageText: string, silent?: boolean): void {
        this.loggingHandler(`Sending ${silent ? "silent " : ""}context to Neuro`, LogLevel.DEBUG)
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
}

export enum LogLevel {
    DEBUG,
    LOG,
    INFO,
    WARN,
    ERROR,
}
