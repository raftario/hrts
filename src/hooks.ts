import type { InitializeHook, LoadHook, ResolveHook } from "node:module"
import url from "node:url"

import type { Options } from "./compiler.js"
import * as c from "./compiler.js"

let OPTIONS: Options
export const initialize: InitializeHook<Options> = function initialize(
	options,
) {
	OPTIONS = options
}

export const resolve: ResolveHook = function resolve(specifier, context, next) {
	if (
		context.parentURL === undefined ||
		!context.parentURL.startsWith("file:") ||
		!/\.[cm]?ts$/.test(context.parentURL)
	) {
		return next(specifier, context)
	}

	const name =
		specifier.startsWith("file:") ? url.fileURLToPath(specifier) : specifier
	const parent = url.fileURLToPath(context.parentURL)
	const output = c.resolve(name, parent, OPTIONS)

	if (output !== undefined) {
		return {
			url: url.pathToFileURL(output).href,
			importAttributes: context.importAttributes,
			shortCircuit: true,
		}
	} else {
		return next(specifier, context)
	}
}

export const load: LoadHook = function load(specifier, context, next) {
	if (!specifier.startsWith("file:") || !/\.[cm]?ts$/.test(specifier)) {
		return next(specifier, context)
	}

	const file = url.fileURLToPath(specifier)
	const output = c.compile(file, context.format, OPTIONS)
	return { source: output.source, format: output.format, shortCircuit: true }
}
