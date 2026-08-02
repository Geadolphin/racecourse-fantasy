"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

export default function AccountPage() {
  const router = useRouter();

  const [userId, setUserId] = useState("");
  const [currentEmail, setCurrentEmail] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const [loading, setLoading] = useState(true);
  const [savingProfile, setSavingProfile] = useState(false);
  const [savingEmail, setSavingEmail] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);
  const [signingOut, setSigningOut] = useState(false);

  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  useEffect(() => {
    let active = true;

    async function loadAccount() {
      setLoading(true);
      setErrorMessage("");

      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (!active) return;

      if (userError || !user) {
        router.replace("/login");
        return;
      }

      setUserId(user.id);
      setCurrentEmail(user.email ?? "");
      setNewEmail(user.email ?? "");

      const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("display_name")
        .eq("id", user.id)
        .maybeSingle();

      if (!active) return;

      if (profileError) {
        setErrorMessage(profileError.message);
      } else {
        setDisplayName(profile?.display_name ?? "");
      }

      setLoading(false);
    }

    void loadAccount();

    return () => {
      active = false;
    };
  }, [router]);

  function clearMessages() {
    setErrorMessage("");
    setSuccessMessage("");
  }

  async function updateProfile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    clearMessages();

    const cleanedName = displayName.trim();

    if (!cleanedName) {
      setErrorMessage("Please enter a display name.");
      return;
    }

    setSavingProfile(true);

    const { error } = await supabase
      .from("profiles")
      .update({
        display_name: cleanedName,
        updated_at: new Date().toISOString(),
      })
      .eq("id", userId);

    setSavingProfile(false);

    if (error) {
      setErrorMessage(error.message);
      return;
    }

    setDisplayName(cleanedName);
    setSuccessMessage("Your display name has been updated.");
  }

  async function updateEmail(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    clearMessages();

    const cleanedEmail = newEmail.trim().toLowerCase();

    if (!cleanedEmail) {
      setErrorMessage("Please enter a new email address.");
      return;
    }

    if (cleanedEmail === currentEmail.toLowerCase()) {
      setErrorMessage("That is already your current email address.");
      return;
    }

    setSavingEmail(true);

    const { error } = await supabase.auth.updateUser({
      email: cleanedEmail,
    });

    setSavingEmail(false);

    if (error) {
      setErrorMessage(error.message);
      return;
    }

    setSuccessMessage(
      "Email change requested. Check your inbox and follow the confirmation instructions."
    );
  }

  async function updatePassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    clearMessages();

    if (newPassword.length < 8) {
      setErrorMessage("Your new password must be at least 8 characters.");
      return;
    }

    if (newPassword !== confirmPassword) {
      setErrorMessage("The password confirmation does not match.");
      return;
    }

    setSavingPassword(true);

    const { error } = await supabase.auth.updateUser({
      password: newPassword,
    });

    setSavingPassword(false);

    if (error) {
      setErrorMessage(error.message);
      return;
    }

    setNewPassword("");
    setConfirmPassword("");
    setSuccessMessage("Your password has been updated.");
  }

  async function signOut() {
    clearMessages();
    setSigningOut(true);

    const { error } = await supabase.auth.signOut();

    if (error) {
      setSigningOut(false);
      setErrorMessage(error.message);
      return;
    }

    router.replace("/login");
    router.refresh();
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-slate-100 p-6">
        <div className="mx-auto max-w-4xl rounded-2xl border bg-white p-10 text-center text-slate-500">
          Loading account...
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-100 p-4 md:p-8">
      <div className="mx-auto max-w-4xl">
        <header className="rounded-2xl bg-slate-900 p-6 text-white md:p-8">
          <p className="text-sm font-semibold uppercase tracking-wider text-teal-300">
            Racecourse Fantasy
          </p>
          <h1 className="mt-2 text-3xl font-bold md:text-4xl">Account</h1>
          <p className="mt-3 text-slate-300">
            Manage your profile, email address and password.
          </p>

          <Link
            href="/dashboard"
            className="mt-6 inline-flex rounded-lg border border-slate-600 px-5 py-3 font-bold text-white hover:bg-slate-800"
          >
            Return to Dashboard
          </Link>
        </header>

        {errorMessage && (
          <div className="mt-6 rounded-xl border border-red-300 bg-red-50 p-4 text-red-800">
            {errorMessage}
          </div>
        )}

        {successMessage && (
          <div className="mt-6 rounded-xl border border-green-300 bg-green-50 p-4 text-green-800">
            {successMessage}
          </div>
        )}

        <div className="mt-6 space-y-6">
          <section className="rounded-2xl border bg-white p-6 md:p-8">
            <h2 className="text-2xl font-bold">Profile</h2>
            <p className="mt-2 text-slate-600">
              This name appears on leaderboards and player pages.
            </p>

            <form onSubmit={updateProfile} className="mt-6 space-y-4">
              <div>
                <label htmlFor="display-name" className="mb-2 block text-sm font-semibold">
                  Display name
                </label>
                <input
                  id="display-name"
                  value={displayName}
                  onChange={(event) => setDisplayName(event.target.value)}
                  maxLength={50}
                  required
                  className="w-full rounded-lg border border-slate-300 px-4 py-3 outline-none focus:border-teal-700"
                />
              </div>

              <div className="flex justify-end">
                <button
                  type="submit"
                  disabled={savingProfile}
                  className="rounded-lg bg-teal-700 px-5 py-3 font-bold text-white disabled:bg-slate-400"
                >
                  {savingProfile ? "Saving..." : "Save Profile"}
                </button>
              </div>
            </form>
          </section>

          <section className="rounded-2xl border bg-white p-6 md:p-8">
            <h2 className="text-2xl font-bold">Email Address</h2>
            <p className="mt-2 text-slate-600">
              Current email: <strong>{currentEmail || "Not available"}</strong>
            </p>

            <form onSubmit={updateEmail} className="mt-6 space-y-4">
              <div>
                <label htmlFor="new-email" className="mb-2 block text-sm font-semibold">
                  New email address
                </label>
                <input
                  id="new-email"
                  type="email"
                  value={newEmail}
                  onChange={(event) => setNewEmail(event.target.value)}
                  autoComplete="email"
                  required
                  className="w-full rounded-lg border border-slate-300 px-4 py-3 outline-none focus:border-teal-700"
                />
              </div>

              <p className="text-sm text-slate-500">
                You may need to confirm the change through email.
              </p>

              <div className="flex justify-end">
                <button
                  type="submit"
                  disabled={savingEmail}
                  className="rounded-lg bg-teal-700 px-5 py-3 font-bold text-white disabled:bg-slate-400"
                >
                  {savingEmail ? "Sending..." : "Change Email"}
                </button>
              </div>
            </form>
          </section>

          <section className="rounded-2xl border bg-white p-6 md:p-8">
            <h2 className="text-2xl font-bold">Password</h2>
            <p className="mt-2 text-slate-600">
              Choose a new password with at least 8 characters.
            </p>

            <form onSubmit={updatePassword} className="mt-6 space-y-4">
              <div>
                <label htmlFor="new-password" className="mb-2 block text-sm font-semibold">
                  New password
                </label>
                <input
                  id="new-password"
                  type="password"
                  value={newPassword}
                  onChange={(event) => setNewPassword(event.target.value)}
                  autoComplete="new-password"
                  minLength={8}
                  required
                  className="w-full rounded-lg border border-slate-300 px-4 py-3 outline-none focus:border-teal-700"
                />
              </div>

              <div>
                <label htmlFor="confirm-password" className="mb-2 block text-sm font-semibold">
                  Confirm new password
                </label>
                <input
                  id="confirm-password"
                  type="password"
                  value={confirmPassword}
                  onChange={(event) => setConfirmPassword(event.target.value)}
                  autoComplete="new-password"
                  minLength={8}
                  required
                  className="w-full rounded-lg border border-slate-300 px-4 py-3 outline-none focus:border-teal-700"
                />
              </div>

              <div className="flex justify-end">
                <button
                  type="submit"
                  disabled={savingPassword}
                  className="rounded-lg bg-teal-700 px-5 py-3 font-bold text-white disabled:bg-slate-400"
                >
                  {savingPassword ? "Updating..." : "Update Password"}
                </button>
              </div>
            </form>
          </section>

          <section className="rounded-2xl border border-red-200 bg-white p-6 md:p-8">
            <h2 className="text-2xl font-bold">Sign Out</h2>
            <p className="mt-2 text-slate-600">
              Sign out of Racecourse Fantasy on this device.
            </p>

            <div className="mt-6 flex justify-end">
              <button
                type="button"
                onClick={() => void signOut()}
                disabled={signingOut}
                className="rounded-lg border border-red-300 px-5 py-3 font-bold text-red-700 hover:bg-red-50 disabled:opacity-50"
              >
                {signingOut ? "Signing out..." : "Sign Out"}
              </button>
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}