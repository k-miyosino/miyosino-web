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
 * Loads gtag.js and configures GA4.
 */
export function GoogleAnalytics() {
  if (!measurementId) {
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
          // ログイン直後のURLに含まれる認証トークンを計測対象から除外する
          var pageLocation = new URL(window.location.href);
          pageLocation.searchParams.delete('token');
          pageLocation.searchParams.delete('refresh_token');
          pageLocation.hash = '';
          gtag('config', '${measurementId}', { page_location: pageLocation.toString() });
        `}
      </Script>
      <PageViewTracker />
    </>
  );
}
