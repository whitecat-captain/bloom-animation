"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, type ReactNode } from "react";

const STUDIO_HREF = "/studio";
let studioBundlePromise: Promise<unknown> | null = null;
let studioWarmupStarted = false;

function preloadStudioBundle() {
  studioBundlePromise ??= import("./StudioCanvas");
  return studioBundlePromise;
}

function useStudioWarmup() {
  const router = useRouter();

  return useCallback(() => {
    if (studioWarmupStarted) return;
    studioWarmupStarted = true;
    router.prefetch(STUDIO_HREF);
    void preloadStudioBundle();
  }, [router]);
}

export function StudioRoutePreloader() {
  const warmStudio = useStudioWarmup();

  useEffect(() => {
    if (typeof window.requestIdleCallback !== "function") {
      const timeout = window.setTimeout(warmStudio, 1800);
      return () => window.clearTimeout(timeout);
    }

    const idle = window.requestIdleCallback(warmStudio, { timeout: 2400 });
    return () => window.cancelIdleCallback(idle);
  }, [warmStudio]);

  return null;
}

type StudioCtaLinkProps = {
  ariaLabel: string;
  children: ReactNode;
  className: string;
};

export function StudioCtaLink({
  ariaLabel,
  children,
  className,
}: StudioCtaLinkProps) {
  const warmStudio = useStudioWarmup();

  useEffect(() => {
    const timeout = window.setTimeout(warmStudio, 350);
    return () => window.clearTimeout(timeout);
  }, [warmStudio]);

  return (
    <Link
      aria-label={ariaLabel}
      className={className}
      href={STUDIO_HREF}
      onFocus={warmStudio}
      onPointerEnter={warmStudio}
      onTouchStart={warmStudio}
      prefetch
    >
      {children}
    </Link>
  );
}
