# @resonatehq/webserver

`@resonatehq/webserver` allows Resonate workers to expose an in-process webserver. Enabling developers to quickly do proof of concepts without the need of an actuall Resonate server running in a different process.

## Quick Start

### Installation
```bash
npm install @resonatehq/webserver
```


### Example

```typescript
import { type Context, Resonate } from "@resonatehq/sdk";
import { Webserver } from "@resonatehq/webserver";

function* foo(ctx: Context): Generator {
  const v = yield* ctx.run(bar);
  return v;
}

function bar(ctx: Context): string {
  console.log("hello world!");
  return "hello world";
}

function* fib(ctx: Context, n: number): Generator {
  if (n <= 1) return n;
  const p1 = yield ctx.beginRpc(fib, n - 1, ctx.options({ id: `fib.${n - 1}` }));
  const p2 = yield ctx.beginRpc(fib, n - 2, ctx.options({ id: `fib.${n - 2}` }));
  return (yield p1) + (yield p2);
}
async function main() {
  const webserver = new Webserver();
  webserver.start();
  const resonate = new Resonate({ transport: webserver });

  resonate.register(foo, { version: 1 });
  resonate.register(fib, { version: 1 });
}
main();
```

### Run the Application
```bash
npx ts-node app.ts
```

### Invoke your functions
```bash
resonate invoke fib.5 --func fib --arg 5
resonate invoke foo.1 --func foo --arg 1
```

### Check the results
```bash
resonate promises get fib.5
resonate promises get foo.1
```
