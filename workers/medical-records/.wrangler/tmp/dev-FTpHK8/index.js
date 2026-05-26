var __defProp = Object.defineProperty;
var __name = (target, value) => __defProp(target, "name", { value, configurable: true });

// src/index.ts
function corsHeaders(origin, env) {
  const allowed = env.ALLOWED_ORIGIN?.trim();
  const value = allowed && origin === allowed ? origin : allowed || "*";
  return {
    "Access-Control-Allow-Origin": value,
    "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
    "Access-Control-Allow-Headers": "Authorization, Content-Type, X-Storage-Path",
    "Access-Control-Max-Age": "86400"
  };
}
__name(corsHeaders, "corsHeaders");
function jsonResponse(body, status, origin, env) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json",
      ...corsHeaders(origin, env)
    }
  });
}
__name(jsonResponse, "jsonResponse");
async function getAuthUser(request, env) {
  const auth = request.headers.get("Authorization");
  if (!auth?.startsWith("Bearer ")) return null;
  if (!env.SUPABASE_URL || !env.SUPABASE_ANON_KEY) return null;
  const res = await fetch(`${env.SUPABASE_URL.replace(/\/$/, "")}/auth/v1/user`, {
    headers: {
      Authorization: auth,
      apikey: env.SUPABASE_ANON_KEY
    }
  });
  if (!res.ok) return null;
  const user = await res.json();
  return user.id ? { id: user.id } : null;
}
__name(getAuthUser, "getAuthUser");
function assertOwnsPath(userId, storagePath) {
  const prefix = `${userId}/`;
  if (!storagePath.startsWith(prefix) || storagePath.includes("..")) {
    throw new Error("Forbidden");
  }
}
__name(assertOwnsPath, "assertOwnsPath");
function safeFileName(fileName) {
  return fileName.replace(/[^\w.\-() ]+/g, "_").slice(0, 200);
}
__name(safeFileName, "safeFileName");
function storagePathFor(userId, fileName) {
  return `${userId}/${crypto.randomUUID()}-${safeFileName(fileName)}`;
}
__name(storagePathFor, "storagePathFor");
function workerOrigin(request) {
  return new URL(request.url).origin;
}
__name(workerOrigin, "workerOrigin");
var src_default = {
  async fetch(request, env) {
    const origin = request.headers.get("Origin");
    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: corsHeaders(origin, env) });
    }
    const url = new URL(request.url);
    const pathname = url.pathname.replace(/\/+$/, "") || "/";
    if ((pathname === "/" || pathname === "/health") && request.method === "GET") {
      return jsonResponse(
        {
          ok: true,
          service: "elix-medical-records",
          message: "Use the Elix app while signed in; API routes require Authorization: Bearer <supabase_token>."
        },
        200,
        origin,
        env
      );
    }
    try {
      const user = await getAuthUser(request, env);
      if (!user) {
        return jsonResponse(
          {
            error: "Unauthorized",
            hint: "Send Authorization: Bearer <supabase_access_token> from a signed-in patient session."
          },
          401,
          origin,
          env
        );
      }
      if (pathname === "/v1/records/upload-url" && request.method === "POST") {
        const body = await request.json();
        if (!body.fileName?.trim() || !body.contentType?.trim()) {
          return jsonResponse({ error: "fileName and contentType are required" }, 400, origin, env);
        }
        const contentLength = Number(body.contentLength ?? 0);
        if (!contentLength || contentLength > 10 * 1024 * 1024) {
          return jsonResponse({ error: "File must be between 1 byte and 10 MB" }, 400, origin, env);
        }
        const storagePath = storagePathFor(user.id, body.fileName.trim());
        return jsonResponse(
          {
            uploadUrl: `${workerOrigin(request)}/v1/records/object`,
            storagePath,
            storageBucket: env.R2_BUCKET_NAME || "medical-records"
          },
          200,
          origin,
          env
        );
      }
      if (pathname === "/v1/records/object" && request.method === "PUT") {
        const storagePath = request.headers.get("X-Storage-Path")?.trim();
        if (!storagePath) {
          return jsonResponse({ error: "X-Storage-Path header is required" }, 400, origin, env);
        }
        assertOwnsPath(user.id, storagePath);
        const contentType = request.headers.get("Content-Type") || "application/octet-stream";
        if (!request.body) {
          return jsonResponse({ error: "Request body is required" }, 400, origin, env);
        }
        await env.MEDICAL_RECORDS.put(storagePath, request.body, {
          httpMetadata: { contentType }
        });
        return jsonResponse({ ok: true }, 200, origin, env);
      }
      if (pathname === "/v1/records/download" && request.method === "POST") {
        const body = await request.json();
        if (!body.storagePath?.trim()) {
          return jsonResponse({ error: "storagePath is required" }, 400, origin, env);
        }
        const storagePath = body.storagePath.trim();
        assertOwnsPath(user.id, storagePath);
        const object = await env.MEDICAL_RECORDS.get(storagePath);
        if (!object) {
          return jsonResponse({ error: "File not found" }, 404, origin, env);
        }
        const headers = new Headers(corsHeaders(origin, env));
        headers.set("Content-Type", object.httpMetadata?.contentType ?? "application/octet-stream");
        if (object.size) {
          headers.set("Content-Length", String(object.size));
        }
        return new Response(object.body, { status: 200, headers });
      }
      if (pathname === "/v1/records/object" && request.method === "DELETE") {
        const body = await request.json();
        if (!body.storagePath?.trim()) {
          return jsonResponse({ error: "storagePath is required" }, 400, origin, env);
        }
        const storagePath = body.storagePath.trim();
        assertOwnsPath(user.id, storagePath);
        await env.MEDICAL_RECORDS.delete(storagePath);
        return jsonResponse({ ok: true }, 200, origin, env);
      }
      return jsonResponse({ error: "Not found" }, 404, origin, env);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Request failed";
      const status = message === "Forbidden" ? 403 : 500;
      return jsonResponse({ error: message }, status, origin, env);
    }
  }
};

// node_modules/wrangler/templates/middleware/middleware-ensure-req-body-drained.ts
var drainBody = /* @__PURE__ */ __name(async (request, env, _ctx, middlewareCtx) => {
  try {
    return await middlewareCtx.next(request, env);
  } finally {
    try {
      if (request.body !== null && !request.bodyUsed) {
        const reader = request.body.getReader();
        while (!(await reader.read()).done) {
        }
      }
    } catch (e) {
      console.error("Failed to drain the unused request body.", e);
    }
  }
}, "drainBody");
var middleware_ensure_req_body_drained_default = drainBody;

// node_modules/wrangler/templates/middleware/middleware-miniflare3-json-error.ts
function reduceError(e) {
  return {
    name: e?.name,
    message: e?.message ?? String(e),
    stack: e?.stack,
    cause: e?.cause === void 0 ? void 0 : reduceError(e.cause)
  };
}
__name(reduceError, "reduceError");
var jsonError = /* @__PURE__ */ __name(async (request, env, _ctx, middlewareCtx) => {
  try {
    return await middlewareCtx.next(request, env);
  } catch (e) {
    const error = reduceError(e);
    return Response.json(error, {
      status: 500,
      headers: { "MF-Experimental-Error-Stack": "true" }
    });
  }
}, "jsonError");
var middleware_miniflare3_json_error_default = jsonError;

// .wrangler/tmp/bundle-MKh6ii/middleware-insertion-facade.js
var __INTERNAL_WRANGLER_MIDDLEWARE__ = [
  middleware_ensure_req_body_drained_default,
  middleware_miniflare3_json_error_default
];
var middleware_insertion_facade_default = src_default;

// node_modules/wrangler/templates/middleware/common.ts
var __facade_middleware__ = [];
function __facade_register__(...args) {
  __facade_middleware__.push(...args.flat());
}
__name(__facade_register__, "__facade_register__");
function __facade_invokeChain__(request, env, ctx, dispatch, middlewareChain) {
  const [head, ...tail] = middlewareChain;
  const middlewareCtx = {
    dispatch,
    next(newRequest, newEnv) {
      return __facade_invokeChain__(newRequest, newEnv, ctx, dispatch, tail);
    }
  };
  return head(request, env, ctx, middlewareCtx);
}
__name(__facade_invokeChain__, "__facade_invokeChain__");
function __facade_invoke__(request, env, ctx, dispatch, finalMiddleware) {
  return __facade_invokeChain__(request, env, ctx, dispatch, [
    ...__facade_middleware__,
    finalMiddleware
  ]);
}
__name(__facade_invoke__, "__facade_invoke__");

// .wrangler/tmp/bundle-MKh6ii/middleware-loader.entry.ts
var __Facade_ScheduledController__ = class ___Facade_ScheduledController__ {
  constructor(scheduledTime, cron, noRetry) {
    this.scheduledTime = scheduledTime;
    this.cron = cron;
    this.#noRetry = noRetry;
  }
  static {
    __name(this, "__Facade_ScheduledController__");
  }
  #noRetry;
  noRetry() {
    if (!(this instanceof ___Facade_ScheduledController__)) {
      throw new TypeError("Illegal invocation");
    }
    this.#noRetry();
  }
};
function wrapExportedHandler(worker) {
  if (__INTERNAL_WRANGLER_MIDDLEWARE__ === void 0 || __INTERNAL_WRANGLER_MIDDLEWARE__.length === 0) {
    return worker;
  }
  for (const middleware of __INTERNAL_WRANGLER_MIDDLEWARE__) {
    __facade_register__(middleware);
  }
  const fetchDispatcher = /* @__PURE__ */ __name(function(request, env, ctx) {
    if (worker.fetch === void 0) {
      throw new Error("Handler does not export a fetch() function.");
    }
    return worker.fetch(request, env, ctx);
  }, "fetchDispatcher");
  return {
    ...worker,
    fetch(request, env, ctx) {
      const dispatcher = /* @__PURE__ */ __name(function(type, init) {
        if (type === "scheduled" && worker.scheduled !== void 0) {
          const controller = new __Facade_ScheduledController__(
            Date.now(),
            init.cron ?? "",
            () => {
            }
          );
          return worker.scheduled(controller, env, ctx);
        }
      }, "dispatcher");
      return __facade_invoke__(request, env, ctx, dispatcher, fetchDispatcher);
    }
  };
}
__name(wrapExportedHandler, "wrapExportedHandler");
function wrapWorkerEntrypoint(klass) {
  if (__INTERNAL_WRANGLER_MIDDLEWARE__ === void 0 || __INTERNAL_WRANGLER_MIDDLEWARE__.length === 0) {
    return klass;
  }
  for (const middleware of __INTERNAL_WRANGLER_MIDDLEWARE__) {
    __facade_register__(middleware);
  }
  return class extends klass {
    #fetchDispatcher = /* @__PURE__ */ __name((request, env, ctx) => {
      this.env = env;
      this.ctx = ctx;
      if (super.fetch === void 0) {
        throw new Error("Entrypoint class does not define a fetch() function.");
      }
      return super.fetch(request);
    }, "#fetchDispatcher");
    #dispatcher = /* @__PURE__ */ __name((type, init) => {
      if (type === "scheduled" && super.scheduled !== void 0) {
        const controller = new __Facade_ScheduledController__(
          Date.now(),
          init.cron ?? "",
          () => {
          }
        );
        return super.scheduled(controller);
      }
    }, "#dispatcher");
    fetch(request) {
      return __facade_invoke__(
        request,
        this.env,
        this.ctx,
        this.#dispatcher,
        this.#fetchDispatcher
      );
    }
  };
}
__name(wrapWorkerEntrypoint, "wrapWorkerEntrypoint");
var WRAPPED_ENTRY;
if (typeof middleware_insertion_facade_default === "object") {
  WRAPPED_ENTRY = wrapExportedHandler(middleware_insertion_facade_default);
} else if (typeof middleware_insertion_facade_default === "function") {
  WRAPPED_ENTRY = wrapWorkerEntrypoint(middleware_insertion_facade_default);
}
var middleware_loader_entry_default = WRAPPED_ENTRY;
export {
  __INTERNAL_WRANGLER_MIDDLEWARE__,
  middleware_loader_entry_default as default
};
//# sourceMappingURL=index.js.map
