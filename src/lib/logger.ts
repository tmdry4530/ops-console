export function logInfo(message: string, context: Record<string, string | number | boolean> = {}) {
  console.info(JSON.stringify({ level: "info", message, ...context }));
}

export function logError(message: string, context: Record<string, string | number | boolean> = {}) {
  console.error(JSON.stringify({ level: "error", message, ...context }));
}
