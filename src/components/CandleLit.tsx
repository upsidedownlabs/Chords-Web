import React, { useState, useEffect } from 'react';

type FFTChannel = number[];
type FFTData = FFTChannel[];

interface BrightCandleViewProps {
    fftData?: FFTData;
    betaPower: number;
    isFullPage?: boolean;
}

const BrightCandleView: React.FC<BrightCandleViewProps> = ({ fftData = [], betaPower, isFullPage }) => {
    const brightness = Math.max(0, betaPower / 100);
    const [displayBrightness, setDisplayBrightness] = useState(0.1);

    useEffect(() => {
        const target = Math.max(0.1, Math.min(1, betaPower / 100));
        const timer = setInterval(() => {
            setDisplayBrightness(prev => {
                const diff = target - prev;
                return Math.abs(diff) < 0.01 ? target : prev + diff * 0.1;
            });
        }, 16);
        return () => clearInterval(timer);
    }, [betaPower]);

    const generateFlamePath = () => {
        const basePoints = [
            { x: 100, y: 120 },
            { x: 70, y: 220 },
            { x: 100, y: 280 },
            { x: 130, y: 220 }
        ];
        const controlPoints = basePoints.map(point => ({
            x: point.x + (Math.random() - 0.5) * (10 * brightness),
            y: point.y + (Math.random() - 0.5) * (10 * brightness)
        }));
        return `
      M${controlPoints[0].x} ${controlPoints[0].y}
      Q${controlPoints[1].x} ${controlPoints[1].y}, ${controlPoints[2].x} ${controlPoints[2].y}
      Q${controlPoints[3].x} ${controlPoints[3].y}, ${controlPoints[0].x} ${controlPoints[0].y}
    `;
    };

    return (
        <div className="w-full h-full flex items-end justify-center min-h-0 min-w-0">
            <div className={`relative ${isFullPage
                ? 'w-1/4 h-3/4 sm:w-1/4 sm:h-3/4 md:w-1/4 md:h-3/4 lg:w-1/4 lg:h-3/4 xl:w-1/4 xl:h-3/4 2xl:w-1/4 2xl:h-3/4'
                : 'w-1/4 h-4/5 sm:w-1/5 sm:h-4/5 md:w-1/6 md:h-5/6 lg:w-1/6 lg:h-5/6 xl:w-1/6 xl:h-5/6'
                }`}
            >
                {/* Container wrapper with relative positioning */}
                <div className="relative w-full h-full flex flex-col">
                    {/* Flame should take up approximately 60% of the total height */}
                    <div style={{ height: '80%' }} className="relative w-full">
                        <svg
                            xmlns="http://www.w3.org/2000/svg"
                            viewBox="0 0 200 300"
                            className="absolute bottom-0 w-full"
                            preserveAspectRatio="xMidYMid meet"
                        >
                            <defs>
                                <linearGradient id="outerFlameGradient" x1="0%" y1="0%" x2="0%" y2="100%">
                                    <stop offset="0%" stopColor={`rgba(255,140,0, ${brightness * 0.6})`} />
                                    <stop offset="100%" stopColor={`rgba(255,69,0, ${brightness * 0.3})`} />
                                </linearGradient>
                                <linearGradient id="innerFlameGradient" x1="0%" y1="0%" x2="0%" y2="100%">
                                    <stop offset="0%" stopColor={`rgba(255,165,0, ${brightness * 0.8})`} />
                                    <stop offset="100%" stopColor={`rgba(255,99,71, ${brightness * 0.5})`} />
                                </linearGradient>
                                <filter id="flameBlur">
                                    <feGaussianBlur stdDeviation="7" />
                                </filter>
                                <filter id="innerGlow">
                                    <feGaussianBlur stdDeviation="4" result="coloredBlur" />
                                    <feMerge>
                                        <feMergeNode in="coloredBlur" />
                                        <feMergeNode in="SourceGraphic" />
                                    </feMerge>
                                </filter>
                            </defs>
                            <path
                                d={generateFlamePath()}
                                fill="url(#outerFlameGradient)"
                                filter="url(#flameBlur)"
                                className="transition-all duration-300 animate-flicker opacity-70"
                            />
                            <path
                                d={generateFlamePath()}
                                fill="url(#innerFlameGradient)"
                                filter="url(#innerGlow)"
                                className="transition-all duration-300 animate-flicker"
                            />
                        </svg>
                    </div>

                    {/* Candle should take up approximately 40% of the total height */}
                    <div style={{ height: '80%' }} className="w-full bg-gradient-to-b from-gray-100 to-gray-200 dark:from-stone-600 dark:to-stone-700 rounded-t-md backdrop-blur-md shadow-xl relative">
                        <div className="absolute inset-0 overflow-hidden rounded-t-md bg-gradient-to-b from-cyan-300 via-blue-400 to-gray-900">
                            <div className={`absolute inset-0 ${isFullPage
                                ? 'flex justify-center items-start pt-4'
                                : 'flex items-center justify-center'
                                }`}
                            >
                                <div
                                    className={`${isFullPage
                                            ? 'text-2xl sm:text-3xl md:text-4xl lg:text-5xl xl:text-6xl'
                                            : 'text-xs sm:text-sm md:text-lg lg:text-xl xl:text-2xl'
                                        } font-semibold text-gray-800 px-1 sm:px-2 md:px-3 py-1 transition-all duration-300 ease-in-out`}
                                >
                                    {Number.isFinite(betaPower) ? String(Math.floor(betaPower)).padStart(2, '0') : '00'}
                                </div>

                            </div>
                        </div>
                        <div className="absolute inset-0 bg-white/10 opacity-40 rounded-b-xl rounded-t-md"></div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default BrightCandleView;