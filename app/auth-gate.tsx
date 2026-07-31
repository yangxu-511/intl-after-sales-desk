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
  const [password, setPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
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

    void supabase.auth.getSession().then(async ({ data, error }) => {
      if (error) {
        setErrorMessage("Secure sign-in is temporarily unavailable. Please try again.");
        setChecking(false);
        return;
      }

      if (!data.session) {
        acceptSession(null);
        return;
      }

      const { data: userData, error: userError } = await supabase.auth.getUser();
      if (userError) {
        setErrorMessage("Secure sign-in is temporarily unavailable. Please try again.");
        setChecking(false);
        return;
      }
      acceptSession({ ...data.session, user: userData.user });
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

  const mustChangePassword =
    session?.user.user_metadata?.must_change_password === true;

  async function requestSignIn(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrorMessage("");

    const address = email.trim().toLowerCase();
    if (!ALLOWED_EMAILS.has(address)) {
      setErrorMessage("This email is not on the approved access list.");
      return;
    }

    setSubmitting(true);
    const { error } = await supabase.auth.signInWithPassword({
      email: address,
      password,
    });

    setSubmitting(false);
    if (error) {
      setErrorMessage(
        error.message.toLowerCase().includes("invalid login")
          ? "The email or password is incorrect."
          : "Sign-in is temporarily unavailable. Please try again.",
      );
      return;
    }
    setPassword("");
  }

  async function changePassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrorMessage("");

    if (newPassword.length < 8) {
      setErrorMessage("Your new password must contain at least 8 characters.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setErrorMessage("The two new passwords do not match.");
      return;
    }

    setSubmitting(true);
    const { data, error } = await supabase.auth.updateUser({
      password: newPassword,
      data: {
        ...session?.user.user_metadata,
        must_change_password: false,
      },
    });
    setSubmitting(false);

    if (error) {
      setErrorMessage("The password could not be updated. Please try again.");
      return;
    }

    setNewPassword("");
    setConfirmPassword("");
    setSession((currentSession) =>
      currentSession ? { ...currentSession, user: data.user } : currentSession,
    );
  }

  async function signOut() {
    setErrorMessage("");
    const { error } = await supabase.auth.signOut();
    if (error) {
      setErrorMessage("Sign-out failed. Please refresh the page and try again.");
      return;
    }
    setPassword("");
    setNewPassword("");
    setConfirmPassword("");
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

  if (user && mustChangePassword) {
    return (
      <main className="auth-page">
        <section className="auth-card" aria-labelledby="password-change-title">
          <div className="auth-brand">
            <span className="brand-mark">G</span>
            <div>
              <strong>International Service Desk</strong>
              <small>{user.email}</small>
            </div>
          </div>

          <div className="auth-copy">
            <span className="section-kicker">FIRST SIGN-IN</span>
            <h1 id="password-change-title">Create a new password</h1>
            <p>
              Your account is using a temporary password. Choose a private
              password before continuing to the service desk.
            </p>
          </div>

          <form className="auth-form" onSubmit={changePassword}>
            <label htmlFor="new-password">New password</label>
            <input
              id="new-password"
              type="password"
              value={newPassword}
              onChange={(event) => setNewPassword(event.target.value)}
              autoComplete="new-password"
              minLength={8}
              required
            />
            <label htmlFor="confirm-password">Confirm new password</label>
            <input
              id="confirm-password"
              type="password"
              value={confirmPassword}
              onChange={(event) => setConfirmPassword(event.target.value)}
              autoComplete="new-password"
              minLength={8}
              required
            />
            <button className="button button-primary" type="submit" disabled={submitting}>
              {submitting ? "Updating…" : "Update password and continue"}
              {!submitting && <span aria-hidden="true">→</span>}
            </button>
            <button className="text-button" type="button" onClick={() => void signOut()}>
              Sign out and use another account
            </button>
          </form>

          {errorMessage && <p className="auth-error" role="alert">{errorMessage}</p>}

          <div className="auth-note">
            <strong>Use at least 8 characters.</strong>
            <p>Choose a private password and do not share it with other users.</p>
          </div>
        </section>
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
            Enter your approved work email and password to open the service
            desk.
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
          <label htmlFor="sign-in-password">Password</label>
          <input
            id="sign-in-password"
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            autoComplete="current-password"
            required
          />
          <button className="button button-primary" type="submit" disabled={submitting}>
            {submitting ? "Signing in…" : "Sign in"}
            {!submitting && <span aria-hidden="true">→</span>}
          </button>
        </form>

        {errorMessage && <p className="auth-error" role="alert">{errorMessage}</p>}

        <div className="auth-note">
          <strong>Local ticket data stays on this device.</strong>
          <p>Signing in verifies access; it does not upload saved tickets.</p>
        </div>
      </section>
    </main>
  );
}
