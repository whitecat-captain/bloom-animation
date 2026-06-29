import { useEffect, useState, type RefObject } from "react";

export function useDesignCtaVisibility(
  rootRef: RefObject<HTMLDivElement | null>,
) {
  const [showFullDesignCta, setShowFullDesignCta] = useState(true);

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;

    const sections = Array.from(
      root.querySelectorAll<HTMLElement>(".story section"),
    );
    let fullCtaVisible = true;

    const syncDesignCta = () => {
      const viewportCenter = window.scrollY + window.innerHeight / 2;
      const activeSection =
        sections.find(
          (section) =>
            viewportCenter >= section.offsetTop &&
            viewportCenter < section.offsetTop + section.offsetHeight,
        ) ?? sections[0];
      const shouldShowFull =
        activeSection.classList.contains("hero-section") ||
        activeSection.classList.contains("finale");

      if (fullCtaVisible !== shouldShowFull) {
        fullCtaVisible = shouldShowFull;
        setShowFullDesignCta(shouldShowFull);
      }
    };

    syncDesignCta();
    window.addEventListener("scroll", syncDesignCta, { passive: true });
    window.addEventListener("resize", syncDesignCta);

    return () => {
      window.removeEventListener("scroll", syncDesignCta);
      window.removeEventListener("resize", syncDesignCta);
    };
  }, [rootRef]);

  return showFullDesignCta;
}
