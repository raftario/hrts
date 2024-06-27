import os from "node:os"
import path from "node:path"
import process from "node:process"

import ts from "typescript"

const cwd = process.cwd()
const host: ts.FormatDiagnosticsHost = {
	getCurrentDirectory: () => cwd,
	getCanonicalFileName: (filename) => {
		const relative = path.relative(cwd, filename)
		if (!relative.startsWith("..")) {
			return relative
		} else {
			return filename
		}
	},
	getNewLine: () => os.EOL,
}

export interface TypeScriptErrorOptions extends ErrorOptions {
	file: string
	tsconfig?: string
	diagnostics?: ts.Diagnostic[]
}
export class TypeScriptError extends Error {
	readonly file: string
	readonly tsconfig?: string
	readonly diagnostics?: ts.Diagnostic[]

	constructor(message: string, options: TypeScriptErrorOptions) {
		message += ` at ${host.getCanonicalFileName(options.file)}`
		if (options.tsconfig !== undefined) {
			message += ` (using ${host.getCanonicalFileName(options.tsconfig)})`
		} else {
			message += ` (using module Node16 and target ES2023)`
		}

		if (options.diagnostics !== undefined) {
			message = [
				message,
				null,
				ts.formatDiagnostics(options.diagnostics, host).trim(),
				null,
			].join(os.EOL)
		}

		super(message, options)
		this.name = "TypeScriptError"
		Error.captureStackTrace(this, TypeScriptError)

		this.file = options.file
		if (options.tsconfig !== undefined) {
			this.tsconfig = options.tsconfig
		}
		if (options.diagnostics !== undefined) {
			this.diagnostics = options.diagnostics
		}
	}
}
