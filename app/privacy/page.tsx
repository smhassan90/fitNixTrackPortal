import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import Link from 'next/link';
import { Outfit } from 'next/font/google';

const brandFont = Outfit({
  subsets: ['latin'],
  weight: ['500', '600', '700', '800'],
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'Privacy Policy | FitNix Track',
  description:
    'Privacy Policy for the FitNix Track Android app — how we collect, use, and protect your information.',
  robots: { index: true, follow: true },
};

const EFFECTIVE_DATE = 'July 27, 2026';
const CONTACT_EMAIL = 'dev.fynals@gmail.com';

const sections: Array<{ id: string; title: string; body: ReactNode }> = [
  {
    id: 'who-we-are',
    title: '1. Who we are',
    body: (
      <>
        <p>
          FitNix Track (&quot;FitNix,&quot; &quot;we,&quot; &quot;us,&quot; or &quot;our&quot;) provides a gym
          management platform, including the FitNix Track Android mobile application (the
          &quot;App&quot;) and related web portals. This Privacy Policy explains how we collect, use,
          store, and share information when you use the App.
        </p>
        <p>
          The App is used by gym members, trainers, and authorized gym staff in connection with a
          participating gym that uses FitNix Track.
        </p>
      </>
    ),
  },
  {
    id: 'scope',
    title: '2. Scope',
    body: (
      <p>
        This policy applies to the FitNix Track Android app available on Google Play and to the
        backend services that power sign-in, attendance, profiles, and related gym features. It does
        not cover third-party websites or apps that we do not control.
      </p>
    ),
  },
  {
    id: 'information-we-collect',
    title: '3. Information we collect',
    body: (
      <>
        <p>Depending on how you use the App, we may collect:</p>
        <ul>
          <li>
            <strong>Account and profile information</strong> — name, phone number, email address
            (including Gmail for Google Sign-In), gender, date of birth, membership or trainer
            identifiers, gym affiliation, and optional profile photo.
          </li>
          <li>
            <strong>Authentication data</strong> — phone numbers used for one-time password (OTP)
            login; Google account email and related sign-in tokens when you choose Google Sign-In.
          </li>
          <li>
            <strong>Gym activity data</strong> — check-in / check-out and attendance records,
            assigned packages or memberships, trainer assignments, and related gym history shown in
            the App.
          </li>
          <li>
            <strong>Device and usage information</strong> — device type, operating system version,
            app version, approximate crash/diagnostic logs, and basic usage events needed to operate
            and improve the App.
          </li>
          <li>
            <strong>Communications</strong> — messages you send to us for support (for example by
            email).
          </li>
        </ul>
        <p>
          Your gym&apos;s admin staff may also enter or update member/trainer details in the FitNix
          Track admin portal; that data may then appear in the App for authorized users.
        </p>
      </>
    ),
  },
  {
    id: 'how-we-use',
    title: '4. How we use your information',
    body: (
      <>
        <p>We use the information above to:</p>
        <ul>
          <li>Create and manage your account and authenticate you (OTP and/or Google Sign-In).</li>
          <li>Provide gym features such as attendance, membership status, and trainer-related views.</li>
          <li>Display your profile and gym information to authorized gym staff and, where applicable, trainers.</li>
          <li>Send transactional messages related to login (for example OTP codes).</li>
          <li>Maintain security, prevent abuse, troubleshoot issues, and improve the App.</li>
          <li>Comply with legal obligations and enforce our terms.</li>
        </ul>
        <p>We do not sell your personal information.</p>
      </>
    ),
  },
  {
    id: 'google-sign-in',
    title: '5. Google Sign-In',
    body: (
      <>
        <p>
          If you sign in with Google, we receive basic account information from Google (typically
          your email address and display name) as permitted by Google&apos;s sign-in flow and your
          consent. We use this to identify your FitNix Track account (for example matching a
          trainer or member email stored by your gym) and to keep you signed in.
        </p>
        <p>
          Google&apos;s use of data is governed by{' '}
          <a
            href="https://policies.google.com/privacy"
            target="_blank"
            rel="noopener noreferrer"
            className="text-[#337418] underline underline-offset-2 hover:text-[#5DD62C]"
          >
            Google&apos;s Privacy Policy
          </a>
          . You can revoke FitNix Track access to your Google account from your Google Account
          permissions settings.
        </p>
      </>
    ),
  },
  {
    id: 'phone-otp',
    title: '6. Phone number and OTP login',
    body: (
      <p>
        When you log in with phone OTP, we process your phone number to send verification codes and
        confirm your identity. OTP delivery may use third-party SMS or messaging providers acting
        on our behalf. Phone login remains available even if you also have an email on file for
        Google Sign-In.
      </p>
    ),
  },
  {
    id: 'sharing',
    title: '7. How we share information',
    body: (
      <>
        <p>We may share information with:</p>
        <ul>
          <li>
            <strong>Your gym</strong> — authorized gym owners, admins, and staff who use FitNix Track
            to operate the gym (for example membership and attendance records).
          </li>
          <li>
            <strong>Service providers</strong> — hosting, databases, analytics/crash reporting, and
            SMS/OTP providers who process data only to provide services to us, under appropriate
            safeguards.
          </li>
          <li>
            <strong>Legal and safety</strong> — when required by law, or to protect the rights,
            safety, and security of FitNix, users, or the public.
          </li>
          <li>
            <strong>Business transfers</strong> — in connection with a merger, acquisition, or sale
            of assets, subject to continued protection of personal information.
          </li>
        </ul>
      </>
    ),
  },
  {
    id: 'retention',
    title: '8. Data retention',
    body: (
      <p>
        We retain personal information for as long as needed to provide the App and gym services,
        meet legal, accounting, or reporting requirements, and resolve disputes. When you or your
        gym request deletion, or when data is no longer needed, we delete or anonymize it within a
        reasonable period, except where retention is required by law or legitimate gym/business
        records (for example historical attendance or billing records managed by your gym).
      </p>
    ),
  },
  {
    id: 'security',
    title: '9. Security',
    body: (
      <p>
        We use administrative, technical, and organizational measures designed to protect personal
        information (including encrypted transit where appropriate and access controls). No method
        of transmission or storage is 100% secure; we work to continuously improve our protections.
      </p>
    ),
  },
  {
    id: 'your-choices',
    title: '10. Your choices and rights',
    body: (
      <>
        <p>Depending on applicable law, you may have the right to:</p>
        <ul>
          <li>Access, correct, or update your profile information.</li>
          <li>Request deletion of your account or personal data.</li>
          <li>Withdraw consent where processing is based on consent (for example Google Sign-In).</li>
          <li>Object to or restrict certain processing.</li>
        </ul>
        <p>
          Many profile updates can be made through the App or by contacting your gym&apos;s admin.
          For privacy requests, email us at{' '}
          <a
            href={`mailto:${CONTACT_EMAIL}`}
            className="text-[#337418] underline underline-offset-2 hover:text-[#5DD62C]"
          >
            {CONTACT_EMAIL}
          </a>
          . We may need to verify your identity and may coordinate with your gym where data is held
          as a gym business record.
        </p>
      </>
    ),
  },
  {
    id: 'children',
    title: "11. Children's privacy",
    body: (
      <p>
        The App is intended for use by gym members, trainers, and staff in connection with gym
        operations. It is not directed at children under 13 (or the equivalent minimum age in your
        jurisdiction). We do not knowingly collect personal information from children under that
        age. If you believe a child has provided us personal information, contact us and we will
        take appropriate steps to delete it.
      </p>
    ),
  },
  {
    id: 'international',
    title: '12. International processing',
    body: (
      <p>
        FitNix Track may process and store information on servers located in countries other than
        where you live. Where we do so, we take steps designed to ensure an appropriate level of
        protection consistent with this policy and applicable law.
      </p>
    ),
  },
  {
    id: 'changes',
    title: '13. Changes to this policy',
    body: (
      <p>
        We may update this Privacy Policy from time to time. We will post the updated version on
        this page and revise the &quot;Effective date&quot; above. Continued use of the App after
        changes become effective constitutes acceptance of the updated policy, except where
        additional consent is required by law.
      </p>
    ),
  },
  {
    id: 'contact',
    title: '14. Contact us',
    body: (
      <>
        <p>If you have questions about this Privacy Policy or our data practices, contact:</p>
        <p className="not-prose mt-3 rounded-xl border border-black/10 bg-white px-4 py-3 text-sm text-[#0f0f0f]">
          <span className="font-semibold">FitNix Track</span>
          <br />
          Email:{' '}
          <a
            href={`mailto:${CONTACT_EMAIL}`}
            className="font-medium text-[#337418] underline underline-offset-2 hover:text-[#5DD62C]"
          >
            {CONTACT_EMAIL}
          </a>
        </p>
      </>
    ),
  },
];

export default function PrivacyPolicyPage() {
  return (
    <div className="min-h-screen bg-[#f8f8f8] text-[#0f0f0f]">
      <header className="border-b border-black/10 bg-[#0f0f0f] text-white">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-5 py-5 sm:px-6">
          <div className={brandFont.className}>
            <p className="text-lg font-extrabold tracking-tight">
              Fit<span className="text-[#5DD62C]">Nix</span> Track
            </p>
            <p className="text-xs font-medium text-white/60">Android app · Privacy Policy</p>
          </div>
          <Link
            href="/login"
            className="rounded-lg bg-[#5DD62C] px-3 py-1.5 text-sm font-semibold text-[#0f0f0f] transition hover:bg-[#337418] hover:text-white"
          >
            Portal
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-5 py-10 sm:px-6 sm:py-14">
        <div className={brandFont.className}>
          <p className="text-sm font-semibold uppercase tracking-wider text-[#337418]">Legal</p>
          <h1 className="mt-2 text-3xl font-extrabold tracking-tight sm:text-4xl">Privacy Policy</h1>
          <p className="mt-3 max-w-2xl text-base leading-relaxed text-[#202020]/90">
            How FitNix Track collects, uses, and protects information in the Android mobile app.
          </p>
          <p className="mt-4 text-sm text-black/55">Effective date: {EFFECTIVE_DATE}</p>
        </div>

        <nav
          aria-label="On this page"
          className="mt-8 rounded-2xl border border-black/10 bg-white p-5 shadow-sm"
        >
          <p className={`${brandFont.className} mb-3 text-sm font-bold text-[#0f0f0f]`}>
            On this page
          </p>
          <ol className="grid gap-2 text-sm text-[#202020] sm:grid-cols-2">
            {sections.map((section) => (
              <li key={section.id}>
                <a
                  href={`#${section.id}`}
                  className="hover:text-[#337418] hover:underline hover:underline-offset-2"
                >
                  {section.title}
                </a>
              </li>
            ))}
          </ol>
        </nav>

        <div className="mt-10 space-y-10">
          {sections.map((section) => (
            <section key={section.id} id={section.id} className="scroll-mt-8">
              <h2 className={`${brandFont.className} text-xl font-bold tracking-tight`}>
                {section.title}
              </h2>
              <div className="mt-3 space-y-3 text-[15px] leading-relaxed text-[#202020]/95 [&_ul]:list-disc [&_ul]:space-y-2 [&_ul]:pl-5 [&_strong]:font-semibold [&_strong]:text-[#0f0f0f]">
                {section.body}
              </div>
            </section>
          ))}
        </div>

        <footer className="mt-14 border-t border-black/10 pt-6 text-sm text-black/50">
          <p>© {new Date().getFullYear()} FitNix Track. All rights reserved.</p>
          <p className="mt-1">
            This page is provided for Google Play and users of the FitNix Track Android application.
          </p>
        </footer>
      </main>
    </div>
  );
}
