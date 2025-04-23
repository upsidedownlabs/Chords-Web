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
            { x: 100, y: 50 },
            { x: 70, y: 100 },
            { x: 100, y: 180 },
            { x: 130, y: 100 }
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
            <div className={`relative ${isFullPage ? 'w-[20%] sm:w-[18%] md:w-[20%] lg:w-[25%] h-[30%] sm:h-[40%] md:h-[50%] lg:h-[60%]' : 'w-[20%] sm:w-[18%] md:w-[15%] lg:w-[20%] h-[60%] sm:h-[70%] md:h-[80%] lg:h-[95%]'} group overflow-visible`}>
                <svg
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 200 300"
                    className={`absolute ${isFullPage ? '-top-[42%] sm:-top-[40%] md:-top-[50%] lg:-top-[43%]' : '-top-[25%] sm:-top-[18%] md:-top-[14%] lg:-top-[9%]'} left-1/2 transform -translate-x-1/2 w-full h-auto z-50 drop-shadow-xl pointer-events-none`}
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
                <div className={`absolute bottom-0 w-full ${isFullPage ? 'h-full' : 'h-[30%] sm:h-[32%] md:h-[34%] lg:h-[36%]'} bg-gradient-to-b from-gray-100 to-gray-200 dark:from-stone-600 dark:to-stone-700  rounded-t-md  backdrop-blur-md shadow-xl before:absolute before:inset-0 before:bg-white/10 before:opacity-40 before:rounded-b-xl before:rounded-t-md`}>
                    <div className="absolute inset-0 overflow-hidden  rounded-t-md bg-gradient-to-b from-cyan-300 via-blue-400 to-gray-900">
                        <div className={`absolute inset-0 ${isFullPage ? 'flex flex-row justify-center pt-10' : 'flex items-center justify-center'}  `}>
                            <div className="text-sm sm:text-xl md:text-xl lg:text-3xl font-semibold text-gray-800 px-2 sm:px-3 py-1 ">
                                {Number.isFinite(betaPower) ? String(Math.floor(betaPower)).padStart(2, '0') : '00'}
                            </div>
                        </div>

                    </div>
                </div>
            </div>
        </div>
    );
};

export default BrightCandleView;
