# @resonatehq/webserver

`@resonatehq/webserver` enables Resonate workers to expose an in-process web server, allowing developers to rapidly build and test proofs of concept without needing a standalone Resonate server running in a separate process.

## Quick Start

### Installation
```bash
npm install @resonatehq/webserver
```


### Example

```typescript
import { type Context, Resonate } from "@resonatehq/sdk";
import { Webserver } from "@resonatehq/webserver";


async function main() {
  const transport = new Webserver();
  transport.start();
  const resonate = new Resonate({ transport });

  resonate.register(fib, { version: 1 });
}


function* fib(ctx: Context, n: number): Generator {
  if (n <= 1) return n;
  const p1 = yield ctx.beginRpc(fib, n - 1, ctx.options({ id: `fib.${n - 1}` }));
  const p2 = yield ctx.beginRpc(fib, n - 2, ctx.options({ id: `fib.${n - 2}` }));
  return (yield p1) + (yield p2);
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
```

### Check the results
```bash
resonate promises get fib.5
```
