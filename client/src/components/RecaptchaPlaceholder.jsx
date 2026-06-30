import ReCAPTCHA from 'react-google-recaptcha';

/**
 * Google reCAPTCHA v2 "I'm not a robot" checkbox widget.
 * Uses the official react-google-recaptcha library.
 *
 * @param {{ onVerify: (token: string | null) => void }} props
 */
export default function RecaptchaPlaceholder({ onVerify }) {
  const siteKey = import.meta.env.VITE_RECAPTCHA_SITE_KEY;

  const handleChange = (token) => {
    if (onVerify) {
      onVerify(token);
    }
  };

  const handleExpired = () => {
    if (onVerify) {
      onVerify(null);
    }
  };

  if (!siteKey) {
    // Fallback if site key is not configured
    return (
      <div className="text-xs text-gray-400 p-2 border border-gray-200 rounded">
        reCAPTCHA not configured (missing VITE_RECAPTCHA_SITE_KEY)
      </div>
    );
  }

  return (
    <ReCAPTCHA
      sitekey={siteKey}
      onChange={handleChange}
      onExpired={handleExpired}
    />
  );
}
