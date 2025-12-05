import type { Server as HttpServer } from "node:http";
import KoaRouter from "@koa/router";
import { LocalNetwork, type Network } from "@resonatehq/sdk/dist/src/core";
import type { ResonateError } from "@resonatehq/sdk/dist/src/exceptions";
import type { Request, ResponseFor } from "@resonatehq/sdk/dist/src/network/network";
import * as util from "@resonatehq/sdk/dist/src/util";
import Koa, { type Context } from "koa";
import bodyParser from "koa-bodyparser";

export class Webserver implements Network {
  private network: Network;
  private port: number;
  private koa: Koa;
  private webapp?: HttpServer;

  constructor({ port = 8001, network = undefined }: { port?: number; network?: Network } = {}) {
    this.network = network ?? new LocalNetwork();

    this.port = port;

    this.koa = new Koa();
    const router = this.initializeRoutes(new KoaRouter());
    this.koa.use(bodyParser());
    this.koa.use(router.routes());
    this.koa.use(router.allowedMethods());
  }

  start(): void {
    this.webapp = this.koa.listen(this.port, () => {
      console.debug(`starting http server on port=:${this.port}`);
    });
  }

  stop(): void {
    if (this.webapp !== undefined) this.webapp.close();
    this.network.stop();
  }

  send<T extends Request>(req: T, callback: (err?: ResonateError, res?: ResponseFor<T>) => void): void {
    this.network.send(req, callback);
  }

  private initializeRoutes(router: KoaRouter): KoaRouter {
    router.get("/promises", async (ctx: Context) => {
      const res = await this.sendAsync({ kind: "searchPromises", id: ctx.query.id as string });
      ctx.status = 200;
      ctx.type = "application/json";
      ctx.body = { promises: res.promises };
    });

    router.post("/promises", async (ctx: Context) => {
      const { id, param, tags, timeout } = ctx.request.body as {
        id: string;
        param: any;
        tags: Record<string, string>;
        timeout: number;
      };
      const res = await this.sendAsync({
        kind: "createPromise",
        id,
        param,
        tags,
        timeout,
        strict: (ctx.request.headers.strict as string) === "true",
        iKey: ctx.request.headers["idempotency-key"] as string,
      });
      ctx.status = 201;
      ctx.type = "application/json";
      ctx.body = res.promise;
    });

    router.post("/promises/task", async (ctx: Context) => {
      const { promise, task } = ctx.request.body as {
        promise: { id: string; timeout: number; param: any; tags: Record<string, string> };
        task: { processId: string; ttl: number };
      };
      const res = await this.sendAsync({
        kind: "createPromiseAndTask",
        promise,
        task,
        iKey: ctx.request.headers["idempotency-key"] as string,
        strict: (ctx.request.headers.strict as string) === "true",
      });

      ctx.type = "application/json";
      ctx.status = res.task === undefined ? 200 : 201;
      ctx.body = { promise: res.promise, task: res.task };
    });

    router.get("/promises/:id", async (ctx: Context) => {
      const res = await this.sendAsync({ kind: "readPromise", id: ctx.params.id as string });
      ctx.status = 200;
      ctx.type = "application/json";
      ctx.body = res.promise;
    });

    router.patch("/promises/:id", async (ctx: Context) => {
      const { state, value } = ctx.request.body as {
        state: string;
        value: any;
      };
      const res = await this.sendAsync({
        kind: "completePromise",
        id: ctx.params.id as string,
        state: state.toLowerCase() as "resolved" | "rejected" | "rejected_canceled",
        value,
        iKey: ctx.request.headers["idempotency-key"] as string,
        strict: (ctx.request.headers.strict as string) === "true",
      });

      ctx.status = 200;
      ctx.type = "application/json";
      ctx.body = res.promise;
    });

    router.post("/promises/callback/:id", async (ctx: Context) => {
      const promiseId = ctx.params.id as string;
      const { rootPromiseId, timeout, recv } = ctx.request.body as {
        rootPromiseId: string;
        timeout: number;
        recv: string;
      };

      const res = await this.sendAsync({ kind: "createCallback", promiseId, rootPromiseId, timeout, recv });
      ctx.status = 200;
      ctx.type = "application/json";
      ctx.body = { promise: res.promise, callback: res.callback };
    });

    router.post("/promises/subscribe/:id", async (ctx: Context) => {
      const promiseId = ctx.params.id as string;
      const { id, timeout, recv } = ctx.request.body as {
        id: string;
        timeout: number;
        recv: string;
      };
      const res = await this.sendAsync({ kind: "createSubscription", id, promiseId, timeout, recv });

      ctx.status = res.callback === undefined ? 200 : 201;
      ctx.type = "application/json";
      ctx.body = res;
    });

    router.get("/schedules", async (ctx: Context) => {
      const res = await this.sendAsync({ kind: "searchSchedules", id: ctx.query.id as string });
      ctx.status = 200;
      ctx.type = "application/json";
      ctx.body = { schedules: res.schedules };
    });

    router.post("/schedules", async (ctx: Context) => {
      const { id, description, cron, tags, promiseId, promiseTimeout, promiseParam, promiseTags } = ctx.request
        .body as {
        id: string;
        description: string;
        cron: string;
        tags: Record<string, string>;
        promiseId: string;
        promiseTimeout: number;
        promiseParam: any; // Assuming 'Value' schema translates to 'any' here
        promiseTags: Record<string, string>;
        idempotencyKey: string;
      };

      const res = await this.sendAsync({
        kind: "createSchedule",
        id,
        cron,
        promiseId,
        promiseTimeout,
        iKey: ctx.request.headers["idempotency-key"] as string,
        description,
        tags,
        promiseParam,
        promiseTags,
      });

      ctx.status = 200;
      ctx.type = "application/json";
      ctx.body = res;
    });

    router.get("/schedules/:id", async (ctx: Context) => {
      const res = await this.sendAsync({ kind: "readSchedule", id: ctx.params.id as string });
      ctx.status = 200;
      ctx.type = "application/json";
      ctx.body = res;
    });

    router.delete("/schedules/:id", async (ctx: Context) => {
      const res = await this.sendAsync({ kind: "deleteSchedule", id: ctx.params.id as string });
      ctx.status = 204;
      ctx.type = "application/json";
    });

    router.post("/tasks/claim", async (ctx: Context) => {
      const { id, counter, processId, ttl } = ctx.request.body as {
        id: string;
        counter: number;
        processId: string;
        ttl: number;
      };
      const res = await this.sendAsync({ kind: "claimTask", id, counter, processId, ttl });
      ctx.body = { type: res.message.kind, promises: res.message.promises };
      ctx.status = 201;
      ctx.type = "application/json";
    });
    router.post("/tasks/complete", async (ctx: Context) => {
      const { id, counter } = ctx.request.body as {
        id: string;
        counter: number;
      };
      const res = await this.sendAsync({ kind: "completeTask", id, counter });
      ctx.body = res.task;
      ctx.status = 201;
      ctx.type = "application/json";
    });
    router.post("/tasks/heartbeat", async (ctx: Context) => {
      const { processId } = ctx.request.body as {
        processId: string;
      };
      const res = await this.sendAsync({ kind: "heartbeatTasks", processId });
      ctx.body = res.tasksAffected;
      ctx.status = 200;
      ctx.type = "application/json";
    });

    return router;
  }

  private sendAsync<T extends Request>(message: T): Promise<ResponseFor<T>> {
    return new Promise((resolve, reject) => {
      this.send(message, (err, res) => {
        if (err !== undefined) {
          util.assert(res === undefined);
          reject(err);
        } else {
          util.assertDefined(res);
          resolve(res);
        }
      });
    });
  }
}
