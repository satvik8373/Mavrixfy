import React from 'react';
import Footer from '@/components/Footer';
import { Music, Users, Heart, Shield } from 'lucide-react';

const About = () => {
  return (
    <div className="min-h-screen bg-[#121212] text-white">
      <div className="max-w-4xl mx-auto px-6 py-8 pb-24">
        <h1 className="text-3xl font-semibold mb-8">About Mavrixfy</h1>
        
        <div className="space-y-8 text-gray-300">
            <section>
              <div className="flex items-center gap-3 mb-4">
                <Music className="h-6 w-6 text-green-500" />
                <h2 className="text-xl font-semibold text-white">Our Mission</h2>
              </div>
              <p className="mb-4">
                Mavrixfy is dedicated to revolutionizing how people discover, organize, and enjoy music. 
                We believe that music is a universal language that connects people across cultures and boundaries.
              </p>
              <p>
                Our platform provides a seamless experience for music lovers to explore new artists, 
                create personalized playlists, and share their musical journey with others.
              </p>
            </section>

            <section>
              <div className="flex items-center gap-3 mb-4">
                <Users className="h-6 w-6 text-blue-500" />
                <h2 className="text-xl font-semibold text-white">What We Offer</h2>
              </div>
              <div className="grid md:grid-cols-2 gap-6">
                <div>
                  <h3 className="font-semibold text-white mb-2">Music Discovery</h3>
                  <p className="text-sm">
                    Discover trending songs, explore different genres, and find your next favorite artist 
                    through our curated recommendations.
                  </p>
                </div>
                <div>
                  <h3 className="font-semibold text-white mb-2">Playlist Management</h3>
                  <p className="text-sm">
                    Create, organize, and share custom playlists for every mood, occasion, and moment 
                    in your life.
                  </p>
                </div>
                <div>
                  <h3 className="font-semibold text-white mb-2">Social Features</h3>
                  <p className="text-sm">
                    Connect with friends, share your favorite tracks, and discover what others are 
                    listening to in your network.
                  </p>
                </div>
                <div>
                  <h3 className="font-semibold text-white mb-2">Cross-Platform</h3>
                  <p className="text-sm">
                    Access your music library and playlists across all your devices with seamless 
                    synchronization.
                  </p>
                </div>
              </div>
            </section>

            <section>
              <div className="flex items-center gap-3 mb-4">
                <Heart className="h-6 w-6 text-red-500" />
                <h2 className="text-xl font-semibold text-white">Our Values</h2>
              </div>
              <div className="space-y-4">
                <div>
                  <h3 className="font-semibold text-white mb-2">User-Centric Design</h3>
                  <p className="text-sm">
                    Every feature we build is designed with our users in mind, prioritizing ease of use 
                    and intuitive navigation.
                  </p>
                </div>
                <div>
                  <h3 className="font-semibold text-white mb-2">Quality Content</h3>
                  <p className="text-sm">
                    We partner with legitimate music services to ensure high-quality audio and respect 
                    for artists' rights.
                  </p>
                </div>
                <div>
                  <h3 className="font-semibold text-white mb-2">Community First</h3>
                  <p className="text-sm">
                    We foster a vibrant community of music lovers who can share, discover, and connect 
                    through their passion for music.
                  </p>
                </div>
              </div>
            </section>

            <section>
              <div className="flex items-center gap-3 mb-4">
                <Shield className="h-6 w-6 text-yellow-500" />
                <h2 className="text-xl font-semibold text-white">Privacy & Security</h2>
              </div>
              <p className="mb-4">
                We take your privacy seriously and are committed to protecting your personal information. 
                Our platform uses industry-standard security measures to safeguard your data.
              </p>
              <p>
                We believe in transparency and give you full control over your data and privacy settings. 
                Read our Privacy Policy to learn more about how we handle your information.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-white mb-4">Contact Us</h2>
              <div className="bg-gray-800/50 rounded-lg p-6">
                <p className="mb-4">
                  Have questions, suggestions, or feedback? We'd love to hear from you!
                </p>
                <div className="space-y-2">
                  <p><strong>Email:</strong> hello@mavrixfy.site</p>
                  <p><strong>Support:</strong> support@mavrixfy.site</p>
                  <p><strong>Website:</strong> https://mavrixfy.site</p>
                </div>
              </div>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-white mb-4">Legal</h2>
              <p className="text-sm">
                Mavrixfy operates in compliance with applicable laws and regulations. We respect 
                intellectual property rights and work with licensed content providers to ensure 
                legal access to music content.
              </p>
            </section>

            <div className="mt-8 pt-6 border-t border-gray-700">
              <p suppressHydrationWarning className="text-sm text-gray-400">
                © {new Date().getFullYear()} Mavrixfy. All rights reserved.
              </p>
            </div>
          </div>
        
        <Footer />
      </div>
    </div>
  );
};

export default About;
