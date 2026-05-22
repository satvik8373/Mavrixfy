import React from 'react';
import { Instagram, Twitter, Facebook } from 'lucide-react';
import { Link } from 'react-router-dom';

const DesktopFooter = () => {
    return (
        <div className="bg-[#121212] pt-16 pb-8 px-8 mt-auto hidden md:block">
            <div className="flex flex-col">
                {/* Top Section with Links and Social Icons */}
                <div className="flex justify-between mb-16">
                    <div className="flex gap-16 lg:gap-24">
                        {/* Company Column */}
                        <div className="flex flex-col gap-4">
                            <h3 className="font-semibold text-white text-base">Company</h3>
                            <ul className="flex flex-col gap-2">
                                <li><Link to="/about" className="text-[#a7a7a7] hover:text-white hover:underline">About</Link></li>
                                <li><a href="mailto:careers@mavrixfy.site" className="text-[#a7a7a7] hover:text-white hover:underline">Jobs</a></li>
                                <li><a href="mailto:hello@mavrixfy.site" className="text-[#a7a7a7] hover:text-white hover:underline">Contact</a></li>
                            </ul>
                        </div>

                        {/* Communities Column */}
                        <div className="flex flex-col gap-4">
                            <h3 className="font-semibold text-white text-base">Communities</h3>
                            <ul className="flex flex-col gap-2">
                                <li><a href="mailto:artists@mavrixfy.site" className="text-[#a7a7a7] hover:text-white hover:underline">For Artists</a></li>
                                <li><a href="mailto:developers@mavrixfy.site" className="text-[#a7a7a7] hover:text-white hover:underline">Developers</a></li>
                                <li><a href="mailto:investors@mavrixfy.site" className="text-[#a7a7a7] hover:text-white hover:underline">Investors</a></li>
                                <li><a href="mailto:vendors@mavrixfy.site" className="text-[#a7a7a7] hover:text-white hover:underline">Vendors</a></li>
                            </ul>
                        </div>

                        {/* Useful Links Column */}
                        <div className="flex flex-col gap-4">
                            <h3 className="font-semibold text-white text-base">Useful links</h3>
                            <ul className="flex flex-col gap-2">
                                <li><a href="mailto:support@mavrixfy.site" className="text-[#a7a7a7] hover:text-white hover:underline">Support</a></li>
                                <li><Link to="/home" className="text-[#a7a7a7] hover:text-white hover:underline">Free Mobile App</Link></li>
                                <li><Link to="/search" className="text-[#a7a7a7] hover:text-white hover:underline">Discover Music</Link></li>
                            </ul>
                        </div>

                        {/* Mavrixfy Plans Column */}
                        <div className="flex flex-col gap-4">
                            <h3 className="font-semibold text-white text-base">Mavrixfy Plans</h3>
                            <ul className="flex flex-col gap-2">
                                <li><Link to="/home" className="text-[#a7a7a7] hover:text-white hover:underline">Free Streaming</Link></li>
                                <li><Link to="/library" className="text-[#a7a7a7] hover:text-white hover:underline">Personal Library</Link></li>
                                <li><Link to="/liked-songs" className="text-[#a7a7a7] hover:text-white hover:underline">Liked Songs</Link></li>
                                <li><Link to="/search" className="text-[#a7a7a7] hover:text-white hover:underline">Music Discovery</Link></li>
                                <li><Link to="/home" className="text-[#a7a7a7] hover:text-white hover:underline">Mavrixfy Free</Link></li>
                            </ul>
                        </div>
                    </div>

                    {/* Social Icons */}
                    <div className="flex gap-4">
                        <a 
                            href="https://instagram.com/mavrixfy_music" 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="w-10 h-10 rounded-full bg-[#292929] hover:bg-[#727272] flex items-center justify-center text-white transition-colors"
                        >
                            <Instagram size={20} />
                        </a>
                        <a 
                            href="https://twitter.com/mavrixfy" 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="w-10 h-10 rounded-full bg-[#292929] hover:bg-[#727272] flex items-center justify-center text-white transition-colors"
                        >
                            <Twitter size={20} fill="currentColor" />
                        </a>
                        <a 
                            href="https://facebook.com/mavrixfy" 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="w-10 h-10 rounded-full bg-[#292929] hover:bg-[#727272] flex items-center justify-center text-white transition-colors"
                        >
                            <Facebook size={20} fill="currentColor" />
                        </a>
                    </div>
                </div>

                {/* Divider */}
                <div className="h-[1px] bg-[#292929] w-full mb-8"></div>

                {/* Bottom Section */}
                <div className="flex justify-between items-center text-sm">
                    <div className="flex gap-6 flex-wrap">
                        <Link to="/terms" className="text-[#a7a7a7] hover:text-white">Legal</Link>
                        <Link to="/privacy" className="text-[#a7a7a7] hover:text-white">Safety & Privacy Center</Link>
                        <Link to="/privacy" className="text-[#a7a7a7] hover:text-white">Privacy Policy</Link>
                        <Link to="/privacy" className="text-[#a7a7a7] hover:text-white">Cookies</Link>
                        <Link to="/about" className="text-[#a7a7a7] hover:text-white">Accessibility</Link>
                    </div>
                    <div className="flex flex-col items-end gap-1">
                        <div className="text-[#a7a7a7]" suppressHydrationWarning>
                            © {new Date().getFullYear()} Mavrixfy. All rights reserved.
                        </div>
                        <div className="text-[#a7a7a7] text-xs">
                            Developed by Satvik Patel
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default DesktopFooter;
