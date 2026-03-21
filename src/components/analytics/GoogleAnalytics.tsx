'use client';

import Script from 'next/script';
import { usePathname } from 'next/navigation';
import { useEffect, useRef } from 'react';

const measurementId = process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID;

/**
 * Sends page_view to GA4 on client-side navigation (pathname change).
 * Initial page load is already tracked by gtag('config') in the script.
 */
function PageViewTracker() {
  const pathname = usePathname();
  const isInitial = useRef(true);

  useEffect(() => {
    if (!measurementId) return;
    if (isInitial.current) {
      isInitial.current = false;
      return;
    }
    const gtag = (window as unknown as { gtag?: (...a: unknown[]) => void })
      .gtag;
    if (typeof window !== 'undefined' && typeof gtag === 'function') {
      gtag('event', 'page_view', {
        page_path: pathname,
        page_title:
          typeof document !== 'undefined' ? document.title : undefined,
      });
    }
  }, [pathname]);

  return null;
}

/**
 * Loads gtag.js and configures GA4. Runs only in production when NEXT_PUBLIC_GA_MEASUREMENT_ID is set.
 * Tracks page views on initial load and on client-side navigation.
 */
export function GoogleAnalytics() {
  if (!measurementId || process.env.NODE_ENV !== 'production') {
    return null;
  }

  return (
    <>
      <Script
        src={`https://www.googletagmanager.com/gtag/js?id=${measurementId}`}
        strategy="afterInteractive"
      />
      <Script id="ga-config" strategy="afterInteractive">
        {`
          window.dataLayer = window.dataLayer || [];
          function gtag(){dataLayer.push(arguments);}
          gtag('js', new Date());
          gtag('config', '${measurementId}');
        `}
      </Script>
      <PageViewTracker />
    </>
  );
}
