import { useState, useCallback } from 'react';
import { apiGet } from '@/lib/api';

export interface InstitutionCodeVerification {
  valid: boolean;
  institution?: { id: string; name: string };
}

export function useVerifyInstitutionCode() {
  const [verificationState, setVerificationState] = useState<InstitutionCodeVerification | null>(
    null,
  );
  const [isVerifying, setIsVerifying] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const verifyCode = useCallback(async (code: string, institutionId: string) => {
    if (!code.trim() || !institutionId) {
      setVerificationState(null);
      setError(null);
      return;
    }

    setIsVerifying(true);
    setError(null);

    try {
      const result = await apiGet<InstitutionCodeVerification>(
        `/institutions/verify-code?code=${encodeURIComponent(code.trim())}`,
      );

      // If the code is valid but the institution doesn't match what was selected,
      // treat it as invalid for registration purposes.
      if (result.valid && result.institution?.id !== institutionId) {
        setVerificationState({ valid: false });
        setError('The institution code does not match the selected institution');
      } else {
        setVerificationState(result);
      }
    } catch {
      setVerificationState({ valid: false });
      setError('Could not verify institution code');
    } finally {
      setIsVerifying(false);
    }
  }, []);

  const reset = useCallback(() => {
    setVerificationState(null);
    setError(null);
    setIsVerifying(false);
  }, []);

  return { verificationState, isVerifying, error, verifyCode, reset };
}
