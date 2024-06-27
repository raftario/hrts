import type { ModuleFormat } from "node:module"
import path from "node:path"

import ts from "typescript"

import { TypeScriptError } from "./errors.js"

export interface TSConfig extends ts.ParsedCommandLine {
	path: string
}
function tsconfig(
	file: string,
	defaults: string | undefined,
): TSConfig | undefined {
	let dir = path.dirname(file)
	let errors: ts.Diagnostic[] = []
	const onUnRecoverableConfigFileDiagnostic = (error: ts.Diagnostic) => {
		errors.push(error)
	}

	while (dir !== path.dirname(dir)) {
		const source = path.join(dir, "tsconfig.json")
		const config = ts.getParsedCommandLineOfConfigFile(source, undefined, {
			...ts.sys,
			onUnRecoverableConfigFileDiagnostic,
		})
		if (
			config !== undefined &&
			errors.length === 0 &&
			config.fileNames.map((f) => path.resolve(f)).includes(file)
		) {
			return { ...config, path: source }
		}

		dir = path.dirname(dir)
		errors = []
	}

	if (defaults !== undefined) {
		defaults = path.resolve(defaults)

		const config = ts.getParsedCommandLineOfConfigFile(defaults, undefined, {
			...ts.sys,
			onUnRecoverableConfigFileDiagnostic,
		})
		if (config !== undefined && errors.length === 0) {
			return { ...config, path: defaults }
		}
	}

	return undefined
}

function moduleFormat(
	file: ts.SourceFile,
	options: ts.CompilerOptions,
): ModuleFormat | undefined {
	if (
		options.module! >= ts.ModuleKind.ES2015 &&
		options.module! <= ts.ModuleKind.ESNext
	) {
		return "module"
	} else if (options.module === ts.ModuleKind.CommonJS) {
		return "commonjs"
	} else if (
		options.module! >= ts.ModuleKind.Node16 &&
		options.module! <= ts.ModuleKind.NodeNext
	) {
		if (file.impliedNodeFormat !== undefined) {
			if (
				file.impliedNodeFormat >= ts.ModuleKind.ES2015 &&
				file.impliedNodeFormat <= ts.ModuleKind.ESNext
			) {
				return "module"
			} else if (file.impliedNodeFormat === ts.ModuleKind.CommonJS) {
				return "commonjs"
			}
		} else {
			const ext = path.extname(file.fileName)
			if (ext === ".mts") {
				return "module"
			} else if (ext === ".cts") {
				return "commonjs"
			}
		}
	}

	return undefined
}

function patchOptions(
	options: ts.CompilerOptions,
	check: boolean,
): ts.CompilerOptions {
	options.suppressOutputPathCheck = true

	options.emitBOM = false
	options.emitDeclarationOnly = false
	options.inlineSourceMap = true
	options.noEmit = false
	options.outFile = undefined
	options.sourceMap = false

	// eslint-disable-next-line deprecation/deprecation
	options.out = undefined

	if (options.module === undefined && options.moduleResolution === undefined) {
		options.module = ts.ModuleKind.Node16
		options.moduleResolution = ts.ModuleResolutionKind.Node16
	}
	options.target ??= ts.ScriptTarget.ES2023

	if (!check) {
		options.noCheck = true
	}

	return options
}
function defaultOptions(): ts.CompilerOptions {
	return {
		strict: true,
		allowImportingTsExtensions: true,
	}
}

export interface Options {
	/** Whether to type check or not */
	check?: boolean
	/** Path to the default tsconfig file to use if none is found */
	defaults?: string
}

export function resolve(
	name: string,
	parent: string,
	{ defaults }: Options,
): string | undefined {
	parent = path.resolve(parent)

	const config = tsconfig(parent, defaults)
	const options = patchOptions(config?.options ?? defaultOptions(), false)

	const resolved = ts.resolveModuleName(name, parent, options, ts.sys)
	if (
		resolved.resolvedModule?.resolvedFileName !== undefined &&
		/(?<!\.d)\.[cm]?ts$/.test(resolved.resolvedModule.resolvedFileName)
	) {
		return resolved.resolvedModule.resolvedFileName
	} else {
		return undefined
	}
}

export interface CompileOutput {
	source: string
	format: ModuleFormat
}
export function compile(
	file: string,
	format: ModuleFormat | null | undefined,
	{ check = true, defaults }: Options,
): CompileOutput {
	file = path.resolve(file)

	const config = tsconfig(file, defaults)
	const options = patchOptions(config?.options ?? defaultOptions(), check)

	let output: CompileOutput | undefined
	const host: ts.CompilerHost = {
		...ts.createCompilerHost(options),
		writeFile: (file, content) => {
			if (!/\.[cm]?js$/.test(file)) {
				return
			}

			if (output !== undefined) {
				throw new TypeScriptError("Multiple compilation outputs", {
					file,
					tsconfig: config?.path,
				})
			}

			output = {
				source: content,
				format: moduleFormat(source!, options) ?? format ?? "commonjs",
			}
		},
	}

	if (config?.projectReferences?.length) {
		ts.createSolutionBuilder(
			ts.createSolutionBuilderHost(),
			[config.path],
			options as ts.BuildOptions,
		).buildReferences(config.path)
	}

	const program = ts.createProgram({
		rootNames: [file],
		options,
		projectReferences: config?.projectReferences,
		host,
		configFileParsingDiagnostics: config?.errors,
	})
	const source = program.getSourceFile(file)
	const emitted = program.emit(source)

	const diagnostics = emitted.diagnostics.slice()
	if (check) {
		diagnostics.unshift(...ts.getPreEmitDiagnostics(program, source))
	}
	const errors = diagnostics
		.filter(({ category }) => category === ts.DiagnosticCategory.Error)
		.filter(({ code }) => code !== 5096)

	if (errors.length > 0) {
		throw new TypeScriptError("Compilation error", {
			file,
			tsconfig: config?.path,
			diagnostics: errors,
		})
	}
	if (output === undefined) {
		throw new TypeScriptError("No compilation output", {
			file,
			tsconfig: config?.path,
		})
	}

	return output
}
