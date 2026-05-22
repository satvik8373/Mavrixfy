import React from 'react';
import { Search } from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { useSettingsStore, EQUALIZER_PRESETS } from '@/stores/useSettingsStore';

import { useNavigate } from 'react-router-dom';

const EqualizerVisualization = ({ settings }: { settings: any }) => {
    const frequencies = ['60Hz', '150Hz', '400Hz', '1KHz', '2.4KHz', '15KHz'];
    const minDb = -12;
    const maxDb = 12;

    const draggingRef = React.useRef<string | null>(null);
    const containerRef = React.useRef<HTMLDivElement>(null);

    // Calculate Y position percentage (0 to 1) for a dB value
    // Max (+12dB) -> 0% (top)
    // Min (-12dB) -> 100% (bottom)
    const getPercentage = (db: number) => {
        return 1 - ((db - minDb) / (maxDb - minDb));
    };

    // Inverse of getPercentage: Percentage -> dB
    const getDbFromPercentage = (percentage: number) => {
        const clamped = Math.max(0, Math.min(1, percentage));
        const db = minDb + (1 - clamped) * (maxDb - minDb);
        return Math.round(db); // integer steps
    };


    const handlePointerDown = (freq: string, e: React.PointerEvent) => {
        e.preventDefault();
        draggingRef.current = freq;
        (e.target as Element).setPointerCapture(e.pointerId);
    };

    const handlePointerMove = (e: React.PointerEvent) => {
        if (!draggingRef.current || !containerRef.current) return;

        const rect = containerRef.current.getBoundingClientRect();
        const y = e.clientY - rect.top;
        const percentage = y / rect.height;
        const newDb = getDbFromPercentage(percentage);

        if (newDb !== settings.equalizer[draggingRef.current]) {
            settings.setEqualizerBand(draggingRef.current, newDb);
        }
    };

    const handlePointerUp = (e: React.PointerEvent) => {
        if (draggingRef.current) {
            draggingRef.current = null;
            (e.target as Element).releasePointerCapture(e.pointerId);
        }
    };

    // Generate SVG path for the curve
    const points = frequencies.map((freq, index) => {
        const value = settings.equalizer[freq];
        const x = (index / (frequencies.length - 1)) * 100;
        const y = getPercentage(value) * 100;
        return { x, y, value, freq };
    });



    // Better curve generation (Cardinal Spline logic simplified)
    const getCurvePath = () => {
        if (points.length < 2) return "";

        let d = `M ${points[0].x} ${points[0].y}`;

        for (let i = 0; i < points.length - 1; i++) {
            const p0 = points[i === 0 ? 0 : i - 1];
            const p1 = points[i];
            const p2 = points[i + 1];
            const p3 = points[i + 2] || p2;

            const cp1x = p1.x + (p2.x - p0.x) / 6;
            const cp1y = p1.y + (p2.y - p0.y) / 6;
            const cp2x = p2.x - (p3.x - p1.x) / 6;
            const cp2y = p2.y - (p3.y - p1.y) / 6;

            d += ` C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${p2.x} ${p2.y}`;
        }
        return d;
    };


    return (
        <div
            className="w-full relative select-none touch-none"
            style={{ height: '200px' }}
            ref={containerRef}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            // Ensure we catch mouseup even if it leaves the container if we have capture
            onPointerLeave={handlePointerUp}
        >
            {/* Grid & Axis */}
            <div className="absolute left-0 top-0 bottom-0 flex flex-col justify-between text-xs text-[#b3b3b3] py-0 h-full pointer-events-none z-0">
                <span className="-translate-y-1/2">+12dB</span>
                <span className="translate-y-1/2">-12dB</span>
            </div>
            <div className="absolute left-10 right-0 top-1/2 h-[1px] bg-white/10 pointer-events-none"></div>


            {/* Playback (Equalizer) */}
            <div className="absolute left-4 right-4 sm:left-12 sm:right-4 top-4 bottom-4">

                {/* Vertical Grid Lines */}
                {points.map((point) => (
                    <div
                        key={`grid-${point.freq}`}
                        className="absolute top-0 bottom-0 w-[1px] bg-white/5 pointer-events-none"
                        style={{ left: `${point.x}%` }}
                    />
                ))}

                {/* Curve SVG */}
                <svg className="absolute inset-0 w-full h-full overflow-visible pointer-events-none z-10" preserveAspectRatio="none" viewBox="0 0 100 100">
                    <defs>
                        <linearGradient id="eq-gradient" x1="0" x2="0" y1="0" y2="1">
                            <stop offset="0%" stopColor="white" stopOpacity="0.3" />
                            <stop offset="100%" stopColor="white" stopOpacity="0" />
                        </linearGradient>
                    </defs>

                    {/* Gradient Fill Path */}
                    <path
                        d={`${getCurvePath()} L 100 100 L 0 100 Z`}
                        fill="url(#eq-gradient)"
                        className="opacity-70"
                    />

                    {/* Stroke Path */}
                    <path
                        d={getCurvePath()}
                        fill="none"
                        stroke="white"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        vectorEffect="non-scaling-stroke"
                        className="opacity-90"
                    />
                </svg>

                {/* Interactive Points (Need to be overlaid correctly) */}
                {frequencies.map((freq, index) => {
                    const value = settings.equalizer[freq];
                    const xPc = (index / (frequencies.length - 1)) * 100;
                    const yPc = getPercentage(value) * 100;

                    return (
                        <div
                            key={freq}
                            className="absolute -translate-x-1/2 -translate-y-1/2 cursor-grab active:cursor-grabbing group z-20"
                            style={{
                                left: `${xPc}%`,
                                top: `${yPc}%`,
                                width: '20px',
                                height: '20px',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center'
                            }}
                            onPointerDown={(e) => handlePointerDown(freq, e)}
                        >
                            <div className="w-3 h-3 bg-white rounded-full shadow-md group-hover:scale-125 transition-transform" />

                            {/* Frequency Label */}
                            <div className="absolute top-[20px] pt-8 text-xs text-[#b3b3b3] font-medium whitespace-nowrap pointer-events-none">
                                {freq}
                            </div>
                        </div>
                    );
                })}
            </div>

        </div>
    );
};

const SettingsPage = () => {
    const navigate = useNavigate();
    const settings = useSettingsStore();

    return (
        <div className="flex-1 bg-[#121212] min-h-screen pb-20 overflow-y-auto">
            <div className="max-w-[800px] mx-auto px-6 py-8">
                <div className="flex items-center justify-between mb-8">
                    <h1 className="text-3xl font-semibold text-white">Settings</h1>
                    <Search className="w-5 h-5 text-white cursor-pointer" onClick={() => navigate('/search')} />
                </div>

                {/* Account */}
                <div className="space-y-4 mb-8">
                    <h2 className="text-white font-semibold text-base">Account</h2>
                    <div className="flex items-center justify-between">
                        <p className="text-sm text-[#b3b3b3]">Edit login methods</p>
                        <Button
                            variant="outline"
                            className="rounded-full border-[#727272] hover:border-white text-white hover:bg-transparent bg-transparent h-8 text-sm px-4"
                            onClick={() => navigate('/profile')}
                        >
                            Edit
                        </Button>
                    </div>
                    <div className="flex items-center justify-between">
                        <p className="text-sm text-[#b3b3b3]">Privacy Policy</p>
                        <Button
                            variant="outline"
                            className="rounded-full border-[#727272] hover:border-white text-white hover:bg-transparent bg-transparent h-8 text-sm px-4"
                            onClick={() => navigate('/privacy')}
                        >
                            View
                        </Button>
                    </div>
                    <div className="flex items-center justify-between">
                        <p className="text-sm text-[#b3b3b3]">Terms of Service</p>
                        <Button
                            variant="outline"
                            className="rounded-full border-[#727272] hover:border-white text-white hover:bg-transparent bg-transparent h-8 text-sm px-4"
                            onClick={() => navigate('/terms')}
                        >
                            View
                        </Button>
                    </div>
                    <div className="flex items-center justify-between pt-2 border-t border-[#2a2a2a]">
                        <p className="text-sm text-red-400">Delete account and data</p>
                        <Button
                            variant="outline"
                            className="rounded-full border-red-600 hover:border-red-500 text-red-500 hover:bg-red-500/10 bg-transparent h-8 text-sm px-4"
                            onClick={() => navigate('/account-deletion')}
                        >
                            Delete
                        </Button>
                    </div>
                </div>



                {/* Audio Quality */}
                <div className="space-y-6 mb-8">
                    <div className="flex items-center gap-3">
                        <h2 className="text-white font-semibold text-base">Audio quality</h2>
                        {settings.streamingQuality !== 'Automatic' && (
                            <div className="px-2 py-0.5 bg-[#1ed760]/20 text-[#1ed760] text-xs rounded-full font-medium">
                                {settings.streamingQuality}
                            </div>
                        )}
                    </div>

                    <div className="flex items-center justify-between">
                        <p className="text-sm text-[#b3b3b3]">Streaming quality</p>
                        <Select value={settings.streamingQuality} onValueChange={settings.setStreamingQuality}>
                            <SelectTrigger className="w-[180px] bg-[#2a2a2a] border-none text-white h-10">
                                <SelectValue placeholder="Quality" />
                            </SelectTrigger>
                            <SelectContent className="bg-[#2a2a2a] border-none text-white">
                                <SelectItem value="Automatic">Automatic</SelectItem>
                                <SelectItem value="Low">Low</SelectItem>
                                <SelectItem value="Normal">Normal</SelectItem>
                                <SelectItem value="High">High</SelectItem>
                                <SelectItem value="Very High">Very High</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>

                </div>

                {/* Your Library */}
                <div className="space-y-6 mb-8">
                    <h2 className="text-white font-semibold text-base">Your Library</h2>
                    <div className="flex items-center justify-between">
                        <p className="text-sm text-[#b3b3b3]">Use compact library layout</p>
                        <Switch
                            checked={settings.compactLibraryLayout}
                            onCheckedChange={settings.setCompactLibraryLayout}
                            className="data-[state=checked]:bg-[#1ed760]"
                        />
                    </div>
                </div>






                <div className="space-y-6 sm:space-y-8 mb-8">
                    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                        <div className="flex items-center gap-3">
                            <h2 className="text-white font-semibold text-base">Playback</h2>
                            {Object.values(settings.equalizer).some(val => val !== 0) && (
                                <div className="w-2 h-2 bg-[#1ed760] rounded-full animate-pulse" title="Equalizer active" />
                            )}
                        </div>

                        <div className="flex items-center justify-between w-full sm:w-auto gap-4">
                            <button type="button"
                                onClick={settings.resetEqualizer}
                                className="text-xs font-medium text-[#b3b3b3] hover:text-white uppercase tracking-wider transition-colors ml-auto sm:ml-0"
                            >
                                Reset
                            </button>
                        </div>
                    </div>

                    <div className="bg-[#181818] p-4 sm:p-8 rounded-lg w-full">
                        {/* Horizontal Presets List - Compact & Wrapped on Mobile */}
                        <div className="flex justify-center w-full mb-6 sm:mb-8">
                            <div className="flex flex-wrap justify-center gap-2 max-w-full">
                                <button type="button"
                                    onClick={() => settings.resetEqualizer()}
                                    className="px-2.5 py-1 rounded-full text-[10px] sm:text-xs font-medium bg-white/10 hover:bg-white/20 text-white transition-colors whitespace-nowrap"
                                >
                                    Flat
                                </button>
                                {Object.keys(EQUALIZER_PRESETS).reduce<React.ReactNode[]>((acc, preset) => {
                                    if (preset !== 'Flat') {
                                        acc.push(
                                            <button type="button"
                                                key={preset}
                                                onClick={() => settings.setEqualizerPreset(preset)}
                                                className="px-2.5 py-1 rounded-full text-[10px] sm:text-xs font-medium bg-[#2a2a2a] hover:bg-[#3a3a3a] text-[#b3b3b3] hover:text-white transition-colors whitespace-nowrap border border-transparent hover:border-white/10"
                                            >
                                                {preset}
                                            </button>
                                        );
                                    }
                                    return acc;
                                }, [])}
                            </div>
                        </div>

                        <EqualizerVisualization settings={settings} />
                    </div>
                </div>

                <div className="h-20"></div> {/* Bottom padding */}
            </div>
        </div>
    );
};

export default SettingsPage;
