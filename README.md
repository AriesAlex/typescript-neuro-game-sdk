# Neuro Game SDK for TypeScript and JavaScript

A TypeScript and JavaScript SDK for integrating games with [Neuro-sama](https://twitch.tv/vedal987) AI streamer, allowing developers to write games that Neuro-sama can interact.

This SDK is based on the original [Neuro Game SDK](https://github.com/VedalAI/neuro-game-sdk) and provides an implementation compatible with both Node.js and browser environments. It is designed to work seamlessly in both JavaScript and TypeScript projects.

Please note that this package is for integrating a game to Neuro.
If you're making a server-side implementation of the Neuro API in JavaScript/TypeScript, there is another package called [`neuro-game-api`](https://github.com/KTrain5169/typescript-neuro-game-api) to help.

## Installation

Install the SDK via npm:

```bash
npm install neuro-game-sdk
```

## Usage

### In Node.js

```javascript
import { NeuroClient } from 'neuro-game-sdk'

const NEURO_SERVER_URL = 'ws://localhost:8000'
const GAME_NAME = 'Guess the Number'

const neuroClient = new NeuroClient(NEURO_SERVER_URL, GAME_NAME, () => {
  // Game initialization code. Check the example code
})
```

### In the Browser

Using unpkg:

```html
<script src="https://unpkg.com/neuro-game-sdk/dist/browser/neuro-game-sdk.min.js"></script>
```

Using jsDelivr:

```html
<script src="https://cdn.jsdelivr.net/npm/neuro-game-sdk/dist/browser/neuro-game-sdk.min.js"></script>
```

This will load the SDK into the global namespace as `NeuroGameSdk`. You can then use it in your scripts:

```html
<script>
  const { NeuroClient } = NeuroGameSdk

  const NEURO_SERVER_URL = 'ws://localhost:8000'
  const GAME_NAME = 'Guess the Number'

  const neuroClient = new NeuroClient(NEURO_SERVER_URL, GAME_NAME, () => {
    // Game initialization code. Check the example code
  })
</script>
```

## Quick Start Example

Here's an example of a simple game where Neuro-sama tries to guess a number between 1 and 10. When she guesses correctly, a new number is generated.

```javascript
import { NeuroClient } from 'neuro-game-sdk'

const NEURO_SERVER_URL = 'ws://localhost:8000'
const GAME_NAME = 'Guess the Number'

const neuroClient = new NeuroClient(NEURO_SERVER_URL, GAME_NAME, () => {
  neuroClient.registerActions([
    {
      name: 'guess_number',
      description: 'Guess the number between 1 and 10.',
      schema: {
        type: 'object',
        properties: {
          number: { type: 'integer', minimum: 1, maximum: 10 },
        },
        required: ['number'],
      },
    },
  ])

  let targetNumber = Math.floor(Math.random() * 10) + 1

  neuroClient.onAction(actionData => {
    if (actionData.name === 'guess_number') {
      const guessedNumber = actionData.params.number
      if (
        typeof guessedNumber !== 'number' ||
        guessedNumber < 1 ||
        guessedNumber > 10
      ) {
        neuroClient.sendActionResult(
          actionData.id,
          false,
          'Invalid number. Please guess a number between 1 and 10.'
        )
        return
      }

      if (guessedNumber === targetNumber) {
        neuroClient.sendActionResult(
          actionData.id,
          true,
          `Correct! The number was ${targetNumber}. Generating a new number.`
        )
        targetNumber = Math.floor(Math.random() * 10) + 1
        promptNeuroAction()
      } else {
        neuroClient.sendActionResult(
          actionData.id,
          true,
          `Incorrect. The number is ${
            guessedNumber < targetNumber ? 'higher' : 'lower'
          }. Try again.`
        )
        promptNeuroAction()
      }
    } else {
      neuroClient.sendActionResult(actionData.id, false, 'Unknown action.')
    }
  })

  neuroClient.sendContext(
    'Game started. I have picked a number between 1 and 10.',
    false
  )

  function promptNeuroAction() {
    const availableActions = ['guess_number']
    const query = 'Please guess a number between 1 and 10.'
    const state = 'Waiting for your guess.'
    neuroClient.forceActions(query, availableActions, state)
  }

  promptNeuroAction()
})
```

> Happy coding! <3 - ArieX

## Projects using this SDK

The following integrations use this SDK:

- [NeuroPilot](https://github.com/VSC-NeuroPilot/neuropilot) by VSC-NeuroPilot (Pasu4, KTrain5369, Frogneko)
