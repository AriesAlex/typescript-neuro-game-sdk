import { validate } from "jsonschema";
import { NeuroClient } from ".";

/**
 * This is a wrapper class intended to help automate some common actions with the NeuroClient.
 */
export class NeuroClientWrapper extends NeuroClient {
    constructor(url: string, game: string, onConnected: () => void = () => undefined) {
        super(url, game, onConnected)
        this.actionHandlers.push(this.actionHandler)
    }

    private registeredActions = []

    private actionHandler(actionData) {}
}
