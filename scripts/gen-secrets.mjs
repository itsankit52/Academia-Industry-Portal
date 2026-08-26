#!/usr/bin/env node
import { randomBytes } from 'node:crypto';

const generate = () => randomBytes(48).toString('hex');

const access = generate();
const refresh = generate();

const output = `# Generated secrets (paste into .env)
JWT_ACCESS_SECRET=${access}
JWT_REFRESH_SECRET=${refresh}
`;

process.stdout.write(output);
