export async function rememberRun(jobId: string) {
  await fetch("/api/session/runs", {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ jobId })
  });
}
