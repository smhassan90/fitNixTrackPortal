'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { getPlatformSessionSecondsLeft } from '@/lib/platform/platformSession';
import { platformLoginUrl } from '@/lib/platform/sessionRedirect';

function formatMinutes(seconds: number): string {
  if (seconds < 60) return 'less than a minute';
  const m = Math.ceil(seconds / 60);
  return m === 1 ? '1 minute' : `${m} minutes`;
}

export default function PlatformSessionBanner() {
  const [secondsLeft, setSecondsLeft] = useState<number | null>(null);

  useEffect(() => {
    const tick = () => setSecondsLeft(getPlatformSessionSecondsLeft());
    tick();
    const id = window.setInterval(tick, 30_000);
    return () => window.clearInterval(id);
  }, []);

  if (secondsLeft === null || secondsLeft > 15 * 60) return null;

  const urgent = secondsLeft <= 2 * 60;
  const loginHref = platformLoginUrl('expired');

  return (
    <div
      className={`mb-4 rounded-lg border px-4 py-3 text-sm ${
        urgent
          ? 'border-error bg-error-light/40 text-error-dark'
          : 'border-warning bg-warning-light/40 text-warning-dark'
      }`}
      role="status"
    >
      <p className="font-medium">
        {urgent ? 'Session expiring very soon' : 'Session expiring soon'}
      </p>
      <p className="mt-1">
        Your platform sign-in expires in {formatMinutes(secondsLeft)}. Finish and submit forms now, or{' '}
        <Link href={loginHref} className="font-semibold underline">
          sign in again
        </Link>{' '}
        to extend your session without losing this page.
      </p>
    </div>
  );
}
