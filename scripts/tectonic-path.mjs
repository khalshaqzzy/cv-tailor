#!/usr/bin/env node

import { existsSync } from 'fs';
import { join, resolve } from 'path';
import { fileURLToPath } from 'url';
import { pluginRoot } from './lib/workspace.mjs';

export function getTectonicExecutablePath(root = pluginRoot) {
  const executableName = process.platform === 'win32' ? 'tectonic.exe' : 'tectonic';
  const executablePath = join(root, 'bin', executableName);
  if (!existsSync(executablePath)) {
    throw new Error(`Bundled Tectonic executable not found at ${executablePath}.`);
  }
  return executablePath;
}

if (resolve(fileURLToPath(import.meta.url)) === resolve(process.argv[1] || '')) {
  console.log(getTectonicExecutablePath());
}
