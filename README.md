# @resonatehq/webserver

`@resonatehq/webserver` is a transport binding for [Resonate](https://github.com/resonatehq/resonate) that exposes a webserver, enabling usage of the Resonate CLI without the requirement of a server.

## Quick Start

### Install
```bash
npm install @resonatehq/webserver
```

### Run

**app.ts**
```ts
import { type Context, Resonate } from "@resonatehq/sdk";
import { Webserver } from "@resonatehq/webserver";

async function main() {
  const transport = new Webserver();
  transport.start();

  const resonate = new Resonate({ transport });
  resonate.register(fib);
}

function* fib(ctx: Context, n: number): Generator {
  if (n <= 1) return n;

  const p1 = yield ctx.beginRpc(fib, n-1, ctx.options({ id: `fib.${n-1}` }));
  const p2 = yield ctx.beginRpc(fib, n-2, ctx.options({ id: `fib.${n-2}` }));

  return (yield p1) + (yield p2);
}

main();
```

Install the CLI:
```bash
brew install resonatehq/tap/resonate
```
You can also download the [latest release](https://github.com/resonatehq/resonate/releases/latest).

Start the app:
```bash
npx ts-node app.ts
```

Invoke a function:
```bash
resonate invoke fib.5 --func fib --arg 5
```

Check the result:
```bash
resonate promises get fib.5
```
