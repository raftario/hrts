import fastify from "fastify"

import { LISTEN } from "./options.ts"

const server = fastify({ logger: true })

server.get<{ Params: { name: string } }>("/hello/:name", (req) => {
	return `Hello ${req.params.name} !`
})

server.get("/error", () => {
	throw new Error()
})

try {
	await server.listen(LISTEN)
} catch (error) {
	console.error(error)
	process.exitCode = 1
}
