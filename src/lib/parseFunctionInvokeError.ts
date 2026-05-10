/**
 * Supabase functions.invoke returns { data: null, error, response } on non-2xx;
 * the useful message is usually in the JSON body of `response`, not `data`.
 */
export async function messageFromFunctionInvokeError(
  error: unknown,
  response: Response | undefined,
): Promise<string> {
  if (response) {
    try {
      const ct = response.headers.get("content-type") ?? "";
      if (ct.includes("application/json")) {
        const body = await response.clone().json();
        if (body && typeof body.error === "string" && body.error.trim()) {
          return body.error;
        }
      }
    } catch {
      /* ignore parse errors */
    }
  }
  if (error instanceof Error && error.message) return error.message;
  return "Request failed";
}
