import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, User, Mail, Calendar, Edit, Save, X, Camera, LogOut } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { cn } from '@/lib/utils';
import { signOut, updateUserProfile, getCurrentUser } from '@/services/hybridAuthService';

import { toast } from 'react-hot-toast';

const ProfilePage = () => {
  const navigate = useNavigate();
  const { user, isAuthenticated } = useAuth();
  const [isEditing, setIsEditing] = useState(false);
  const [editedName, setEditedName] = useState('');
  const [isSaving, setIsSaving] = useState(false);


  useEffect(() => {
    if (!isAuthenticated) {
      navigate('/login');
      return;
    }

    if (user?.name) {
      setEditedName(user.name);
    }
  }, [isAuthenticated, user, navigate]);

  const handleSave = async () => {
    const currentUser = getCurrentUser();
    if (!editedName.trim()) return;

    if (!currentUser) {
      toast.error('Authentication error. Please re-login.');
      return;
    }

    setIsSaving(true);
    try {
      await updateUserProfile(currentUser, { fullName: editedName.trim() });
      toast.success('Profile updated successfully');
      setIsEditing(false);
    } catch (error) {
      toast.error('Failed to update profile');
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancel = () => {
    setEditedName(user?.name || '');
    setIsEditing(false);
  };

  const handleLogout = async () => {
    try {
      await signOut();
      navigate('/', { replace: true });
    } catch (error) {
      // Error signing out
    }
  };

  if (!isAuthenticated) {
    return null;
  }

  return (
    <div className="min-h-screen bg-background text-foreground relative overflow-hidden">

      {/* Header */}
      <div className="sticky top-0 z-40 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 border-b border-border">
        <div className="flex items-center justify-between px-6 py-4 max-w-4xl mx-auto w-full">
          <button type="button"
            onClick={() => navigate(-1)}
            className="h-10 w-10 rounded-full bg-white/5 hover:bg-white/10 flex items-center justify-center transition-colors border border-white/5"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <h1 className="text-lg font-semibold tracking-wide">Profile</h1>
          <div className="w-10" />
        </div>
      </div>

      {/* Profile Content */}
      <div className="px-6 py-12 max-w-3xl mx-auto relative z-10">
        <div className="flex flex-col items-center gap-y-8 mb-12">

          {/* Profile Picture */}
          <div className="relative group">
            <div className="relative h-40 w-40 rounded-full bg-muted flex items-center justify-center overflow-hidden shadow-2xl">
              {user?.picture ? (
                <img
                  src={user.picture}
                  alt={user.name || 'Profile'}
                  className="w-full h-full object-cover"
                />
              ) : (
                <User className="h-20 w-20 text-muted-foreground" />
              )}
            </div>
            <button type="button" className="absolute bottom-2 right-2 h-10 w-10 rounded-full bg-green-500 hover:bg-green-400 flex items-center justify-center transition-all shadow-lg border-4 border-background">
              <Camera className="h-5 w-5 text-black" />
            </button>
          </div>

          {/* Name Section */}
          <div className="w-full max-w-md text-center">
            {isEditing ? (
              <div className="flex items-center justify-center gap-3 animate-in fade-in slide-in-from-bottom-2">
                <input
                  type="text"
                  value={editedName}
                  onChange={(e) => setEditedName(e.target.value)}
                  className="text-4xl font-bold bg-transparent border-b-2 border-green-500 focus:outline-none text-center w-full max-w-[250px] py-2 placeholder:text-white/20"
                  placeholder="Enter name"
                  maxLength={50}
                />
                <button type="button"
                  onClick={handleSave}
                  disabled={isSaving || !editedName.trim()}
                  className="h-10 w-10 rounded-full bg-green-500 hover:bg-green-400 flex items-center justify-center transition-colors disabled:opacity-50 shadow-lg text-black"
                >
                  <Save className="h-5 w-5" />
                </button>
                <button type="button"
                  onClick={handleCancel}
                  className="h-10 w-10 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center transition-colors backdrop-blur-sm"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="flex items-center justify-center gap-4 group">
                  <h2 className="text-4xl font-semibold tracking-tight">{user?.name || 'No name set'}</h2>
                  <button type="button"
                    onClick={() => setIsEditing(true)}
                    className="h-10 w-10 rounded-full bg-transparent hover:bg-white/5 flex items-center justify-center transition-all opacity-0 group-hover:opacity-100 translate-y-1 group-hover:translate-y-0"
                  >
                    <Edit className="h-5 w-5 text-muted-foreground hover:text-white" />
                  </button>
                </div>

              </div>
            )}
          </div>
        </div>

        {/* Personal Information Section */}
        <div className="space-y-6">
          <h3 className="text-xl font-semibold text-white">Personal Information</h3>

          <div className="bg-card rounded-lg divide-y divide-white/5 border border-white/5">
            {/* Email */}
            <div className="flex items-center justify-between p-4 px-6 hover:bg-white/5 transition-colors">
              <div>
                <p className="text-sm text-muted-foreground mb-1">Email</p>
                <p className="text-foreground font-medium">{user?.email || 'No email linked'}</p>
              </div>
            </div>

            {/* Username/ID */}
            <div className="flex items-center justify-between p-4 px-6 hover:bg-white/5 transition-colors">
              <div>
                <p className="text-sm text-muted-foreground mb-1">Username</p>
                <p className="text-foreground font-medium">{user?.id || 'unknown_user'}</p>
              </div>
            </div>

            {/* Date of Birth */}
            <div className="flex items-center justify-between p-4 px-6 hover:bg-white/5 transition-colors">
              <div>
                <p className="text-sm text-muted-foreground mb-1">Date of birth</p>
                <p className="text-foreground font-medium">Not set</p>
              </div>
            </div>

            {/* Country or Region */}
            <div className="flex items-center justify-between p-4 px-6 hover:bg-white/5 transition-colors">
              <div>
                <p className="text-sm text-muted-foreground mb-1">Country or region</p>
                <p className="text-foreground font-medium">India</p>
              </div>
            </div>

            {/* Plan */}
            <div className="flex items-center justify-between p-4 px-6 hover:bg-white/5 transition-colors">
              <div>
                <p className="text-sm text-muted-foreground mb-1">Plan</p>
                <p className="text-foreground font-medium">Mavrixfy Free</p>
              </div>
            </div>
          </div>

          <div className="pt-4">
            <div className="flex items-center gap-3 p-4 bg-card rounded-lg border border-white/5">
              <Calendar className="h-5 w-5 text-muted-foreground" />
              <div className="flex-1">
                <p className="text-sm text-muted-foreground">Member since</p>
                <p className="text-foreground font-medium" suppressHydrationWarning>
                  {(user as any)?.createdAt
                    ? new Date((user as any).createdAt).toLocaleDateString('en-US', {
                      year: 'numeric',
                      month: 'long',
                      day: 'numeric'
                    })
                    : 'Unknown Date'
                  }
                </p>
              </div>
            </div>
          </div>
        </div>


        {/* Actions */}
        <div className="w-full pt-8 pb-12">
          <button type="button"
            onClick={handleLogout}
            className="w-full flex items-center justify-center gap-3 py-4 text-neutral-400 hover:text-white hover:bg-white/5 rounded-xl transition-all font-medium border border-transparent hover:border-white/5"
          >
            <LogOut className="h-5 w-5" />
            Sign Out
          </button>
        </div>
      </div>
    </div>
  );
};

export default ProfilePage;
