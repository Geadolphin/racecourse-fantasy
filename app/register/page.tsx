"use client";

import { FormEvent, useState } from "react";
import { supabase } from "../../lib/supabase";

export default function RegisterPage() {
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [message, setMessage] = useState("");
  const [messageType, setMessageType] =
    useState<"success" | "error" | "">("");

  const [loading, setLoading] = useState(false);

  async function handleRegister(
    event: FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    setLoading(true);
    setMessage("");
    setMessageType("");

    const cleanDisplayName = displayName.trim();

    if (cleanDisplayName.length < 2) {
      setMessage(
        "Display name must be at least 2 characters."
      );
      setMessageType("error");
      setLoading(false);
      return;
    }

    /*
     * Check first so the user gets a friendly message
     * before attempting account creation.
     *
     * The database unique index remains the final
     * protection against two people choosing the same
     * name at exactly the same time.
     */
    const {
      data: existingProfile,
      error: displayNameCheckError,
    } = await supabase
      .from("profiles")
      .select("id")
      .ilike(
        "display_name",
        cleanDisplayName
      )
      .limit(1)
      .maybeSingle();

    if (displayNameCheckError) {
      console.error(
        "Display name availability error:",
        displayNameCheckError
      );

      setMessage(
        "Unable to check that display name. Please try again."
      );
      setMessageType("error");
      setLoading(false);
      return;
    }

    if (existingProfile) {
      setMessage(
        "That display name is already taken. Please choose another."
      );
      setMessageType("error");
      setLoading(false);
      return;
    }

    const { error } = await supabase.auth.signUp({
      email: email.trim(),
      password,
      options: {
        data: {
          display_name: cleanDisplayName,
        },
      },
    });

    if (error) {
      console.error("Registration error:", error);

      /*
       * PostgreSQL unique violation.
       *
       * This catches the small race-condition window
       * where two people submit the same display name
       * between the availability check and account
       * creation.
       */
      if (
        error.code === "23505" ||
        error.message
          .toLowerCase()
          .includes("duplicate") ||
        error.message
          .toLowerCase()
          .includes("unique")
      ) {
        setMessage(
          "That display name is already taken. Please choose another."
        );
      } else {
        setMessage(error.message);
      }

      setMessageType("error");
      setLoading(false);
      return;
    }

    setMessage(
      "Account created. Check your email for a confirmation link."
    );
    setMessageType("success");

    setDisplayName("");
    setEmail("");
    setPassword("");
    setLoading(false);
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-gray-100 p-6">
      <div className="w-full max-w-md rounded-xl bg-white p-8 shadow-md">
        <h1 className="mb-6 text-3xl font-bold text-gray-950">
          Create Account
        </h1>

        <form
          onSubmit={handleRegister}
          className="space-y-4"
        >
          <div>
            <label
              htmlFor="displayName"
              className="mb-1 block font-medium text-gray-800"
            >
              Display name
            </label>

            <input
              id="displayName"
              type="text"
              value={displayName}
              onChange={(event) => {
                setDisplayName(event.target.value);

                if (messageType === "error") {
                  setMessage("");
                  setMessageType("");
                }
              }}
              required
              minLength={2}
              maxLength={30}
              autoComplete="nickname"
              className="w-full rounded-md border border-gray-300 px-3 py-2 outline-none transition focus:border-black focus:ring-2 focus:ring-gray-200"
            />

            <p className="mt-1 text-xs text-gray-500">
              Display names must be unique.
            </p>
          </div>

          <div>
            <label
              htmlFor="email"
              className="mb-1 block font-medium text-gray-800"
            >
              Email
            </label>

            <input
              id="email"
              type="email"
              value={email}
              onChange={(event) =>
                setEmail(event.target.value)
              }
              required
              autoComplete="email"
              className="w-full rounded-md border border-gray-300 px-3 py-2 outline-none transition focus:border-black focus:ring-2 focus:ring-gray-200"
            />
          </div>

          <div>
            <label
              htmlFor="password"
              className="mb-1 block font-medium text-gray-800"
            >
              Password
            </label>

            <input
              id="password"
              type="password"
              value={password}
              onChange={(event) =>
                setPassword(event.target.value)
              }
              required
              minLength={8}
              autoComplete="new-password"
              className="w-full rounded-md border border-gray-300 px-3 py-2 outline-none transition focus:border-black focus:ring-2 focus:ring-gray-200"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-md bg-black px-4 py-2 font-semibold text-white transition hover:bg-gray-800 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {loading
              ? "Creating account..."
              : "Register"}
          </button>
        </form>

        {message && (
          <div
            className={`mt-4 rounded-lg border px-4 py-3 text-sm font-medium ${
              messageType === "success"
                ? "border-green-200 bg-green-50 text-green-800"
                : "border-red-200 bg-red-50 text-red-700"
            }`}
          >
            {message}
          </div>
        )}
      </div>
    </main>
  );
}