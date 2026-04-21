import { assert } from "chai";
import {
  CodexAppServerProcess,
  destroyCachedCodexAppServerProcess,
  extractCodexAppServerThreadId,
  extractCodexAppServerTurnId,
} from "../src/utils/codexAppServerProcess";

function createProcess(): CodexAppServerProcess {
  const ProcCtor = CodexAppServerProcess as unknown as {
    new (proc: unknown): CodexAppServerProcess;
  };
  return new ProcCtor({
    stdin: { write: () => {} },
    kill: () => {},
  });
}

describe("codexAppServerProcess", function () {
  it("extracts thread and turn IDs from both flat and nested response shapes", function () {
    assert.equal(
      extractCodexAppServerThreadId({ id: "thread-flat" }),
      "thread-flat",
    );
    assert.equal(
      extractCodexAppServerThreadId({ thread: { id: "thread-nested" } }),
      "thread-nested",
    );
    assert.equal(extractCodexAppServerTurnId({ id: "turn-flat" }), "turn-flat");
    assert.equal(
      extractCodexAppServerTurnId({ turn: { id: "turn-nested" } }),
      "turn-nested",
    );
  });

  it("serializes turn work on a shared process", async function () {
    const proc = createProcess();
    const order: string[] = [];
    let releaseFirst!: () => void;

    const first = proc.runTurnExclusive(async () => {
      order.push("first-start");
      await new Promise<void>((resolve) => {
        releaseFirst = resolve;
      });
      order.push("first-end");
      return "first";
    });

    const second = proc.runTurnExclusive(async () => {
      order.push("second-start");
      return "second";
    });

    await Promise.resolve();
    assert.deepEqual(order, ["first-start"]);

    releaseFirst();
    const results = await Promise.all([first, second]);

    assert.deepEqual(results, ["first", "second"]);
    assert.deepEqual(order, ["first-start", "first-end", "second-start"]);
  });

  it("destroys an explicit process when evicting a missing cache entry", function () {
    let killed = false;
    const ProcCtor = CodexAppServerProcess as unknown as {
      new (proc: unknown): CodexAppServerProcess;
    };
    const proc = new ProcCtor({
      stdin: { write: () => {} },
      kill: () => {
        killed = true;
      },
    });

    destroyCachedCodexAppServerProcess("missing-cache-key", proc);

    assert.isTrue(killed);
  });

  it("responds to server-initiated JSON-RPC requests via registered handlers", async function () {
    const writes: string[] = [];
    const ProcCtor = CodexAppServerProcess as unknown as {
      new (proc: unknown): CodexAppServerProcess;
    };
    const proc = new ProcCtor({
      stdin: {
        write: (chunk: string) => {
          writes.push(chunk);
        },
      },
      kill: () => {},
    });

    proc.onRequest("item/tool/call", async (params) => {
      assert.deepEqual(params, {
        callId: "call-1",
        tool: "query_library",
        arguments: { query: "transformers" },
      });
      return {
        contentItems: [{ type: "inputText", text: "done" }],
        success: true,
      };
    });

    await (proc as unknown as {
      handleMessage: (msg: Record<string, unknown>) => void;
    }).handleMessage({
      id: 7,
      method: "item/tool/call",
      params: {
        callId: "call-1",
        tool: "query_library",
        arguments: { query: "transformers" },
      },
    });

    await Promise.resolve();

    assert.deepEqual(
      JSON.parse(writes[0] || "{}"),
      {
        id: 7,
        result: {
          contentItems: [{ type: "inputText", text: "done" }],
          success: true,
        },
      },
    );
  });
});
