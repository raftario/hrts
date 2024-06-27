# `hrts`

A dumb TypeScript loader for modern Node.js

```sh
# Node.js >=20.6.0
npm i hrts
node --import hrts ./app.ts
```

## why

- `hrts` uses the locally installed `typescript` module and works like `tsc`. it type checks (unless you tell it not to).
- `hrts` does not try to be smart. it does what you would expect it to do and nothing more. it's ~300 lines of code with no dependencies.
- `hrts` targets modern Node.js. it uses the [`node:module` customization hooks API](https://nodejs.org/docs/latest-v20.x/api/module.html#customization-hooks) to support both ESM and CommonJS and doesn't monkey patch anything.
- the name is pretty good.

## how

### type checked

```sh
node --import hrts ./app.ts
```

### not type checked

```sh
node --import hrts/nocheck ./app.ts
```

### custom options

```js
import register from "hrts/register.js"
register({
	check: process.env.NODE_ENV !== "production",
	defaults: "./tsconfig.defaults.json",
})

await import("./app.ts")
```

## recommendations

- set `"type": "module"` in your `package.json`. there are no reasons not to in a modern Node.js application.
- set `"module": "Node16"` or `"module": "NodeNext"` in your `tsconfig.json`. other values are not suitable for modern Node.js.
- set the `--enable-source-maps` flag when running your application to get accurate stack traces.
- don't use `hrts` (or any other TypeScript loader for that matter) if performance is a concern.

## config resolution

`hrts` looks for a `tsconfig.json` file in the same directory as the file being imported, then in every parent directory, until it finds one that is valid for the file.

If none is found, it falls back the provided default file. If no default is provided or if the default file is invalid, it falls back to a set of default options suitable for modern Node.js.

```json
{
	"module": "Node16",
	"target": "ES2023",
	"strict": true,
	"allowImportingTsExtensions": true
}
```

The file is then compiled with that exact config (with the bare minimum patches to function as a loader). No effort is made to be smart about it and go from ESM to CommonJS or vice versa. What you get is what you get.
