import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { resetPassword } from '@/services/hybridAuthService';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ArrowLeft } from 'lucide-react';
import toast from 'react-hot-toast';

const ResetPassword = () => {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [resetSent, setResetSent] = useState(false);
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!email) {
      toast.error('Please enter your email address');
      return;
    }
    
    setLoading(true);
    
    try {
      await resetPassword(email);
      setResetSent(true);
      toast.success('Password reset email sent');
    } catch (error: any) {
      
      // Handle specific Firebase error messages
      if (error.message.includes('user-not-found')) {
        toast.error('No account found with this email address');
      } else if (error.message.includes('invalid-email')) {
        toast.error('Invalid email address');
      } else {
        toast.error(error.message || 'Failed to send password reset email');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-zinc-950 flex flex-col items-center">
      <div className="w-full max-w-md px-6 py-8">
        <div className="flex items-center mb-8">
          <Button 
            variant="ghost" 
            size="icon" 
            className="text-white mr-4" 
            onClick={() => navigate('/login')}
          >
            <ArrowLeft />
          </Button>
          <div className="flex items-center gap-3">
            <img
              src="/mavrixfy.png"
              alt="Mavrixfy"
              className="h-8 w-8 object-contain"
            />
            <h1 className="text-2xl font-semibold text-white">Reset password</h1>
          </div>
        </div>
        
        {resetSent ? (
          <div className="space-y-6">
            <div className="bg-zinc-800 p-6 rounded-md">
              <h2 className="text-lg font-semibold text-white mb-4">Check your email</h2>
              <p className="text-zinc-400 mb-4">
                We've sent a password reset link to <span className="text-white">{email}</span>
              </p>
              <p className="text-zinc-400 text-sm">
                Click the link in the email to reset your password. If you don't see the email, check your spam folder.
              </p>
            </div>
            
            <div className="text-center">
              <Button 
                variant="ghost" 
                className="text-white hover:underline"
                onClick={() => setResetSent(false)}
              >
                Try a different email
              </Button>
            </div>
            
            <div className="border-t border-zinc-800 my-6"></div>
            
            <div className="text-center">
              <Link 
                to="/login" 
                className="inline-block border border-zinc-700 text-white rounded-full px-8 py-3 font-bold hover:border-white transition-colors"
              >
                Back to login
              </Link>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-6">
            <p className="text-zinc-400 mb-4">
              Enter your email address and we'll send you a link to reset your password.
            </p>
            
            <div className="space-y-2">
              <Label htmlFor="email" className="text-white">Email address</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Email"
                className="bg-zinc-800 border-zinc-700 text-white"
                required
              />
            </div>
            
            <Button
              type="submit"
              className="w-full bg-green-500 hover:bg-green-600 text-black font-bold py-3"
              disabled={loading}
            >
              {loading ? 'Sending...' : 'Send Reset Link'}
            </Button>
            
            <div className="border-t border-zinc-800 my-6"></div>
            
            <div className="text-center">
              <Link 
                to="/login" 
                className="inline-block border border-zinc-700 text-white rounded-full px-8 py-3 font-bold hover:border-white transition-colors"
              >
                Back to login
              </Link>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};

export default ResetPassword; 
