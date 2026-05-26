import React, { useReducer, useEffect, memo } from 'react';
import { useNavigate, Link, useLocation } from 'react-router-dom';
import { login, signInWithGoogle } from '@/services/hybridAuthService';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import toast from 'react-hot-toast';
import { useAuth } from '@/contexts/AuthContext';
import { Download } from 'lucide-react';


// Google Logo Component
const GoogleLogo = memo(() => (
  <svg width="20" height="20" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
  </svg>
));

// Eye Icons
const EyeIcon = memo(({ size = 18 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7S1 12 1 12z" stroke="currentColor" strokeWidth="2" fill="none" />
    <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="2" />
  </svg>
));

const EyeOffIcon = memo(({ size = 18 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M17.94 17.94A10.94 10.94 0 0 1 12 19c-7 0-11-7-11-7a21.77 21.77 0 0 1 5.06-5.94M9.9 4.24A10.94 10.94 0 0 1 12 4c7 0 11 7 11 7a21.8 21.8 0 0 1-3.22 4.19M1 1l22 22" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
));

interface AuthFormState {
  email: string;
  password: string;
  fullName: string;
  loading: boolean;
  googleLoading: boolean;
  showPassword: boolean;
}

type AuthFormAction =
  | { type: 'field'; field: 'email' | 'password' | 'fullName'; value: string }
  | { type: 'loading'; value: boolean }
  | { type: 'googleLoading'; value: boolean }
  | { type: 'togglePassword' };

const authFormReducer = (state: AuthFormState, action: AuthFormAction): AuthFormState => {
  switch (action.type) {
    case 'field':
      return { ...state, [action.field]: action.value };
    case 'loading':
      return { ...state, loading: action.value };
    case 'googleLoading':
      return { ...state, googleLoading: action.value };
    case 'togglePassword':
      return { ...state, showPassword: !state.showPassword };
    default:
      return state;
  }
};


interface AuthProps {
  email: string;
  password: string;
  fullName: string;
  loading: boolean;
  googleLoading: boolean;
  showPassword: boolean;
  isLogin: boolean;
  handleSubmit: (e: React.FormEvent) => void;
  handleGoogleAuth: () => void;
  dispatchForm: React.Dispatch<AuthFormAction>;
  navigate: any;
}

const MobileLoginLayout = ({
  email,
  password,
  fullName,
  loading,
  googleLoading,
  showPassword,
  isLogin,
  handleSubmit,
  handleGoogleAuth,
  dispatchForm,
  navigate,
}: AuthProps) => {
  return (
    <div className="lg:hidden fixed inset-0 z-50 bg-[#121212] flex flex-col overflow-hidden">
      {/* Mobile Header Background - Artist Circles Pattern */}
      <div className="absolute top-[-120px] left-0 right-0 h-[400px] overflow-hidden z-0 bg-[#121212]">
        <div className="absolute inset-0 bg-black/40 z-10"></div>
        {/* Gradient Overlay for Fade Effect */}
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-[#121212]/50 to-[#121212] z-20"></div>

        {/* Artist Circles Grid (Simulated with Gradients for now) */}
        <div className="flex flex-wrap justify-center gap-4 opacity-60 scale-110 rotate-12 transform origin-top-left translate-y-[-20px] translate-x-[-10px]">
          {/* Row 1 */}
          <div className="w-24 h-24 rounded-full bg-gradient-to-br from-purple-500 to-indigo-600 shrink-0"></div>
          <div className="w-24 h-24 rounded-full bg-gradient-to-br from-yellow-400 to-orange-500 shrink-0"></div>
          <div className="w-24 h-24 rounded-full bg-gradient-to-br from-pink-500 to-rose-500 shrink-0"></div>
          <div className="w-24 h-24 rounded-full bg-gradient-to-br from-blue-400 to-cyan-500 shrink-0"></div>
          {/* Row 2 */}
          <div className="w-24 h-24 rounded-full bg-gradient-to-br from-green-400 to-emerald-600 shrink-0 ml-[-20px]"></div>
          <div className="w-24 h-24 rounded-full bg-gradient-to-br from-red-500 to-red-700 shrink-0"></div>
          <div className="w-24 h-24 rounded-full bg-gradient-to-br from-violet-500 to-purple-700 shrink-0"></div>
          <div className="w-24 h-24 rounded-full bg-gradient-to-br from-amber-400 to-yellow-600 shrink-0"></div>
          {/* Row 3 */}
          <div className="w-24 h-24 rounded-full bg-gradient-to-br from-teal-400 to-cyan-600 shrink-0"></div>
          <div className="w-24 h-24 rounded-full bg-gradient-to-br from-fuchsia-500 to-pink-600 shrink-0 ml-[-30px]"></div>
          <div className="w-24 h-24 rounded-full bg-gradient-to-br from-indigo-400 to-blue-600 shrink-0"></div>
        </div>
      </div>

      <div className="relative z-10 bg-transparent px-6 pt-20 pb-4 h-full flex flex-col justify-center">
        {/* Mavrixfy Logo - Centered in the cloud */}
        <div className="flex justify-center mb-6">
          <div className="bg-white rounded-full p-3 shadow-xl">
            <img src="/mavrixfy.png" alt="Mavrixfy" className="w-8 h-8 object-contain" />
          </div>
        </div>

        {/* Main Heading - More Compact */}
        <div className="text-center mb-6">
          <h1 className="text-white text-[1.75rem] font-semibold mb-1 tracking-tight leading-none">
            Millions of songs.<br />Free on Mavrixfy.
          </h1>
        </div>

        {/* Continue with Google */}
        <div className="relative">
          <Button
            onClick={handleGoogleAuth}
            disabled={googleLoading}
            className="w-full bg-white hover:bg-gray-200 text-black font-bold py-2.5 rounded-full mb-2 flex items-center justify-center gap-3 text-sm relative z-10"
          >
            <div className="shrink-0"><GoogleLogo /></div>
            <span>{googleLoading ? (isLogin ? 'Signing in...' : 'Signing up...') : 'Continue with Google'}</span>
          </Button>
          {/* Visual cue for recommended/working method */}
          <div className="absolute -top-2 -right-1 bg-green-500 text-black text-[10px] font-bold px-2 py-0.5 rounded-full z-20 shadow-md">
            Recommended
          </div>
        </div>

        {/* Guest Login */}
        <Button
          onClick={() => navigate('/home')}
          variant="outline"
          className="w-full border-gray-600/30 bg-transparent text-white font-medium py-2.5 rounded-full mb-4 flex items-center justify-center gap-3 text-sm h-auto"
        >
          <span>Continue as Guest</span>
        </Button>

        {/* APK Download for Android */}
        <a
          href={import.meta.env.VITE_APK_DOWNLOAD_URL || 'https://github.com/satvik8373/Mavrixfy-App/releases/download/v1.0.0/mavrixfy.apk'}
          download
          className="w-full border border-green-500 bg-green-500/10 text-green-400 font-medium py-2.5 rounded-full mb-4 flex items-center justify-center gap-3 text-sm h-auto hover:bg-green-500/20 transition-colors"
        >
          <Download size={18} />
          <span>Download Android APK</span>
        </a>

        {/* Auth Form */}
        <div className="pt-4 border-t border-gray-700">
          <form onSubmit={handleSubmit} className="space-y-3">
            <div>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => dispatchForm({ type: 'field', field: 'email', value: e.target.value })}
                placeholder="Email address"
                className="bg-gray-800 border-gray-600 text-white placeholder-gray-400 rounded-md py-2"
                required
                autoComplete="username"
              />
            </div>

            {!isLogin && (
              <div>
                <Input
                  id="fullName"
                  type="text"
                  value={fullName}
                  onChange={(e) => dispatchForm({ type: 'field', field: 'fullName', value: e.target.value })}
                  placeholder="Full name"
                  className="bg-gray-800 border-gray-600 text-white placeholder-gray-400 rounded-md py-2"
                  required
                  autoComplete="name"
                />
              </div>
            )}

            <div className="relative">
              <Input
                id="password"
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => dispatchForm({ type: 'field', field: 'password', value: e.target.value })}
                placeholder={isLogin ? "Password" : "Password (min. 6 characters)"}
                className="bg-gray-800 border-gray-600 text-white placeholder-gray-400 rounded-md pr-10 py-2"
                required
                minLength={isLogin ? 1 : 6}
                autoComplete={isLogin ? "current-password" : "new-password"}
              />
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white"
                onClick={() => dispatchForm({ type: 'togglePassword' })}
              >
                {showPassword ? <EyeOffIcon size={16} /> : <EyeIcon size={16} />}
              </Button>
            </div>

            {isLogin && (
              <div className="text-right">
                <Link to="/reset-password" className="text-white hover:underline text-sm">
                  Forgot Password?
                </Link>
              </div>
            )}

            <Button
              type="submit"
              className="w-full bg-green-500 hover:bg-green-600 text-black font-bold py-2 rounded-full"
              disabled={loading}
            >
              {loading ? (isLogin ? 'Logging in...' : 'Creating account...') : (isLogin ? 'Log In' : 'Create Account')}
            </Button>
          </form>

          {!isLogin && (
            <p className="text-xs text-gray-400 text-center mt-3">
              By creating an account, you agree to our Terms & Privacy Policy.
            </p>
          )}
        </div>

        {/* Switch Mode Link */}
        <div className="mt-4 text-center">
          <p className="text-gray-400 text-sm">
            {isLogin ? "Don't have an account?" : "Already have an account?"}{' '}
            <button type="button"
              onClick={() => navigate('/register')}
              className="text-white hover:underline font-medium"
            >
              {isLogin ? 'Sign up' : 'Log in'}
            </button>
          </p>
        </div>
      </div>
    </div>
  );
};

const DesktopLoginLayout = ({
  email,
  password,
  fullName,
  loading,
  googleLoading,
  showPassword,
  isLogin,
  handleSubmit,
  handleGoogleAuth,
  dispatchForm,
  navigate,
}: AuthProps) => {
  return (
    <div className="hidden lg:block">
      <div className="flex h-[600px] max-w-5xl mx-auto bg-white rounded-2xl overflow-hidden shadow-2xl">
        {/* Left Side - Hero Image */}
        <div className="flex-1 bg-gradient-to-br from-green-300 via-green-400 to-green-500 p-10 flex flex-col relative overflow-hidden group">
          {/* Mavrixfy Logo - Clean & Minimal */}
          <div className="flex items-center gap-4 relative z-20">
            <div className="transition-transform duration-300 hover:scale-105">
              <img
                src="/mavrixfy.png"
                alt="Mavrixfy"
                className="w-16 h-16 object-contain drop-shadow-md"
              />
            </div>
            <span className="text-black text-4xl font-black tracking-tighter drop-shadow-sm">Mavrixfy</span>
          </div>

          {/* Character Image - Centered and Large but Balanced */}
          <div className="absolute inset-0 z-10 flex items-end justify-center pointer-events-none">
            <img
              src="https://res.cloudinary.com/djqq8kba8/image/upload/v1768985220/ChatGPT_Image_Jan_21_2026_02_15_12_PM_hz1blr.png"
              alt="Music Character"
              className="h-[90%] w-auto max-w-none object-contain object-bottom translate-x-16"
            />
            {/* Reduced Gradient Overlay for clearer image */}
            <div className="absolute inset-0 bg-gradient-to-t from-green-500/90 via-transparent to-transparent z-10"></div>
          </div>

          {/* Hero Content - Moved to Bottom with Perfect Size */}
          <div className="relative z-20 mt-auto max-w-md pb-4 pl-2">
            <h1 className="text-black text-[2.5rem] font-semibold mb-3 leading-[1.1] drop-shadow-sm tracking-tight">
              {isLogin ? 'Your Music Journey\nContinues' : 'Start Your Music\nJourney Today'}
            </h1>
            <p className="text-black/85 text-lg font-bold leading-relaxed max-w-[90%]">
              {isLogin ? 'Ready to feel the rhythm again?' : 'Join millions of music lovers worldwide.'}
            </p>
          </div>

          {/* Floating decorative elements - Subtle */}
          <div className="absolute top-16 right-24 w-3 h-3 bg-black/10 rounded-full z-0"></div>
          <div className="absolute top-32 right-16 w-4 h-4 bg-black/5 rounded-full z-0"></div>
          <div className="absolute bottom-64 left-8 w-5 h-5 bg-black/5 rounded-full z-0"></div>
        </div>

        {/* Right Side - Login Form */}
        <div className="flex-1 bg-zinc-950 p-12 flex flex-col justify-center">
          <div className="max-w-sm mx-auto w-full">
            <div className="mb-6">
              <h2 className="text-white text-2xl font-semibold mb-1">
                {isLogin ? 'Welcome Back!' : 'Create Account'}
              </h2>
              <p className="text-gray-400 text-xs">
                {isLogin ? 'Ready to feel the rhythm again?' : 'Join the music revolution'}
              </p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <Input
                  type="email"
                  value={email}
                  onChange={(e) => dispatchForm({ type: 'field', field: 'email', value: e.target.value })}
                  placeholder="Email address"
                  className="bg-gray-800/50 border-gray-600 text-white placeholder-gray-400 py-2.5 px-3 text-sm rounded-lg focus:bg-gray-800 transition-colors"
                  required
                  autoComplete="username"
                />
              </div>

              {!isLogin && (
                <div>
                  <Input
                    type="text"
                    value={fullName}
                    onChange={(e) => dispatchForm({ type: 'field', field: 'fullName', value: e.target.value })}
                    placeholder="Full name"
                    className="bg-gray-800/50 border-gray-600 text-white placeholder-gray-400 py-2.5 px-3 text-sm rounded-lg focus:bg-gray-800 transition-colors"
                    required
                    autoComplete="name"
                  />
                </div>
              )}

              <div className="relative">
                <Input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => dispatchForm({ type: 'field', field: 'password', value: e.target.value })}
                  placeholder={isLogin ? "Password" : "Password (min. 6 characters)"}
                  className="bg-gray-800/50 border-gray-600 text-white placeholder-gray-400 py-2.5 px-3 text-sm rounded-lg pr-10 focus:bg-gray-800 transition-colors"
                  required
                  minLength={isLogin ? 1 : 6}
                  autoComplete={isLogin ? "current-password" : "new-password"}
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white"
                  onClick={() => dispatchForm({ type: 'togglePassword' })}
                >
                  {showPassword ? <EyeOffIcon size={16} /> : <EyeIcon size={16} />}
                </Button>
              </div>

              {isLogin && (
                <div className="text-right">
                  <Link to="/reset-password" className="text-white hover:underline text-sm font-medium">
                    Forgot Password?
                  </Link>
                </div>
              )}

              <Button
                type="submit"
                className="w-full bg-green-500 hover:bg-green-400 text-black font-bold py-2.5 text-sm rounded-full transition-all duration-200"
                disabled={loading}
              >
                {loading ? (isLogin ? 'Logging in...' : 'Creating account...') : (isLogin ? 'Log In' : 'Create Account')}
              </Button>
            </form>

            <div className="my-4 text-center">
              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-gray-700"></div>
                </div>
                <div className="relative flex justify-center text-xs">
                  <span className="bg-zinc-950 px-2 text-gray-400">Or</span>
                </div>
              </div>
            </div>

            {/* Social Login Buttons */}
            <div className="space-y-2">
              <div className="relative group">
                <Button
                  onClick={handleGoogleAuth}
                  disabled={googleLoading}
                  variant="outline"
                  className="w-full border-gray-600 text-white hover:bg-gray-800/50 py-2.5 rounded-lg flex items-center justify-center gap-2 font-medium transition-all duration-200 text-sm"
                >
                  <GoogleLogo />
                  {googleLoading ? (isLogin ? 'Signing in...' : 'Signing up...') : 'Continue with Google'}
                </Button>
                <div className="absolute -top-2 -right-2 bg-green-500 text-black text-[10px] font-bold px-2 py-0.5 rounded-full shadow-md z-10">
                  Recommended
                </div>
              </div>

              <Button
                onClick={() => navigate('/home')}
                variant="outline"
                className="w-full border-gray-600 text-white hover:bg-gray-800/50 py-2.5 rounded-lg flex items-center justify-center gap-2 font-medium transition-all duration-200 text-sm"
              >
                Continue as Guest
              </Button>

              {/* APK Download for Android */}
              <a
                href={import.meta.env.VITE_APK_DOWNLOAD_URL || 'https://github.com/satvik8373/Mavrixfy-App/releases/download/v1.0.0/mavrixfy.apk'}
                download
                className="w-full border border-green-500 bg-green-500/10 text-green-400 hover:bg-green-500/20 py-2.5 rounded-lg flex items-center justify-center gap-2 font-medium transition-all duration-200 text-sm"
              >
                <Download size={16} />
                Download Android APK
              </a>
            </div>

            {!isLogin && (
              <p className="text-xs text-gray-400 text-center mt-4 leading-relaxed">
                By creating an account, you agree to Mavrixfy's<br />
                <Link to="/terms" className="underline hover:text-white">Terms of Service</Link> and <Link to="/privacy" className="underline hover:text-white">Privacy Policy</Link>.
              </p>
            )}

            <div className="mt-4 text-center">
              <p className="text-gray-400 text-xs">
                {isLogin ? "Don't have an account?" : "Already have an account?"}{' '}
                <button type="button"
                  onClick={() => navigate('/register')}
                  className="text-white hover:underline font-medium"
                >
                  {isLogin ? 'Sign up' : 'Log in'}
                </button>
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

const Login = () => {
  const [{ email, password, fullName, loading, googleLoading, showPassword }, dispatchForm] = useReducer(authFormReducer, {
    email: '',
    password: '',
    fullName: '',
    loading: false,
    googleLoading: false,
    showPassword: false,
  });
  const navigate = useNavigate();
  const location = useLocation();
  const pathname = location.pathname;
  const locationState = location.state;
  const { isAuthenticated, loading: authLoading } = useAuth();
  const isLogin = pathname === '/login';

  // Handle standard auth redirect
  useEffect(() => {
    if (isAuthenticated && !authLoading) {
      const redirectTo = locationState?.from || '/home';
      navigate(redirectTo, { replace: true });
    }
  }, [isAuthenticated, authLoading, navigate, locationState]);

  if (authLoading) {
    return <div className="min-h-screen bg-zinc-950" />;
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!email || !password) {
      toast.error('Please fill in all fields');
      return;
    }

    if (!isLogin && !fullName) {
      toast.error('Please enter your full name');
      return;
    }

    if (!isLogin && password.length < 6) {
      toast.error('Password must be at least 6 characters');
      return;
    }

    dispatchForm({ type: 'loading', value: true });

    try {
      if (isLogin) {
        await login(email, password);
        toast.success('Welcome back!');
        const redirectTo = location.state?.from || '/home';
        navigate(redirectTo, { replace: true });
      } else {
        // For registration, redirect to email verification BEFORE creating account
        toast.success('Please verify your email to complete registration');
        navigate('/verify-email', { 
          state: { email, password, fullName },
          replace: true 
        });
      }
    } catch (error: any) {

      if (isLogin) {
        if (error.message.includes('user-not-found') || error.message.includes('wrong-password')) {
          toast.error('Invalid email or password');
        } else if (error.message.includes('too-many-requests')) {
          toast.error('Too many login attempts. Please try again later.');
        } else {
          toast.error(error.message || 'Failed to login');
        }
      } else {
        if (error.message.includes('email-already-in-use')) {
          toast.error('Email already in use. Please use a different email or login.');
        } else if (error.message.includes('invalid-email')) {
          toast.error('Invalid email address');
        } else {
          toast.error(error.message || 'Failed to create account');
        }
      }
    } finally {
      dispatchForm({ type: 'loading', value: false });
    }
  };

  const handleGoogleAuth = async () => {
    dispatchForm({ type: 'googleLoading', value: true });
    try {
      await signInWithGoogle();
      toast.success(isLogin ? 'Welcome back!' : 'Signed up with Google successfully');
      const redirectTo = location.state?.from || '/home';
      navigate(redirectTo, { replace: true });
    } catch (error: any) {
      toast.error(error.message || `Failed to ${isLogin ? 'login' : 'sign up'} with Google`);
    } finally {
      dispatchForm({ type: 'googleLoading', value: false });
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-400 via-green-500 to-green-600 relative overflow-hidden flex items-center justify-center p-8">
      {/* Main Content Container */}
      <div className="relative z-10 w-full">
        <div className="w-full max-w-md lg:max-w-none">
          <MobileLoginLayout
            email={email}
            password={password}
            fullName={fullName}
            loading={loading}
            googleLoading={googleLoading}
            showPassword={showPassword}
            isLogin={isLogin}
            handleSubmit={handleSubmit}
            handleGoogleAuth={handleGoogleAuth}
            dispatchForm={dispatchForm}
            navigate={navigate}
          />
          <DesktopLoginLayout
            email={email}
            password={password}
            fullName={fullName}
            loading={loading}
            googleLoading={googleLoading}
            showPassword={showPassword}
            isLogin={isLogin}
            handleSubmit={handleSubmit}
            handleGoogleAuth={handleGoogleAuth}
            dispatchForm={dispatchForm}
            navigate={navigate}
          />
        </div>
      </div>
    </div>
  );
};

export default Login; 
