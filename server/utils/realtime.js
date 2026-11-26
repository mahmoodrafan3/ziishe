// Server-sent events hub.
//
// The storefront keeps one open connection per browser tab. When the admin
// creates, edits or deletes something, the affected route broadcasts a small
// signal and every open storefront refetches that data — no page reload needed.
const clients = new Set();
const HEARTBEAT_MS = 25_000;

const safeWrite = (res, chunk) => {
  try {
    res.write(chunk);
  } catch {
    clients.delete(res);
  }
};

// Registers an SSE response. Returns a cleanup function.
export const subscribe = (req, res) => {
  res.set({
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache, no-transform',
    Connection: 'keep-alive',
    // Stop reverse proxies (Render, nginx) from buffering the stream.
    'X-Accel-Buffering': 'no',
  });
  res.flushHeaders?.();
  // Ask the browser to retry after 5s if the connection drops.
  res.write('retry: 5000\n\n');
  clients.add(res);

  const cleanup = () => clients.delete(res);
  res.on('close', cleanup);
  return cleanup;
};

export const broadcast = (event, data = {}) => {
  if (!clients.size) return;
  const payload = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
  clients.forEach((res) => safeWrite(res, payload));
};

// Proxies drop connections that look idle; a comment line keeps them alive.
setInterval(() => clients.forEach((res) => safeWrite(res, ': ping\n\n')), HEARTBEAT_MS).unref();
