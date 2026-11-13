/**
 * GoogleSignInButton
 *
 * Renders a standard "Sign in with Google" button using the official
 * Google Identity Services (GIS) script. The button is styled to match
 * Google's brand guidelines while fitting within the AcadIn UI.
 *
 * Security notes:
 * - The raw ID token is never stored in localStorage or any persistent storage.
 * - The token is immediately handed to the onToken callback, which must POST it
 *   to the backend for server-side verification.
 * - VITE_GOOGLE_CLIENT_ID must be set; if it is absent the button renders
 *   a disabled fallback rather than throwing.
 */

import { useEffect, useRef, useCallback } from 'react';

// Minimal GIS types — only what we use.
interface GISCredentialResponse {
  credential: string; // The ID token
}

interface GISButtonConfiguration {
  type?: 'standard' | 'icon';
  theme?: 'outline' | 'filled_blue' | 'filled_black';
  size?: 'large' | 'medium' | 'small';
  text?: 'signin_with' | 'signup_with' | 'continue_with' | 'signin';
  shape?: 'rectangular' | 'pill' | 'circle' | 'square';
  width?: number;
  locale?: string;
}

interface GoogleIdentityServices {
  accounts: {
    id: {
      initialize: (config: {
        client_id: string;
        callback: (response: GISCredentialResponse) => void;
        auto_select?: boolean;
        cancel_on_tap_outside?: boolean;
        itp_support?: boolean;
      }) => void;
      renderButton: (element: HTMLElement, config: GISButtonConfiguration) => void;
      prompt: () => void;
      disableAutoSelect: () => void;
      revoke: (hint: string, callback: () => void) => void;
    };
  };
}

declare global {
  interface Window {
    google?: GoogleIdentityServices;
    onGoogleLibraryLoad?: () => void;
  }
}

interface GoogleSignInButtonProps {
  onToken: (idToken: string) => void;
  disabled?: boolean;
  text?: 'signin_with' | 'signup_with' | 'continue_with';
  /** Full pixel width; GIS requires at least 200. Defaults to the container width up to 400. */
  width?: number;
}

const GIS_SCRIPT_ID = 'google-identity-services';
const CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID as string | undefined;

function loadGisScript(): Promise<void> {
  return new Promise((resolve, reject) => {
    if (window.google?.accounts) {
      resolve();
      return;
    }
    if (document.getElementById(GIS_SCRIPT_ID)) {
      // Script already loading — wait for it.
      const existing = document.getElementById(GIS_SCRIPT_ID) as HTMLScriptElement;
      existing.addEventListener('load', () => resolve());
      existing.addEventListener('error', () => reject(new Error('GIS script failed to load')));
      return;
    }
    const script = document.createElement('script');
    script.id = GIS_SCRIPT_ID;
    script.src = 'https://accounts.google.com/gsi/client';
    script.async = true;
    script.defer = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('Failed to load Google Identity Services script'));
    document.head.appendChild(script);
  });
}

export default function GoogleSignInButton({
  onToken,
  disabled = false,
  text = 'signin_with',
  width,
}: GoogleSignInButtonProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const initializedRef = useRef(false);

  const handleCredentialResponse = useCallback(
    (response: GISCredentialResponse) => {
      if (response.credential) {
        onToken(response.credential);
      }
    },
    [onToken],
  );

  useEffect(() => {
    if (!CLIENT_ID || disabled || initializedRef.current) return;

    let mounted = true;

    loadGisScript()
      .then(() => {
        if (!mounted || !containerRef.current || !window.google?.accounts) return;
        if (initializedRef.current) return;
        initializedRef.current = true;

        window.google.accounts.id.initialize({
          client_id: CLIENT_ID,
          callback: handleCredentialResponse,
          auto_select: false,
          cancel_on_tap_outside: true,
          itp_support: true,
        });

        // Calculate a sensible width: use the container width clamped to [200, 400],
        // or use the explicit prop if provided.
        const containerWidth = containerRef.current.getBoundingClientRect().width;
        const resolvedWidth =
          width ?? Math.min(Math.max(Math.floor(containerWidth) || 400, 200), 400);

        window.google.accounts.id.renderButton(containerRef.current, {
          type: 'standard',
          theme: 'outline',
          size: 'large',
          text,
          shape: 'rectangular',
          width: resolvedWidth,
        });
      })
      .catch((err: Error) => {
        if (mounted) {
          console.error('[GoogleSignInButton] Failed to load GIS:', err.message);
        }
      });

    return () => {
      mounted = false;
    };
  }, [disabled, handleCredentialResponse, text, width]);

  if (!CLIENT_ID) {
    return (
      <button
        type="button"
        disabled
        className="w-full h-10 flex items-center justify-center gap-2 rounded-lg border border-slate-200 bg-slate-50 text-sm text-slate-400 cursor-not-allowed dark:border-slate-700 dark:bg-slate-800"
        aria-label="Google Sign-In not configured"
      >
        <GoogleIconSVG className="w-4 h-4 opacity-40" />
        Sign in with Google (not configured)
      </button>
    );
  }

  return (
    // Wrapper is `relative` so the disabled overlay can be positioned over the
    // GIS iframe. The GIS button is an <iframe> injected by Google's script and
    // does not respect HTML `disabled` or React props — an overlay is the only
    // reliable way to block interaction while a request is in flight.
    <div className="relative w-full">
      <div
        ref={containerRef}
        className="w-full overflow-hidden"
        style={{ minHeight: '40px' }}
        aria-label={text === 'signup_with' ? 'Sign up with Google' : 'Sign in with Google'}
      />
      {disabled && (
        <div
          className="absolute inset-0 cursor-not-allowed"
          aria-hidden="true"
          style={{ background: 'transparent' }}
        />
      )}
    </div>
  );
}

/** Inline Google "G" logo SVG — avoids a network request for an icon. */
function GoogleIconSVG({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      aria-hidden="true"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
        fill="#4285F4"
      />
      <path
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
        fill="#34A853"
      />
      <path
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"
        fill="#FBBC05"
      />
      <path
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
        fill="#EA4335"
      />
    </svg>
  );
}
