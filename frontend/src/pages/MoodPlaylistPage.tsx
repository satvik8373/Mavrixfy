import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { MoodPlaylistGenerator } from '../components/MoodPlaylistGenerator';
import './MoodPlaylistPage.css';

export default function MoodPlaylistPage() {
  const navigate = useNavigate();

  useEffect(() => {
    const handleNavigate = () => navigate('/mood-history');
    window.addEventListener('navigate-mood-history', handleNavigate);
    return () => window.removeEventListener('navigate-mood-history', handleNavigate);
  }, [navigate]);

  return (
    <div className="mood-playlist-page relative h-full min-h-0 flex flex-col bg-[#08090a]">
      {/* Static Background - fixed to viewport behind content */}
      <div className="mood-playlist-background">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(16,185,129,0.16),transparent_34%),linear-gradient(135deg,#08090a_0%,#111315_48%,#15110d_100%)]" />
      </div>

      {/* Content wrapper */}
      <div className="mood-mobile-page relative z-10 max-w-4xl mx-auto w-full">
        {/* Generator - Direct render without wrapper */}
        <MoodPlaylistGenerator />
      </div>
    </div>
  );
}
