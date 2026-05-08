import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import toast from 'react-hot-toast';
import { createUserWithEmailAndPassword, updateProfile } from 'firebase/auth';
import { auth } from '@/lib/firebase';
import { doc, setDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuthStore } from '@/stores/useAuthStore';
import { buildNewUserProfileDocument } from '@/services/userProfileDocument';
import { buildApiUrl } from '@/lib/apiConfig';

interface LocationState {
  email: string;
  password: string;
  fullName: string;
}

const VerifyEmail = () => {
  const [otp, setOtp] = useState(['', '', '', '', '', '']);
  const [loading, setLoading] = useState(false);
  const [resendLoading, setResendLoading] = useState(false);
  const [countdown, setCountdown] = useState(60);
  const [canResend, setCanResend] = useState(false);
  const [verificationSent, setVerificationSent] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);
  
  const state = location.state as LocationState;
  const email = state?.email || '';
  const password = state?.password || '';
  const fullName = state?.fullName || '';

  useEffect(() => {
    if (!email || !password || !fullName) {
      toast.error('Invalid registration data');
      navigate('/register');
      return;
    }

    // Send initial verification code
    sendVerificationCode();
  }, [email, password, fullName, navigate]);

  useEffect(() => {
    if (!verificationSent) return;

    // Start countdown timer
    const timer = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          setCanResend(true);
          clearInterval(timer);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [verificationSent]);

  const sendVerificationCode = async () => {
    try {
      // Call backend API to send OTP
      const response = await fetch(buildApiUrl('/otp/send'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Failed to send OTP');
      }

      // In development, the OTP is returned in the response
      if (data.otp) {
        toast.success(`Verification code sent! Check your email or console in dev mode`);
      } else {
        toast.success(`Verification code sent to ${email}`);
      }
      
      setVerificationSent(true);
    } catch (error: any) {
      toast.error(error.message || 'Failed to send verification code');
    }
  };

  const handleOtpChange = (index: number, value: string) => {
    if (value.length > 1) {
      value = value[0];
    }

    const newOtp = [...otp];
    newOtp[index] = value;
    setOtp(newOtp);

    // Auto-focus next input
    if (value && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && !otp[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const pastedData = e.clipboardData.getData('text').slice(0, 6);
    const newOtp = [...otp];
    
    for (let i = 0; i < pastedData.length; i++) {
      if (i < 6 && /^\d$/.test(pastedData[i])) {
        newOtp[i] = pastedData[i];
      }
    }
    
    setOtp(newOtp);
    
    // Focus last filled input or next empty
    const lastFilledIndex = newOtp.findIndex(val => !val);
    const focusIndex = lastFilledIndex === -1 ? 5 : lastFilledIndex;
    inputRefs.current[focusIndex]?.focus();
  };

  const handleVerify = async () => {
    const otpCode = otp.join('');
    
    if (otpCode.length !== 6) {
      toast.error('Please enter the complete 6-digit code');
      return;
    }

    setLoading(true);

    try {
      // Verify OTP with backend
      const verifyResponse = await fetch(buildApiUrl('/otp/verify'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email, otp: otpCode }),
      });

      const verifyData = await verifyResponse.json();

      if (!verifyResponse.ok) {
        const errorMessage = verifyData.message || 'Invalid verification code';
        if (verifyData.attemptsLeft !== undefined && verifyData.attemptsLeft > 0) {
          toast.error(`${errorMessage} (${verifyData.attemptsLeft} attempts remaining)`);
        } else {
          toast.error(errorMessage);
        }
        setOtp(['', '', '', '', '', '']);
        inputRefs.current[0]?.focus();
        return;
      }

      // OTP verified successfully - now create the Firebase account
      toast.success('Email verified! Creating your account...');

      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;

      // Update profile with display name
      await updateProfile(user, {
        displayName: fullName,
      });

      // Create user document in Firestore
      await setDoc(doc(db, "users", user.uid), buildNewUserProfileDocument(user, {
        email,
        fullName,
        displayName: fullName,
        imageUrl: null,
        photoURL: null,
        provider: "password",
        emailVerified: true // Mark as verified since we verified before account creation
      }));

      // Update auth store
      useAuthStore.getState().setAuthStatus(true, user.uid);
      useAuthStore.getState().setUserProfile(fullName, undefined);

      toast.success('Account created successfully!');
      navigate('/home', { replace: true });
    } catch (error: any) {
      if (error.code === 'auth/email-already-in-use') {
        toast.error('Email already in use. Please login instead.');
        navigate('/login');
      } else {
        toast.error(error.message || 'Failed to create account');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    setResendLoading(true);
    
    try {
      await sendVerificationCode();
      
      // Reset countdown
      setCountdown(60);
      setCanResend(false);
      setOtp(['', '', '', '', '', '']);
      inputRefs.current[0]?.focus();
    } catch (error: any) {
      toast.error(error.message || 'Failed to resend verification code');
    } finally {
      setResendLoading(false);
    }
  };

  const handleCancel = () => {
    navigate('/register');
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-400 via-green-500 to-green-600 relative overflow-hidden flex items-center justify-center p-8">
      <div className="relative z-10 w-full max-w-md">
        {/* Mobile & Desktop Layout */}
        <div className="bg-black rounded-2xl p-8 shadow-2xl">
          <div className="text-center mb-8">
            <div className="w-16 h-16 bg-green-500 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg
                className="w-8 h-8 text-black"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
                />
              </svg>
            </div>
            <h2 className="text-white text-2xl font-bold mb-2">Verify Your Email</h2>
            <p className="text-gray-400 text-sm">
              We've sent a verification code to
            </p>
            <p className="text-white font-medium mt-1">{email}</p>
            <p className="text-gray-500 text-xs mt-2">
              Check your email inbox for the verification code
            </p>
          </div>

          {/* OTP Input */}
          <div className="mb-6">
            <label className="text-white text-sm font-medium mb-3 block">
              Enter 6-digit code
            </label>
            <div className="flex gap-2 justify-center" onPaste={handlePaste}>
              {otp.map((digit, index) => (
                <Input
                  key={index}
                  ref={(el) => (inputRefs.current[index] = el)}
                  type="text"
                  inputMode="numeric"
                  maxLength={1}
                  value={digit}
                  onChange={(e) => handleOtpChange(index, e.target.value)}
                  onKeyDown={(e) => handleKeyDown(index, e)}
                  className="w-12 h-14 text-center text-xl font-bold bg-gray-800 border-gray-600 text-white rounded-lg focus:border-green-500 focus:ring-green-500"
                />
              ))}
            </div>
          </div>

          {/* Verify Button */}
          <Button
            onClick={handleVerify}
            disabled={loading || otp.join('').length !== 6}
            className="w-full bg-green-500 hover:bg-green-600 text-black font-bold py-3 rounded-full mb-4"
          >
            {loading ? 'Verifying & Creating Account...' : 'Verify & Create Account'}
          </Button>

          {/* Resend Code */}
          <div className="text-center mb-4">
            {canResend ? (
              <button
                onClick={handleResend}
                disabled={resendLoading}
                className="text-green-500 hover:underline text-sm font-medium"
              >
                {resendLoading ? 'Sending...' : 'Resend Code'}
              </button>
            ) : (
              <p className="text-gray-400 text-sm">
                Resend code in {countdown}s
              </p>
            )}
          </div>

          {/* Cancel */}
          <div className="text-center pt-4 border-t border-gray-700">
            <button
              onClick={handleCancel}
              className="text-gray-400 hover:text-white text-sm"
            >
              Cancel Registration
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default VerifyEmail;
