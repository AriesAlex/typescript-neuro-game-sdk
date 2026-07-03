//@ts-check
import { readFileSync, writeFileSync } from 'node:fs';

import pkg from './package.json' with { type: 'json' };

/** @type {{ version: string }} */
const json = JSON.parse(readFileSync('./jsr.json').toString('utf-8'));

json.version = pkg.version;
writeFileSync('./jsr.json', JSON.stringify(json, null, 4) + '\n')
