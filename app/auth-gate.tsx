"use client";

import { createClient, Session } from "@supabase/supabase-js";
import { FormEvent, ReactNode, useEffect, useMemo, useState } from "react";

const SUPABASE_URL = "https://mesbcospesuhuojhftxs.supabase.co";
const SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1lc2Jjb3NwZXN1aHVvamhmdHhzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODU0ODYxNDUsImV4cCI6MjEwMTA2MjE0NX0.T8v8FMpDp9QGxveTHqpYeqr7AS0Zz6DU3PH_tOM0jdM";
const ALLOWED_EMAILS = new Set([
  "grel_xu@outlook.com",
  "elephantsimon@163.com",
  "839079040@qq.com",
  "xu.yang2@getein.cn",
]);

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    autoRefreshToken: true,
    detectSessionInUrl: true,
    persistSession: true,
  },
});

export type AccessUser = {
  displayName: string;
  email: string;
};

type AuthGateProps = {
  children: (
    user: AccessUser,
    signOut: () => Promise<void>,
  ) => ReactNode;
};

function normalizedEmail(session: Session | null) {
  return session?.user.email?.trim().toLowerCase() ?? "";
}

export default function AuthGate({ children }: AuthGateProps) {
  const [session, setSession] = useState<Session | null>(null);
  const [checking, setChecking] = useState(true);
  const [email, setEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    let active = true;

    const acceptSession = (nextSession: Session | null) => {
      if (!active) return;
      const address = normalizedEmail(nextSession);
      if (nextSession && !ALLOWED_EMAILS.has(address)) {
        setSession(null);
        setErrorMessage("This account is not authorized to use the service desk.");
        void supabase.auth.signOut();
      } else {
        setSession(nextSession);
      }
      setChecking(false);
    };

    void supabase.auth.getSession().then(({ data, error }) => {
      if (error) {
        setErrorMessage("Secure sign-in is temporarily unavailable. Please try again.");
        setChecking(false);
        return;
      }
      acceptSession(data.session);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      acceptSession(nextSession);
    });

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, []);

  const user = useMemo<AccessUser | null>(() => {
    if (!session) return null;
    const address = normalizedEmail(session);
    const metadataName = session.user.user_metadata?.name;
    return {
      email: address,
      displayName:
        typeof metadataName === "string" && metadataName.trim()
          ? metadataName.trim()
          : address.split("@")[0],
    };
  }, [session]);

  async function requestSignIn(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrorMessage("");
    setMessage("");

    const address = email.trim().toLowerCase();
    if (!ALLOWED_EMAILS.has(address)) {
      setErrorMessage("This email is not on the approved access list.");
      return;
    }

    setSubmitting(true);
    const redirectUrl = new URL(window.location.href);
    redirectUrl.search = "";
    redirectUrl.hash = "";

    const { error } = await supabase.auth.signInWithOtp({
      email: address,
      options: {
        emailRedirectTo: redirectUrl.toString(),
        shouldCreateUser: false,
      },
    });

    setSubmitting(false);
    if (error) {
      setErrorMessage(
        error.message.includes("rate limit")
          ? "Too many sign-in attempts. Please wait before trying again."
          : "The sign-in email could not be sent. Please try again.",
      );
      return;
    }

    setMessage(
      "Check your inbox and open the one-time sign-in link. The link expires shortly.",
    );
  }

  async function signOut() {
    setErrorMessage("");
    const { error } = await supabase.auth.signOut();
    if (error) {
      setErrorMessage("Sign-out failed. Please refresh the page and try again.");
      return;
    }
    setSession(null);
  }

  if (checking) {
    return (
      <main className="auth-page">
        <div className="auth-loading" role="status">
          <span className="brand-mark">G</span>
          <strong>Secure access</strong>
          <p>Checking your sign-in status…</p>
        </div>
      </main>
    );
  }

  if (user) return children(user, signOut);

  return (
    <main className="auth-page">
      <section className="auth-card" aria-labelledby="auth-title">
        <div className="auth-brand">
          <span className="brand-mark">G</span>
          <div>
            <strong>International Service Desk</strong>
            <small>Authorized employees only</small>
          </div>
        </div>

        <div className="auth-copy">
          <span className="section-kicker">SECURE ACCESS</span>
          <h1 id="auth-title">Sign in to continue</h1>
          <p>
            Enter an approved work email. We will send a secure, one-time
            sign-in link—no password is required.
          </p>
        </div>

        <form className="auth-form" onSubmit={requestSignIn}>
          <label htmlFor="sign-in-email">Work email</label>
          <input
            id="sign-in-email"
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            autoComplete="email"
            placeholder="name@company.com"
            required
          />
          <button className="button button-primary" type="submit" disabled={submitting}>
            {submitting ? "Sending…" : "Send sign-in link"}
            {!submitting && <span aria-hidden="true">→</span>}
          </button>
        </form>

        {message && <p className="auth-message" role="status">{message}</p>}
        {errorMessage && <p className="auth-error" role="alert">{errorMessage}</p>}

        <div className="auth-note">
          <strong>Local ticket data stays on this device.</strong>
          <p>Signing in verifies access; it does not upload saved tickets.</p>
        </div>
      </section>
    </main>
  );
}
