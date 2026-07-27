"use client";

import Image from "next/image";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";

import { createClient } from "@/utils/supabase/client";
import { getDictionary, type ErrorCode, type Locale } from "@/utils/i18n";
import { ALERT, BTN_PRIMARY, FIELD, LABEL, LINK } from "@/components/ui/styles";

type View = "signin" | "signup" | "confirm";

// Shared tokens, so the modal cannot drift from the rest of the site.
const PRIMARY = `w-full ${BTN_PRIMARY}`;

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
  const [view, setView] = useState<View>("signin");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<ErrorCode | null>(null);
  const [height, setHeight] = useState<number | undefined>(undefined);
  const [mounted, setMounted] = useState(false);

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

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);

    const form = new FormData(event.currentTarget);
    const email = String(form.get("email")).trim();
    const password = String(form.get("password"));

    // Validated here rather than by the browser: native constraint bubbles are
    // in the browser's own language and styling, which breaks the UI's uniformity.
    const firstName = String(form.get("firstName") ?? "").trim();
    const lastName = String(form.get("lastName") ?? "").trim();
    const confirmPassword = String(form.get("confirmPassword") ?? "");

    if (view === "signup" && (!firstName || !lastName)) {
      setError("nameRequired");
      return;
    }
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setError("emailInvalid");
      return;
    }
    if (password.length < 8) {
      setError("passwordTooShort");
      return;
    }
    if (view === "signup" && password !== confirmPassword) {
      setError("passwordMismatch");
      return;
    }

    setPending(true);
    const supabase = createClient();

    if (view === "signup") {

      // The `on_auth_user_created` trigger copies these into public.profiles.
      const { data, error: signUpError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: `${window.location.origin}/auth/confirm`,
          data: { first_name: firstName, last_name: lastName },
        },
      });

      setPending(false);
      if (signUpError) {
        setError("publishFailed");
        return;
      }
      // With email confirmation off, signUp already returns a session and the
      // user is logged in; only tell them to check their mail when it doesn't.
      if (data.session) {
        onClose();
        router.refresh();
        return;
      }
      setView("confirm");
      return;
    }

    const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
    setPending(false);
    if (signInError) {
      setError("badCredentials");
      return;
    }
    onClose();
    // The session cookie is set; re-render the server components to pick it up.
    router.refresh();
  };

  const switchTo = (next: View) => {
    setError(null);
    setView(next);
  };

  // Rendered outside #page-root so the page blur never touches the dialog.
  if (!mounted) return null;

  return createPortal(
    <dialog
      ref={dialogRef}
      onClose={onClose}
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
      aria-labelledby="auth-modal-title"
      className="auth-dialog m-0 h-dvh max-h-none w-screen max-w-none bg-transparent p-0 text-[#212529]"
    >
      <div
        className="auth-overlay fixed inset-0 flex items-center justify-center p-4"
        onClick={(event) => {
          if (event.target === event.currentTarget) onClose();
        }}
      >
        <div
          className="auth-panel-shell w-[min(28rem,100%)] overflow-hidden rounded-[4px] bg-white shadow-2xl"
          style={{ height }}
        >
          <div ref={panelRef} key={view} className="auth-panel">
          {/* Brand bar, echoing the site header. */}
          <div className="flex items-center justify-center border-b border-[#ced4da] px-6 py-5 md:px-8">
            <Image src="/logo-montreal.png" alt="Ville de Montréal" width={112} height={40} />
          </div>

          <div className="px-6 py-7 md:px-8">
          {view === "confirm" ? (
            <>
              <h2 id="auth-modal-title" className="text-[24px] font-bold leading-[32px]">
                {t.auth.checkEmailTitle}
              </h2>
              <p className="mt-3 text-[#637381]">
                {t.auth.checkEmailBody}
              </p>
              <button type="button" onClick={() => switchTo("signin")} className={`mt-8 ${PRIMARY}`}>
                {t.auth.backToSignIn}
              </button>
            </>
          ) : (
            <>
              <h2 id="auth-modal-title" className="text-[24px] font-bold leading-[32px]">
                {view === "signin" ? t.auth.signIn : t.auth.signUp}
              </h2>
              <p className="mt-2 text-[#637381]">
                {view === "signin" ? t.auth.signInSubtitle : t.auth.signUpSubtitle}
              </p>

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

                <div className="mb-5">
                  <label htmlFor="auth-password" className={LABEL}>
                    {t.auth.password}
                  </label>
                  <input
                    id="auth-password"
                    name="password"
                    type="password"
                    autoComplete={view === "signin" ? "current-password" : "new-password"}
                    disabled={pending}
                    className={FIELD}
                  />
                </div>

                {view === "signup" && (
                  <div className="mb-5">
                    <label htmlFor="auth-confirm-password" className={LABEL}>
                      {t.auth.confirmPassword}
                    </label>
                    <input
                      id="auth-confirm-password"
                      name="confirmPassword"
                      type="password"
                      autoComplete="new-password"
                      disabled={pending}
                      className={FIELD}
                    />
                  </div>
                )}

                {error && (
                  <p
                    role="alert"
                    className={`mb-5 ${ALERT}`}
                  >
                    {t.errors[error]}
                  </p>
                )}

                <button type="submit" disabled={pending} className={PRIMARY}>
                  {pending
                    ? t.auth.working
                    : view === "signin"
                      ? t.auth.submitSignIn
                      : t.auth.submitSignUp}
                </button>
              </form>

              <p className="mt-6 border-t border-[#ced4da] pt-6 text-center">
                {view === "signin" ? t.auth.noAccount : t.auth.hasAccount}{" "}
                <button
                  type="button"
                  onClick={() => switchTo(view === "signin" ? "signup" : "signin")}
                  className={LINK}
                >
                  {view === "signin" ? t.auth.signUp : t.auth.signIn}
                </button>
              </p>
              </>
            )}
          </div>
          </div>
        </div>
      </div>
    </dialog>,
    document.body,
  );
}
