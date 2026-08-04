export default function PrivacyPolicyPage() {
  return (
    <main className="mx-auto max-w-5xl px-6 py-12">
      <div className="rounded-2xl bg-white p-8 shadow-sm ring-1 ring-slate-200 md:p-12">
        <h1 className="text-4xl font-bold text-slate-900">
          Privacy Policy
        </h1>

        <p className="mt-2 text-sm text-slate-500">
          Last updated: 4 August 2026
        </p>

        <div className="mt-8 space-y-10 text-slate-700">
          <section>
            <h2 className="mb-3 text-2xl font-semibold text-slate-900">
              Introduction
            </h2>

            <p>
              Racecourse Fantasy is committed to protecting your privacy.
              This Privacy Policy explains what information we collect,
              how we use it, and the choices available to you when using
              our website.
            </p>
          </section>

          <section>
            <h2 className="mb-3 text-2xl font-semibold text-slate-900">
              1. Information We Collect
            </h2>

            <ul className="list-disc space-y-2 pl-6">
              <li>Display name</li>
              <li>Email address</li>
              <li>User account information</li>
              <li>Fantasy team selections</li>
              <li>Competition scores</li>
              <li>Rankings and statistics</li>
              <li>IP address</li>
              <li>Browser and device information</li>
              <li>Session information</li>
            </ul>
          </section>

          <section>
            <h2 className="mb-3 text-2xl font-semibold text-slate-900">
              2. How We Use Your Information
            </h2>

            <ul className="list-disc space-y-2 pl-6">
              <li>Create and manage your account</li>
              <li>Authenticate your login</li>
              <li>Store your fantasy teams</li>
              <li>Calculate scores and rankings</li>
              <li>Display leaderboards</li>
              <li>Provide customer support</li>
              <li>Improve our services</li>
              <li>Maintain website security</li>
            </ul>

            <div className="mt-6 rounded-xl border border-emerald-200 bg-emerald-50 p-4">
              <p className="font-semibold text-emerald-900">
                We do not sell your personal information.
              </p>
            </div>
          </section>

          <section>
            <h2 className="mb-3 text-2xl font-semibold text-slate-900">
              3. Public Information
            </h2>

            <p>
              The following information may be visible to other users:
            </p>

            <ul className="mt-3 list-disc space-y-2 pl-6">
              <li>Display name</li>
              <li>Team name</li>
              <li>Round ranking</li>
              <li>Overall ranking</li>
              <li>Total score</li>
              <li>Round score</li>
            </ul>

            <p className="mt-4">
              Your email address is never displayed publicly.
            </p>
          </section>

          <section>
            <h2 className="mb-3 text-2xl font-semibold text-slate-900">
              4. Authentication & Security
            </h2>

            <p>
              Racecourse Fantasy uses Supabase Authentication to securely
              manage user accounts.
            </p>

            <p className="mt-4">
              Passwords are encrypted and are never accessible to
              Racecourse Fantasy administrators.
            </p>
          </section>

          <section>
            <h2 className="mb-3 text-2xl font-semibold text-slate-900">
              5. Cookies
            </h2>

            <p>
              We use cookies and similar technologies to keep you signed
              in, remember your preferences and improve website
              performance.
            </p>
          </section>

          <section>
            <h2 className="mb-3 text-2xl font-semibold text-slate-900">
              6. Third-Party Services
            </h2>

            <p>
              Racecourse Fantasy uses trusted third-party providers to
              deliver the website, including authentication, database and
              hosting services.
            </p>
          </section>

          <section>
            <h2 className="mb-3 text-2xl font-semibold text-slate-900">
              7. Account Deletion
            </h2>

            <p>
              You may request deletion of your account at any time.
              Historical competition records may be retained in an
              anonymised form to preserve leaderboards and statistics.
            </p>
          </section>

          <section>
            <h2 className="mb-3 text-2xl font-semibold text-slate-900">
              8. Changes to this Policy
            </h2>

            <p>
              We may update this Privacy Policy from time to time. The
              latest version will always be published on this page.
            </p>
          </section>

          <section>
            <h2 className="mb-3 text-2xl font-semibold text-slate-900">
              9. Contact Us
            </h2>

            <div className="rounded-xl bg-slate-100 p-6">
              <p className="font-semibold text-slate-900">
                Racecourse Fantasy
              </p>

              <p className="mt-2">
                Email: privacy@racecoursefantasy.com
              </p>

              <p>
                Website: racecoursefantasy.com
              </p>
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}