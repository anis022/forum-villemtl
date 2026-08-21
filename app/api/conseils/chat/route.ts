import { APICallError, isStepCount, streamText } from "ai";
import { cookies } from "next/headers";
import { z } from "zod";
import {
  councilTools,
  searchTheCorpus,
  COUNCIL_MODELS,
  COUNCIL_SYSTEM_PROMPT,
  type Citation,
} from "@/utils/council-agent";
import { askerKey, cachedAnswer, mayAskTheModel, rememberAnswer } from "@/utils/council-cache";
import { getDictionary } from "@/utils/i18n";
import { createClient } from "@/utils/supabase/server";

const Body = z.object({
  lang: z.enum(["fr", "en"]).default("fr"),
  messages: z
    .array(
      z.object({
        role: z.enum(["user", "assistant"]),
        content: z.string().min(1).max(4000),
      }),
    )
    .min(1)
    .max(24),
});

/**
 * Why the answer has no prose, when it has none.
 *
 * `limit` is this visitor asking faster than the shared allowance permits;
 * `quota` is the allowance itself being spent for the day; `error` is anything
 * else, including no API key configured at all. The reader is told which,
 * because "come back tomorrow" and "that did not work" call for different
 * things from them.
 */
type FallbackReason = "limit" | "quota" | "error";

function statusOf(error: unknown): number | null {
  if (APICallError.isInstance(error)) return error.statusCode ?? null;
  const code = (error as { statusCode?: unknown } | null)?.statusCode;
  return typeof code === "number" ? code : null;
}

function reasonFor(error: unknown): FallbackReason {
  const status = statusOf(error);
  const message = error instanceof Error ? error.message : "";
  if (status === 429 || /quota|rate limit|resource[_ ]exhausted/i.test(message)) return "quota";
  return "error";
}

/**
 * The numbers the answer actually wrote, in the order it wrote them.
 *
 * A run of them is written `[1][2][3]` by some models and `[1,2,3]` by others,
 * and the two mean the same thing. Reading only the first shape is how a change
 * of model silently empties the list under an answer: nothing matches, nothing
 * is counted as cited, and `collect` falls back to printing every row the
 * search touched as though the answer had leaned on all of them.
 */
function citedIn(text: string): number[] {
  return [...text.matchAll(/\[(\d{1,3}(?:\s*,\s*\d{1,3})*)\]/g)].flatMap((m) =>
    m[1].split(",").map((n) => Number(n.trim())),
  );
}

const encoder = new TextEncoder();

/**
 * The conversation behind /conseils.
 *
 * Newline-delimited JSON rather than the SDK's own UI stream: the client needs
 * four things from this route, the words as they arrive, the name of whatever
 * tool is running so the page can say so, the sources, and whether the answer
 * had to be found without a model. Emitting exactly those keeps the browser
 * bundle to a `fetch` and a `split("\n")` instead of a message-parts library,
 * and it keeps the sources server-side, which is what stops a model from
 * writing a link to a sitting that never happened.
 *
 * The order this tries things in is the whole design, and it is ordered by what
 * each step costs rather than by what it produces:
 *
 *   1. An answer already written, which costs nothing.
 *   2. The models, in the order `COUNCIL_MODELS` puts them, and only if this
 *      visitor has not already had more than their share of the free allowances
 *      the whole borough is sharing.
 *   3. The corpus itself, which costs nothing, has no allowance, and cannot be
 *      exhausted by anybody.
 *
 * Step three is unconditional. Every failure above it lands there rather than
 * on an error, so there is no state of the world in which somebody asks this
 * page a question and gets nothing back. That includes the state it is in with
 * no API key configured at all.
 *
 * The workspace remains public, but sending a question is participation and is
 * reserved to a currently eligible member. This route checks that rule itself;
 * disabling the public form is only the readable face of the same boundary.
 */
export async function POST(request: Request) {
  const supabase = createClient(await cookies());
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return Response.json({ error: "not_signed_in" }, { status: 401 });

  const { data: canParticipate, error: membershipError } = await supabase.rpc(
    "viewer_is_member",
  );
  if (membershipError || canParticipate !== true) {
    return Response.json({ error: "member_required" }, { status: 403 });
  }

  const parsed = Body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return Response.json({ error: getDictionary("fr").council.errorGeneric }, { status: 400 });
  }
  const { lang, messages } = parsed.data;

  const question = messages.at(-1)?.content ?? "";
  // Only a question asked cold is cached. Anything later in a thread means
  // something different depending on what came before it.
  const cacheable = messages.length === 1;

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (line: unknown) =>
        controller.enqueue(encoder.encode(`${JSON.stringify(line)}\n`));

      const fallBackToCorpus = async (why: FallbackReason) => {
        let citations: Citation[] = [];
        try {
          citations = await searchTheCorpus(question);
        } catch (error) {
          console.error("[conseils/chat] recherche de repli:", error);
        }
        send({ t: "fallback", v: why });
        send({ t: "cites", v: citations });
      };

      try {
        if (cacheable) {
          const remembered = await cachedAnswer(lang, question);
          if (remembered) {
            send({ t: "d", v: remembered.text });
            send({ t: "cites", v: remembered.citations });
            controller.close();
            return;
          }
        }

        if (!(await mayAskTheModel(askerKey(request)))) {
          await fallBackToCorpus("limit");
          controller.close();
          return;
        }

        // The ladder, tried in order and stopped at whichever rung answers.
        //
        // A spent allowance is refused at the start of a request, not in the
        // middle of one, so a rung that fails before it has written a word has
        // cost the reader a second and nothing else, and the next rung gets the
        // same question. Once words are on their way that stops being true: the
        // page appends what arrives, so a second rung would write its answer
        // onto the end of the first one's half-sentence. From there the only
        // honest move is the one the page already makes with a broken answer,
        // which is to drop it and show the passages instead.
        //
        // Tools are built per rung. The numbering behind an answer has to be the
        // numbering of the search that answer read, not of every search tried
        // tonight.
        let failed: FallbackReason = "error";
        let answered = false;

        for (const rung of COUNCIL_MODELS) {
          const { tools, collect } = councilTools();

          const result = streamText({
            model: rung.model,
            system: COUNCIL_SYSTEM_PROMPT,
            messages,
            tools,
            // Search, then a reformulation if the first pass came back empty,
            // then the answer. Past that the model is guessing at queries rather
            // than reading, and every step is another request against the
            // allowance.
            stopWhen: isStepCount(6),
            // The default is to retry three times. Against a metered free tier
            // that is the worst possible response to the commonest failure: the
            // allowance is already spent, so all three retries are certain to
            // fail and each one is charged. One attempt, then the next rung.
            maxRetries: 0,
            onError: ({ error }) => {
              console.error(`[conseils/chat] ${rung.provider}:`, error);
            },
          });

          let answer = "";
          let trouble: FallbackReason | null = null;
          let spoken = false;

          for await (const part of result.fullStream) {
            if (part.type === "tool-input-start") {
              send({ t: "tool", v: part.toolName });
            } else if (part.type === "text-delta") {
              answer += part.text;
              spoken = true;
              send({ t: "d", v: part.text });
            } else if (part.type === "error") {
              trouble = reasonFor(part.error);
            }
          }

          // A model that returned nothing at all has not answered, whatever else
          // it reported on the way.
          if (!trouble && !answer.trim()) trouble = "error";

          if (trouble) {
            failed = trouble;
            if (spoken) break;
            continue;
          }

          // Last, because the list depends on the finished text: a source is
          // kept only if the answer wrote its number, and the numbers a reader
          // sees are assigned in the order the answer used them.
          const citations = collect(citedIn(answer));
          send({ t: "cites", v: citations });

          if (cacheable && citations.length > 0) {
            await rememberAnswer(lang, question, { text: answer, citations });
          }

          answered = true;
          break;
        }

        if (!answered) await fallBackToCorpus(failed);
      } catch (error) {
        console.error("[conseils/chat] flux interrompu:", error);
        await fallBackToCorpus(reasonFor(error));
      }

      controller.close();
    },
  });

  return new Response(stream, {
    headers: {
      "content-type": "application/x-ndjson; charset=utf-8",
      "cache-control": "no-store",
      // Proxies that buffer a response hold the whole answer back and the page
      // sits blank for twenty seconds.
      "x-accel-buffering": "no",
    },
  });
}
