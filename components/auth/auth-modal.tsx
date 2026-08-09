"use client";

import Image from "next/image";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";

import { createClient } from "@/utils/supabase/client";
import { getDictionary, type ErrorCode, type Locale } from "@/utils/i18n";
import { ALERT, BTN_PRIMARY, FIELD, LABEL, LINK } from "@/components/ui/styles";

/**
 * Signing in without a password.
 *
 * There is nothing to remember and nothing stored: you type your address, a
 * six-digit code arrives, you type the code. The database holds no password
 * hash for anyone, so there is no credential here to leak, reuse or reset —
 * which also means no "forgot password" screen, because there is nothing to
 * forget.
 *
 * Two entrances rather than one. Signing in refuses to create an account
 * (`shouldCreateUser: false`) so that a typo in an address lands on "no account
 * for that email" instead of silently making a second, empty one under the
 * misspelling. Signing up asks for a name first, because that name is what
 * appears above every topic and reply, and there is no later step to collect it.
 *
 * The cost of saying "no account for that email" out loud is that the form will
 * tell anyone whether a given address is registered. That is a real trade and it
 * is made deliberately: without it, a mistyped address just never receives a
 * code and the person is left staring at a screen that claims one was sent.
 */

type View = "signin" | "signup" | "code";

// Shared tokens, so the modal cannot drift from the rest of the site.
const PRIMARY = `w-full ${BTN_PRIMARY}`;

/**
 * How long before a new code can be asked for. Supabase rate-limits the sending
 * side anyway; counting it down here means the second press is refused by a
 * disabled button that says when, rather than by a server error that does not.
 */
const RESEND_SECONDS = 60;

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * How short a code can be before it is not worth a round trip. A floor, not a
 * length.
 *
 * The number of digits is a Supabase setting, not a fact about this app — the
 * default is six, this project's is eight, and it can be changed again in the
 * dashboard by someone who will never think to come and edit this file. It was
 * hardcoded to six here, and the input's `maxLength` refused the seventh digit:
 * the code arrived, it was correct, and the form would not let anyone type it.
 * So the client stops pretending to know. It strips non-digits, checks there
 * are enough of them to be a code at all, and lets the server be the authority
 * on whether the code is right.
 */
const MIN_CODE_DIGITS = 6;

/**
 * What Supabase says when `shouldCreateUser: false` meets an address it has
 * never seen. Matched on the stable code first — the sentence is user-facing
 * text on their side and may be reworded.
 */
const isUnknownAccount = (code: string | undefined, message: string) =>
  code === "otp_disabled" || /signups not allowed/i.test(message);

const isRateLimited = (code: string | undefined, status: number | undefined) =>
  code === "over_email_send_rate_limit" || status === 429;

export function AuthModal({
  open,
  onClose,
  lang,
}: {
  open: boolean;
  onClose: () => void;
  lang: Locale;
}) {
  const router = useRouter();
  const t = getDictionary(lang);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const codeRef = useRef<HTMLInputElement>(null);
  const [view, setView] = useState<View>("signin");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<ErrorCode | null>(null);
  const [height, setHeight] = useState<number | undefined>(undefined);
  const [mounted, setMounted] = useState(false);

  /** Carried into the code screen: the address to verify against, and how we got there. */
  const [email, setEmail] = useState("");
  const [cameFrom, setCameFrom] = useState<"signin" | "signup">("signin");
  const [cooldown, setCooldown] = useState(0);
  const [resent, setResent] = useState(false);

  useEffect(() => setMounted(true), []);

  // Drive the native dialog from the `open` prop so we get focus trapping,
  // Esc-to-close and an inert background for free. This runs as a layout
  // effect, and before the measuring effect below, so the panel is already
  // laid out (not `display: none`) by the time we measure it.
  useLayoutEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    if (open && !dialog.open) {
      dialog.showModal();
    } else if (!open && dialog.open) {
      // Let the closing animation finish before tearing the dialog down.
      const done = () => dialog.close();
      dialog.addEventListener("transitionend", done, { once: true });
      dialog.setAttribute("data-closing", "");
      return () => {
        dialog.removeEventListener("transitionend", done);
        dialog.removeAttribute("data-closing");
      };
    }
  }, [open]);

  // Blur the page content itself rather than using `backdrop-filter` on an
  // overlay: a full-viewport backdrop-filter re-samples every frame and pins
  // the compositor at ~8fps for as long as the modal is open. A plain filter
  // on static content rasterizes once and costs ~6x less.
  useEffect(() => {
    const pageRoot = document.getElementById("page-root");
    if (!pageRoot) return;
    pageRoot.classList.toggle("is-blurred", open);
    return () => pageRoot.classList.remove("is-blurred");
  }, [open]);

  // Reset back to the sign-in view once the dialog is fully closed.
  useEffect(() => {
    if (open) return;
    const timer = setTimeout(() => {
      setView("signin");
      setError(null);
      setEmail("");
      setCooldown(0);
      setResent(false);
    }, 200);
    return () => clearTimeout(timer);
  }, [open]);

  // Animate the panel between view heights instead of letting it jump.
  // Only measure while open — a closed dialog reports a height of 0, which
  // would otherwise make every open animate up from nothing.
  useLayoutEffect(() => {
    const panel = panelRef.current;
    if (!open || !panel) {
      setHeight(undefined);
      return;
    }
    const measure = () => setHeight(panel.scrollHeight);
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(panel);
    return () => observer.disconnect();
  }, [open, view]);

  // One second at a time, and only while there is something to count.
  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setTimeout(() => setCooldown((n) => n - 1), 1000);
    return () => clearTimeout(timer);
  }, [cooldown]);

  // The code screen exists to be typed into; put the cursor there.
  useEffect(() => {
    if (view === "code") codeRef.current?.focus();
  }, [view]);

  /** Ask for a code. Shared by both entrances and by the resend button. */
  const sendCode = async (
    address: string,
    mode: "signin" | "signup",
    names?: { firstName: string; lastName: string },
  ) => {
    const { error: sendError } = await createClient().auth.signInWithOtp({
      email: address,
      options: {
        // The one line that separates the two entrances.
        shouldCreateUser: mode === "signup",
        // Read by the `on_auth_user_created` trigger into public.profiles, and
        // only ever applied when this call is the one that creates the account.
        ...(names ? { data: { first_name: names.firstName, last_name: names.lastName } } : {}),
      },
    });

    if (!sendError) return null;
    if (isUnknownAccount(sendError.code, sendError.message)) return "noAccount" as const;
    if (isRateLimited(sendError.code, sendError.status)) return "tooManyCodes" as const;

    /* Everything else collapses into one sentence on screen, deliberately: an
       SMTP rejection is the mail provider talking to us, not to the person
       trying to sign in, and "535 5.7.8 Username and Password not accepted" in
       a dialog helps nobody. It still has to go somewhere, though — without
       this the only symptom of a misconfigured mail setup is a generic failure
       with no thread to pull. The console is that somewhere. */
    console.error(
      "[auth] sending the code failed:",
      { status: sendError.status, code: sendError.code, message: sendError.message },
    );
    return "codeSendFailed" as const;
  };

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setResent(false);

    const form = new FormData(event.currentTarget);

    if (view === "code") {
      const token = String(form.get("code") ?? "").replace(/\D/g, "");
      if (token.length < MIN_CODE_DIGITS) {
        setError("codeInvalid");
        return;
      }

      setPending(true);
      const supabase = createClient();

      // `email` covers a code sent to an account that already existed;
      // `signup` covers the one sent by the call that created it. Which of the
      // two Supabase used depends on the template it picked, so rather than
      // predicting it, the second is tried when the first is rejected.
      let result = await supabase.auth.verifyOtp({ email, token, type: "email" });
      if (result.error) {
        result = await supabase.auth.verifyOtp({ email, token, type: "signup" });
      }
      setPending(false);

      if (result.error) {
        setError("codeInvalid");
        return;
      }
      onClose();
      // The session cookie is set; re-render the server components to pick it up.
      router.refresh();
      return;
    }

    const address = String(form.get("email") ?? "").trim();
    const firstName = String(form.get("firstName") ?? "").trim();
    const lastName = String(form.get("lastName") ?? "").trim();

    // Validated here rather than by the browser: native constraint bubbles are
    // in the browser's own language and styling, which breaks the UI's uniformity.
    if (view === "signup" && (!firstName || !lastName)) {
      setError("nameRequired");
      return;
    }
    if (!EMAIL.test(address)) {
      setError("emailInvalid");
      return;
    }

    setPending(true);
    const failure = await sendCode(
      address,
      view,
      view === "signup" ? { firstName, lastName } : undefined,
    );
    setPending(false);

    if (failure) {
      setError(failure);
      return;
    }

    setEmail(address);
    setCameFrom(view);
    setCooldown(RESEND_SECONDS);
    setView("code");
  };

  const resend = async () => {
    if (cooldown > 0 || pending) return;
    setError(null);
    setResent(false);
    setPending(true);
    // No names on a resend: if the account was going to be created, the first
    // request already created it, and passing them again would change nothing.
    const failure = await sendCode(email, cameFrom);
    setPending(false);
    if (failure) {
      setError(failure);
      return;
    }
    setCooldown(RESEND_SECONDS);
    setResent(true);
  };

  const switchTo = (next: View) => {
    setError(null);
    setResent(false);
    setView(next);
  };

  // Rendered outside #page-root so the page blur never touches the dialog.
  if (!mounted) return null;

  const title = view === "code" ? t.auth.codeTitle : view === "signin" ? t.auth.signIn : t.auth.signUp;

  /**
   * Only the code screen has a second line, and it carries a fact the person
   * needs: which address the code went to, so a typo is visible before they go
   * looking through a mailbox that will never receive it. The two entrances say
   * nothing under their heading — a labelled email field does not need a
   * sentence explaining that it is an email field.
   */
  const subtitle = view === "code" ? t.auth.codeSentTo(email) : null;

  return createPortal(
    <dialog
      ref={dialogRef}
      onClose={onClose}
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
      aria-labelledby="auth-modal-title"
      /* `w-full` rather than `w-screen`: 100vw counts the classic scrollbar, so
         on a desktop with one the dialog would be a dozen pixels wider than the
         viewport it is meant to cover. */
      className="auth-dialog m-0 h-dvh max-h-none w-full max-w-none bg-transparent p-0 text-[#212529]"
    >
      <div
        className="auth-overlay fixed inset-0 flex items-center justify-center p-4"
        onClick={(event) => {
          if (event.target === event.currentTarget) onClose();
        }}
      >
        {/* The sign-up view is taller than a 320x568 screen, and taller still
            than what is left of any phone once the keyboard is up. The shell is
            capped to the viewport less the overlay's padding and the panel
            scrolls inside it; `scrollHeight` is unaffected by the cap, so the
            height animation between views still measures the full content. */}
        <div
          className="auth-panel-shell max-h-[calc(100dvh-2rem)] w-[min(28rem,100%)] overflow-hidden rounded-[18px] bg-white shadow-2xl"
          style={{ height }}
        >
          <div
            ref={panelRef}
            key={view}
            className="auth-panel max-h-[calc(100dvh-2rem)] overflow-y-auto overscroll-contain"
          >
          {/* Brand bar, echoing the site header. */}
          <div className="flex items-center justify-center border-b border-[#ced4da] px-5 py-4 sm:px-6 sm:py-5 md:px-8">
            <Image
              src="/logo-ensemble-mtl.png"
              alt="Ensemble Montréal"
              width={469}
              height={166}
              className="h-10 w-auto"
            />
          </div>

          {/* Tighter gutters on a phone: at 320px the panel is 288px wide, and
              24px of padding a side leaves the fields visibly cramped. */}
          <div className="px-5 py-6 sm:px-6 sm:py-7 md:px-8">
            <h2 id="auth-modal-title" className="text-[24px] font-bold leading-[32px]">
              {title}
            </h2>
            {/* `break-words`: the address is printed back here and a long one
                has no space in it to wrap at. */}
            {subtitle && <p className="mt-2 break-words text-[#637381]">{subtitle}</p>}

            <form onSubmit={submit} noValidate className="mt-6">
              {view === "signup" && (
                <div className="mb-5 grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div>
                    <label htmlFor="auth-first-name" className={LABEL}>
                      {t.auth.firstName}
                    </label>
                    <input
                      id="auth-first-name"
                      name="firstName"
                      type="text"
                      autoComplete="given-name"
                      disabled={pending}
                      className={FIELD}
                    />
                  </div>
                  <div>
                    <label htmlFor="auth-last-name" className={LABEL}>
                      {t.auth.lastName}
                    </label>
                    <input
                      id="auth-last-name"
                      name="lastName"
                      type="text"
                      autoComplete="family-name"
                      disabled={pending}
                      className={FIELD}
                    />
                  </div>
                </div>
              )}

              {view === "code" ? (
                <div className="mb-5">
                  <label htmlFor="auth-code" className={LABEL}>
                    {t.auth.codeLabel}
                  </label>
                  {/* `inputMode numeric` brings up the digit keypad, and
                      `one-time-code` lets iOS and Android offer the code
                      straight from the notification instead of making someone
                      leave the page to read their mail. Spaced and centred
                      because a run of digits reads as a code that way and as a
                      quantity otherwise.

                      `maxLength` is a paste guard, not the code's length — see
                      MIN_CODE_DIGITS. The tracking is loose enough to read as
                      grouped digits and tight enough that ten of them still fit
                      the 288px the panel has on a 320px screen. */}
                  <input
                    ref={codeRef}
                    id="auth-code"
                    name="code"
                    type="text"
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    maxLength={12}
                    disabled={pending}
                    className={`${FIELD} text-center text-[20px] font-bold tracking-[0.3em]`}
                  />
                </div>
              ) : (
                <div className="mb-5">
                  <label htmlFor="auth-email" className={LABEL}>
                    {t.auth.email}
                  </label>
                  <input
                    id="auth-email"
                    name="email"
                    type="email"
                    autoComplete="email"
                    disabled={pending}
                    className={FIELD}
                  />
                </div>
              )}

              {error && (
                <p role="alert" className={`mb-5 ${ALERT}`}>
                  {t.errors[error]}
                </p>
              )}

              {resent && (
                <p
                  role="status"
                  className="mb-5 rounded-[12px] border border-[#b6d8ce] bg-[#e2f0ec] px-4 py-3 text-[15px] text-[#075f53]"
                >
                  {t.auth.resendDone}
                </p>
              )}

              <button type="submit" disabled={pending} className={PRIMARY}>
                {pending
                  ? t.auth.working
                  : view === "signin"
                    ? t.auth.submitSignIn
                    : view === "signup"
                      ? t.auth.submitSignUp
                      : t.auth.submitCode}
              </button>

              {/* Only on the form that actually collects something. Signing in
                  hands over an address the account already has; creating one is
                  the moment a name enters the site, and it is the moment the
                  law wants the purposes said out loud. Under the button rather
                  than above it: nobody reads a preamble, and everybody looks at
                  what sits next to the thing they are about to press. */}
              {view === "signup" && (
                <p className="mt-3 text-[13px] leading-[19px] text-[#5d6b66]">
                  {t.auth.collectionNotice}{" "}
                  <a href={`/${lang}/confidentialite`} className={LINK}>
                    {t.privacy.title}
                  </a>
                </p>
              )}
            </form>

            {/* `inline-block py-2` on the switches: these are the last thing
                a phone user reaches for and a bare line of text is a 24px
                target. */}
            <div className="mt-6 border-t border-[#ced4da] pt-4 text-center">
              {view === "code" ? (
                <>
                  <p>
                    <button
                      type="button"
                      onClick={resend}
                      disabled={cooldown > 0 || pending}
                      className={`${LINK} inline-block py-2 disabled:cursor-not-allowed disabled:text-[#93a19c] disabled:no-underline`}
                    >
                      {cooldown > 0 ? t.auth.resendIn(cooldown) : t.auth.resend}
                    </button>
                  </p>
                  <p>
                    <button
                      type="button"
                      onClick={() => switchTo(cameFrom)}
                      className={`${LINK} inline-block py-2`}
                    >
                      {t.auth.changeEmail}
                    </button>
                  </p>
                </>
              ) : (
                <p>
                  {view === "signin" ? t.auth.noAccount : t.auth.hasAccount}{" "}
                  <button
                    type="button"
                    onClick={() => switchTo(view === "signin" ? "signup" : "signin")}
                    className={`${LINK} inline-block py-2`}
                  >
                    {view === "signin" ? t.auth.signUp : t.auth.signIn}
                  </button>
                </p>
              )}
            </div>
          </div>
          </div>
        </div>
      </div>
    </dialog>,
    document.body,
  );
}
