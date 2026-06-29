import { useEffect, type RefObject } from "react";
import gsap from "gsap";
import { Observer } from "gsap/Observer";
import { ScrollToPlugin } from "gsap/ScrollToPlugin";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { createFlowerScene, type FlowerSceneApi } from "./flowerScene";

type FlowerSceneScrollRefs = {
  rootRef: RefObject<HTMLDivElement | null>;
  canvasRef: RefObject<HTMLDivElement | null>;
  guiRef: RefObject<HTMLDivElement | null>;
  tabsRef: RefObject<HTMLDivElement | null>;
  railNoRef: RefObject<HTMLSpanElement | null>;
  sceneRef: RefObject<FlowerSceneApi | null>;
};

export function useFlowerSceneScroll({
  rootRef,
  canvasRef,
  guiRef,
  tabsRef,
  railNoRef,
  sceneRef,
}: FlowerSceneScrollRefs) {
  useEffect(() => {
    if (!rootRef.current || !canvasRef.current || !guiRef.current) return;
    const scene = createFlowerScene(
      canvasRef.current,
      guiRef.current,
      tabsRef.current,
    );
    sceneRef.current = scene;

    const reduceMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    if (reduceMotion) {
      scene.setBloom(scene.bloomMax);
      return () => {
        scene.dispose();
        sceneRef.current = null;
      };
    }

    gsap.registerPlugin(ScrollTrigger, Observer, ScrollToPlugin);

    const sections = gsap.utils.toArray<HTMLElement>(
      ".story section",
      rootRef.current,
    );
    let snapPoints: number[] = [];
    const computeSnapPoints = () => {
      const dist = ScrollTrigger.maxScroll(window);
      snapPoints =
        dist > 0 ? sections.map((s) => Math.min(s.offsetTop / dist, 1)) : [];
    };

    let snapObserver: Observer | null = null;
    let animating = false;
    // Locked for the whole duration of one scroll gesture (incl. trackpad
    // inertia). Released by the Observer's onStop once wheel events truly stop,
    // so momentum tails can't trigger a second unwanted section jump.
    let gestureLocked = false;
    const zoomWithCommandScroll = (event: WheelEvent) => {
      if (!event.metaKey) return;
      event.preventDefault();
      event.stopImmediatePropagation();
      scene.zoomBy(event.deltaY);
    };
    window.addEventListener("wheel", zoomWithCommandScroll, {
      capture: true,
      passive: false,
    });

    const ctx = gsap.context(() => {
      gsap
        .timeline({ defaults: { ease: "power4.out" } })
        .from(".hero-line", {
          yPercent: 45,
          opacity: 0,
          duration: 1.0,
          stagger: 0.14,
          delay: 0.2,
        })
        .from(".scroll-cue, .rail", { opacity: 0, duration: 0.8 }, "-=0.4");

      const proxy = { bloom: 0.04, rot: 0 };
      const apply = () => {
        scene.setBloom(proxy.bloom);
        scene.setRotation(proxy.rot);
      };
      apply();

      const finePointer = window.matchMedia(
        "(hover: hover) and (pointer: fine)",
      ).matches;
      const tl = gsap.timeline({
        defaults: { ease: "none", duration: 1 },
        onUpdate: apply,
        scrollTrigger: {
          trigger: ".story",
          start: "top top",
          end: "bottom bottom",
          scrub: true,
          snap: finePointer
            ? undefined
            : {
                snapTo: (v: number) => {
                  const dist = ScrollTrigger.maxScroll(window);
                  let best = v;
                  let bd = Infinity;
                  for (const p of snapPoints) {
                    const d = Math.abs(p - v);
                    if (d < bd) {
                      bd = d;
                      best = p;
                    }
                  }
                  return bd * dist < window.innerHeight * 0.45 ? best : v;
                },
                duration: { min: 0.25, max: 0.65 },
                delay: 0.06,
                ease: "power2.out",
              },
        },
      });

      [0.1, 0.18, 0.3, 0.55, 0.68, scene.bloomMax].forEach((b) =>
        tl.to(proxy, { bloom: b }),
      );
      tl.to(proxy, { rot: Math.PI * 1.5, duration: 6 }, 0);

      gsap.utils.toArray<HTMLElement>(".step-card").forEach((card) => {
        gsap.from(card, {
          y: 48,
          opacity: 0,
          duration: 0.6,
          ease: "power3.out",
          scrollTrigger: {
            trigger: card,
            start: "top 85%",
            toggleActions: "play none none reverse",
          },
        });
      });
      gsap.from(".finale-inner > *", {
        y: 40,
        opacity: 0,
        duration: 0.9,
        stagger: 0.1,
        ease: "power3.out",
        scrollTrigger: {
          trigger: ".finale",
          start: "top 70%",
          toggleActions: "play none none reverse",
        },
      });

      gsap.to(".rail-fill", {
        scaleY: 1,
        ease: "none",
        scrollTrigger: {
          trigger: ".story",
          start: "top top",
          end: "bottom bottom",
          scrub: true,
        },
      });
      gsap.utils.toArray<HTMLElement>("[data-step]").forEach((sec) => {
        const label = sec.dataset.step!;
        ScrollTrigger.create({
          trigger: sec,
          start: "top 55%",
          end: "bottom 55%",
          onToggle: (self) => {
            if (self.isActive && railNoRef.current) {
              railNoRef.current.textContent = label;
            }
          },
        });
      });
    }, rootRef);

    computeSnapPoints();
    ScrollTrigger.addEventListener("refresh", computeSnapPoints);

    const gotoY = (yTarget: number) => {
      animating = true;
      gsap.to(window, {
        scrollTo: { y: yTarget, autoKill: false },
        duration: 0.7,
        ease: "power2.inOut",
        overwrite: true,
        onComplete: () => {
          animating = false;
        },
        onInterrupt: () => {
          animating = false;
        },
      });
    };

    const currentIndex = () => {
      const mid = window.scrollY + window.innerHeight / 2;
      let idx = 0;
      let best = Infinity;
      sections.forEach((s, i) => {
        const d = Math.abs(s.offsetTop + s.offsetHeight / 2 - mid);
        if (d < best) {
          best = d;
          idx = i;
        }
      });
      return idx;
    };

    const stepSection = (dir: 1 | -1) => {
      // One section per gesture: ignore everything until the gesture (and its
      // inertia) ends and onStop releases the lock.
      if (gestureLocked || animating) return;
      gestureLocked = true;
      const next = currentIndex() + dir;
      if (next < 0 || next >= sections.length) return;
      gotoY(sections[next].offsetTop);
    };

    const syncObserver = () => {
      const enable = window.matchMedia(
        "(hover: hover) and (pointer: fine)",
      ).matches;
      if (enable && !snapObserver) {
        snapObserver = Observer.create({
          target: window,
          type: "wheel,touch",
          tolerance: 10,
          preventDefault: true,
          ignore: ".gui-container",
          onDown: () => stepSection(1),
          onUp: () => stepSection(-1),
          // Fires once wheel/touch events have been quiet for onStopDelay —
          // i.e. the user has stopped AND trackpad inertia has died down. Only
          // then do we accept the next gesture.
          onStop: () => {
            gestureLocked = false;
          },
          onStopDelay: 0.2,
        });
      } else if (!enable && snapObserver) {
        snapObserver.kill();
        snapObserver = null;
      }
    };
    syncObserver();
    window.addEventListener("resize", syncObserver);

    return () => {
      window.removeEventListener("wheel", zoomWithCommandScroll, true);
      window.removeEventListener("resize", syncObserver);
      ScrollTrigger.removeEventListener("refresh", computeSnapPoints);
      snapObserver?.kill();
      gsap.killTweensOf(window);
      ctx.revert();
      scene.dispose();
      sceneRef.current = null;
    };
  }, [canvasRef, guiRef, tabsRef, railNoRef, rootRef, sceneRef]);
}
