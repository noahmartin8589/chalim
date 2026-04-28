const TARGET_BASE = (process.env.TARGET_DOMAIN || "").replace(/\/$/, "");

const STRIP_HEADERS = new Set([
  "host",
  "proxy-authenticate",
  "proxy-authorization",
  "te",
  "trailer",
  "transfer-encoding",
  "upgrade",
  "forwarded",
  "x-forwarded-host",
  "x-forwarded-proto",
  "x-forwarded-port",
]);

export default async function handler(req) {
  if (!TARGET_BASE) {
    return new Response("Misconfigured: TARGET_DOMAIN is not set", { status: 500 });
  }

  try {
    const url = new URL(req.url, `http://${req.headers.get('host') || 'localhost'}`);
    const targetUrl = TARGET_BASE + url.pathname + url.search;

    const outHeaders = new Headers();
    let clientIp = null;

    for (const [k, v] of req.headers.entries()) {
      const lowerKey = k.toLowerCase();
      if (STRIP_HEADERS.has(lowerKey)) continue;
      if (lowerKey.startsWith("x-vercel-")) continue;
      
      if (lowerKey === "x-real-ip") {
        clientIp = v;
        continue;
      }
      if (lowerKey === "x-forwarded-for") {
        if (!clientIp) clientIp = v;
        continue;
      }
      outHeaders.set(k, v);
    }

    if (clientIp) outHeaders.set("x-forwarded-for", clientIp);

    const response = await fetch(targetUrl, {
      method: req.method,
      headers: outHeaders,
      body: req.method !== "GET" && req.method !== "HEAD" ? req.body : undefined,
      redirect: "manual",
      duplex: "half"
    });

    return response;
  } catch (err) {
    console.error("Relay error:", err);
    return new Response("Bad Gateway", { status: 502 });
  }
}