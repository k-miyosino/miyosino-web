'use client';

import Script from 'next/script';
import { usePathname } from 'next/navigation';
import { useEffect, useRef } from 'react';

// DEBUG: 一時的にハードコード（シークレット設定確認後に元に戻す）
const measurementId = 'G-CF38V5SRBT';
const envMeasurementId = process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID;

console.log('[GA Debug] measurementId (hardcoded):', measurementId);
console.log(
  '[GA Debug] NEXT_PUBLIC_GA_MEASUREMENT_ID (env):',
  envMeasurementId || '(empty/undefined)'
);

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
 * DEBUG: measurementId is temporarily hardcoded.
 */
export function GoogleAnalytics() {
  console.log(
    '[GA Debug] GoogleAnalytics component rendering, measurementId:',
    measurementId
  );

  if (!measurementId) {
    console.log('[GA Debug] measurementId is empty, returning null');
    return null;
  }

  return (
    <>
      <Script
        src={`https://www.googletagmanager.com/gtag/js?id=${measurementId}`}
        strategy="afterInteractive"
        onLoad={() =>
          console.log('[GA Debug] gtag.js script loaded successfully')
        }
        onError={() =>
          console.error('[GA Debug] gtag.js script failed to load')
        }
      />
      <Script id="ga-config" strategy="afterInteractive">
        {`
          console.log('[GA Debug] ga-config script executing');
          window.dataLayer = window.dataLayer || [];
          function gtag(){dataLayer.push(arguments);}
          gtag('js', new Date());
          gtag('config', '${measurementId}');
          console.log('[GA Debug] GA4 configured with ID: ${measurementId}');
          console.log('[GA Debug] window.dataLayer:', window.dataLayer);
        `}
      </Script>
      <PageViewTracker />
    </>
  );
}
