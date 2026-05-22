import React from 'react';
import { Link } from 'react-router-dom';
import { Megaphone } from 'lucide-react';

interface ProfileDropdownProps {
  isOpen: boolean;
  onClose: () => void;
  onLogout: (e: React.MouseEvent) => void;
  className?: string;
  style?: React.CSSProperties;
}

const ProfileDropdown: React.FC<ProfileDropdownProps> = ({
  isOpen,
  onClose,
  onLogout,
  className,
  style
}) => {
  if (!isOpen) return null;

  return (
    <div className={className} style={{ ...style, width: '320px' }}>
      <div className="py-1">

        <Link
          to="/settings"
          className="flex items-center px-4 py-3 text-sm text-popover-foreground hover:bg-accent transition-colors"
          onClick={onClose}
        >
          Settings
        </Link>
        <Link
          to="/about"
          className="flex items-center px-4 py-3 text-sm text-popover-foreground hover:bg-accent transition-colors"
          onClick={onClose}
        >
          About
        </Link>
        <Link
          to="/privacy"
          className="flex items-center px-4 py-3 text-sm text-popover-foreground hover:bg-accent transition-colors"
          onClick={onClose}
        >
          Privacy Policy
        </Link>
        <Link
          to="/terms"
          className="flex items-center px-4 py-3 text-sm text-popover-foreground hover:bg-accent transition-colors"
          onClick={onClose}
        >
          Terms of Service
        </Link>

        <div className="border-t border-border my-1"></div>

        <button type="button"
          onClick={onLogout}
          className="w-full text-left px-4 py-3 text-sm text-popover-foreground hover:bg-accent flex items-center transition-colors"
        >
          Sign out
        </button>

        <div className="border-t border-border my-1"></div>

        <div className="p-2">
          <div className="flex items-center justify-between mb-2 px-2">
            <h3 className="text-popover-foreground font-semibold text-sm">Your Updates</h3>
          </div>

          <div className="space-y-2">
            {/* Item 1 */}
            <div className="group flex gap-3 p-2 rounded-md hover:bg-accent cursor-pointer transition-colors relative">
              <img
                src="/mavrixfy.png"
                alt="Concert"
                className="w-12 h-12 rounded-md object-cover flex-shrink-0"
              />
              <div className="flex flex-col justify-center">
                <p className="text-popover-foreground text-[13px] leading-tight line-clamp-2">
                  Tickets on sale for Iqlipse Nova in Vadodara on Sat, Dec 20
                </p>
                <p className="text-muted-foreground text-xs mt-1">6w</p>
              </div>
              <div className="absolute right-2 top-2 opacity-0 group-hover:opacity-100 transition-opacity">
                <div className="w-2 h-2 rounded-full bg-blue-500"></div>
              </div>
            </div>

            {/* Item 2 */}
            <div className="group flex gap-3 p-2 rounded-md hover:bg-accent cursor-pointer transition-colors">
              <div className="w-12 h-12 rounded-md bg-secondary flex items-center justify-center flex-shrink-0">
                <Megaphone className="w-6 h-6 text-foreground" />
              </div>
              <div className="flex flex-col justify-center">
                <p className="text-popover-foreground text-[13px] leading-tight line-clamp-2">
                  Say hello to Your Updates. Check here for news on your followers, playlists, events and more
                </p>
                <p className="text-muted-foreground text-xs mt-1">10w</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ProfileDropdown;
