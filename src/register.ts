import module from "node:module"

import type { Options } from "./compiler.js"

export function register(options: Options = {}) {
	module.register<Options>("./hooks.js", import.meta.url, {
		data: options,
		parentURL: import.meta.url,
	})
}
export default register

export type { Options } from "./compiler.js"
export { TypeScriptError as TypescriptError } from "./errors.js"
