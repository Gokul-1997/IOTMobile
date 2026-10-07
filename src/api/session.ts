// A session generation invalidates pending requests and asynchronous socket setup.
let generation = 0;
let controller = new AbortController();
export const sessionVersion = () => generation;
export const sessionSignal = () => controller.signal;
export function invalidateSessionRequests() {
  generation++;
  controller.abort();
  controller = new AbortController();
}
