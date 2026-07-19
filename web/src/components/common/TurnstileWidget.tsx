import { useEffect, useId, useRef } from "react";

declare global {
  interface Window {
    turnstile?: {
      render: (
        el: HTMLElement,
        opts: {
          sitekey: string;
          callback: (token: string) => void;
          "error-callback"?: () => void;
          "expired-callback"?: () => void;
          theme?: "light" | "dark" | "auto";
          size?: "normal" | "compact" | "flexible";
        },
      ) => string;
      reset: (widgetId?: string) => void;
      remove: (widgetId?: string) => void;
    };
    onTurnstileLoad?: () => void;
  }
}

const SITE_KEY = import.meta.env.PUBLIC_TURNSTILE_SITE_KEY as string | undefined;
const SCRIPT_ID = "cf-turnstile-script";

type Props = {
  onToken: (token: string) => void;
  onExpire?: () => void;
  className?: string;
};

export function isTurnstileEnabled() {
  return Boolean(SITE_KEY);
}

export default function TurnstileWidget({ onToken, onExpire, className = "" }: Props) {
  const elRef = useRef<HTMLDivElement>(null);
  const widgetId = useRef<string | null>(null);
  const uid = useId().replace(/:/g, "");
  const onTokenRef = useRef(onToken);
  const onExpireRef = useRef(onExpire);
  onTokenRef.current = onToken;
  onExpireRef.current = onExpire;

  useEffect(() => {
    if (!SITE_KEY || !elRef.current) return;

    function render() {
      if (!elRef.current || !window.turnstile || !SITE_KEY) return;
      if (widgetId.current) {
        try {
          window.turnstile.remove(widgetId.current);
        } catch {
          /* ignore */
        }
        widgetId.current = null;
      }
      widgetId.current = window.turnstile.render(elRef.current, {
        sitekey: SITE_KEY,
        theme: "light",
        size: "flexible",
        callback: (token) => onTokenRef.current(token),
        "expired-callback": () => {
          onTokenRef.current("");
          onExpireRef.current?.();
        },
        "error-callback": () => {
          onTokenRef.current("");
        },
      });
    }

    if (window.turnstile) {
      render();
    } else {
      const prev = window.onTurnstileLoad;
      window.onTurnstileLoad = () => {
        prev?.();
        render();
      };
      if (!document.getElementById(SCRIPT_ID)) {
        const s = document.createElement("script");
        s.id = SCRIPT_ID;
        s.src =
          "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit&onload=onTurnstileLoad";
        s.async = true;
        s.defer = true;
        document.head.appendChild(s);
      }
    }

    return () => {
      if (widgetId.current && window.turnstile) {
        try {
          window.turnstile.remove(widgetId.current);
        } catch {
          /* ignore */
        }
        widgetId.current = null;
      }
    };
  }, []);

  if (!SITE_KEY) return null;

  return (
    <div className={className}>
      <div ref={elRef} id={`cf-turnstile-${uid}`} className="cf-turnstile min-h-[65px]" />
    </div>
  );
}

export function resetTurnstile() {
  try {
    window.turnstile?.reset();
  } catch {
    /* ignore */
  }
}
