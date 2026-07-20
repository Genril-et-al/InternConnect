/**
 * Lets plain `node` run the app's TypeScript the same way Vite does.
 *
 * Node 24 strips types on its own, but unlike a bundler it insists on file
 * extensions in relative imports. App source writes `./skillTaxonomy`, so this
 * hook retries a failed resolve with `.ts` (then `/index.ts`) appended.
 *
 * No dependencies, no build step, nothing to install.
 */

import { register } from 'node:module'
import { pathToFileURL } from 'node:url'

if (!process.env.__TS_RESOLVE__) {
  process.env.__TS_RESOLVE__ = '1'
  register(pathToFileURL(import.meta.filename))
}

export async function resolve(specifier, context, next) {
  try {
    return await next(specifier, context)
  } catch (err) {
    if (!specifier.startsWith('.')) throw err
    for (const suffix of ['.ts', '.tsx', '/index.ts']) {
      try {
        return await next(specifier + suffix, context)
      } catch {
        // try the next candidate
      }
    }
    throw err
  }
}
