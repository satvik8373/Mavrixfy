import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { sendVerificationEmail, checkEmailVerified } from '@/services/hybridAuthService';
import toast from 'react-hot-toast';
import { auth } from '@/lib/firebase';

const EmailVerificationBanner = () => {
  const [isVerified, setIsVerified] = useState<boolean | undefined>(undefined);
  const [loading, setLoading] = useState(false);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    checkVerificationStatus();
  }, []);

  const checkVerificationStatus = async () => {
    try {
      const verified = await checkEmailVerified();
      setIsVerified(verified);
    } catch (error) {
      // Error checking verification
    } finally {
      setChecking(false);
    }
  };

  const handleSendVerification = async () => {
    setLoading(true);
    try {
      await sendVerificationEmail();
      toast.success('Verification email sent! Please check your inbox.');
    } catch (error: any) {
      toast.error(error.message || 'Failed to send verification email');
    } finally {
      setLoading(false);
    }
  };

  const handleCheckStatus = async () => {
    setLoading(true);
    try {
      const verified = await checkEmailVerified();
      setIsVerified(verified);
      
      if (verified) {
        toast.success('Email verified successfully!');
      } else {
        toast.error('Email not verified yet. Please check your inbox.');
      }
    } catch (error: any) {
      toast.error(error.message || 'Failed to check verification status');
    } finally {
      setLoading(false);
    }
  };

  // Don't show banner if email is verified (true or undefined during check) or user is not logged in
  if (checking || isVerified === true || isVerified === undefined || !auth.currentUser) {
    return null;
  }

  return (
    <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-4 mb-4">
      <div className="flex items-start gap-3">
        <div className="flex-shrink-0 mt-0.5">
          <svg
            className="w-5 h-5 text-yellow-500"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
            />
          </svg>
        </div>
        <div className="flex-1">
          <h3 className="text-yellow-500 font-semibold text-sm mb-1">
            Email Not Verified
          </h3>
          <p className="text-gray-300 text-sm mb-3">
            Please verify your email address to access all features and secure your account.
          </p>
          <div className="flex flex-wrap gap-2">
            <Button
              onClick={handleSendVerification}
              disabled={loading}
              size="sm"
              className="bg-yellow-500 hover:bg-yellow-600 text-black"
            >
              {loading ? 'Sending...' : 'Send Verification Email'}
            </Button>
            <Button
              onClick={handleCheckStatus}
              disabled={loading}
              size="sm"
              variant="outline"
              className="border-yellow-500/30 text-yellow-500 hover:bg-yellow-500/10"
            >
              I've Verified
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default EmailVerificationBanner;
