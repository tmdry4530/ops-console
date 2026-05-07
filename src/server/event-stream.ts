export function formatSseFrame(event: string, data: unknown): string {
  return `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
}

export function shouldPollEvents(iteration: number, maxIterations = 30): boolean {
  return iteration < maxIterations;
}
