import type { ErrorCode } from "@/utils/i18n";

/**
 * A server action that survives the network going away underneath it.
 *
 * A server action is a `fetch` wearing a function's clothes. When the device
 * drops off the network mid-submit the call rejects, React has no boundary to
 * hand the rejection to, and the whole route segment unmounts — measured, on
 * this app, as "This page couldn't load. Reload to try again, or go back", in
 * English regardless of the reader's language, with the paragraph they had just
 * typed gone with the page.
 *
 * That is the wrong shape for the failure. A dropped connection is not the page
 * being broken, it is one attempt not arriving, and the person is still sitting
 * there with their words on screen. So the rejection is caught and returned as
 * an ordinary error state: the form stays mounted, the text stays in it, and
 * the message says to try again.
 *
 * Only transport failures. Anything the action itself throws is a real fault
 * and is left to propagate, because swallowing it here would turn a bug into a
 * shrug and nobody would ever hear about it.
 */
export function resilient<S extends { error: ErrorCode | null }, A extends unknown[]>(
  action: (...args: A) => Promise<S>,
) {
  return async (...args: A): Promise<S> => {
    try {
      return await action(...args);
    } catch (error) {
      if (!isTransport(error)) throw error;

      // Give the fields their contents back.
      //
      // Every form here re-applies `state.values` as `defaultValue`, because
      // React resets an uncontrolled field once a form action resolves. On a
      // transport failure the action never ran, so it never built that object,
      // and returning the previous state alone emptied the box under a message
      // saying the text was still there.
      //
      // The FormData is the second argument of every action in this codebase,
      // and it holds exactly what the person typed. Strings only: a photograph
      // cannot be put back into a file input by anything, and pretending
      // otherwise would be the same broken promise one field over.
      const previous = (args[0] ?? {}) as S;
      const submitted = args[1];
      const values: Record<string, string> = {};
      if (submitted instanceof FormData) {
        for (const [key, value] of submitted.entries()) {
          if (typeof value === "string" && key !== "locale") values[key] = value;
        }
      }

      return {
        ...previous,
        values: { ...(previous as { values?: object }).values, ...values },
        error: "networkFailed" as ErrorCode,
      };
    }
  };
}

/**
 * Did the request fail to arrive, as opposed to arriving and going wrong?
 *
 * `TypeError: Failed to fetch` is what every browser raises for a request that
 * never left, and Next adds its own wording when a server action's transport
 * dies. Neither is a class anything can be tested against, so the strings are
 * what there is; a redirect is explicitly excluded because Next signals those
 * by throwing and they must keep travelling.
 */
function isTransport(error: unknown): boolean {
  if (typeof error === "object" && error !== null) {
    const digest = (error as { digest?: unknown }).digest;
    if (typeof digest === "string" && digest.startsWith("NEXT_")) return false;
  }
  const message = error instanceof Error ? error.message : String(error);
  return /failed to fetch|network|load failed|connection|fetch failed/i.test(message);
}
