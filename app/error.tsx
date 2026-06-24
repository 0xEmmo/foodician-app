'use client';

import NotFoundPage from './not-found';

export default function Error({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  void reset;
  return <NotFoundPage />;
}
