import React, { useState, useEffect } from 'react';

type FFTChannel = number[];
type FFTData = FFTChannel[];

interface BrightCandleViewProps {
  fftData?: FFTData;
  betaPower: number;
}

interface CandleLitProps {
  betaPower: number;
}

const BrightCandleView: React.FC<BrightCandleViewProps> = ({ fftData = [], betaPower }) => {
  const brightness = Math.max(0, betaPower / 100); // Normalize brightness
  // Add smoothing and minimum brightness
  const [displayBrightness, setDisplayBrightness] = useState(0.1); // Start with small flame

  useEffect(() => {
    // Always show at least a small flame (0.1) and cap at 1.0
    const target = Math.max(0.1, Math.min(1, betaPower / 100));

    // Smooth transition
    const timer = setInterval(() => {
      setDisplayBrightness(prev => {
        const diff = target - prev;
        return Math.abs(diff) < 0.01 ? target : prev + diff * 0.1;
      });
    }, 16); // ~60fps

    return () => clearInterval(timer);
  }, [betaPower]);
  // console.log("beta",betaPower);

  // Use displayBrightness instead of raw betaPower for all visual elements
  const flameColor = `rgba(255, 165, 0, ${displayBrightness})`;
  // Calculate brightness from FFT data
  const calculateBrightness = (): number => {
    if (!Array.isArray(fftData) || fftData.length === 0) {
      return 0.5;
    }
    const channelData = fftData.find(
      (channel): channel is FFTChannel =>
        Array.isArray(channel) && channel.length > 0
    );
    if (!channelData) return 0.5;
    const totalEnergy = channelData.reduce((sum: number, value: number) => sum + (value || 0), 0);
    return Math.min(Math.max(totalEnergy / 100, 0.3), 1);
  };


  // Generate a slightly randomized organic flame path
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
    <div className="w-full h-full flex items-center justify-center min-h-0 min-w-0 ">
      {/* Candle Container with reduced width */}
      <div className="relative w-32 h-64 group">
        {/* Candle Holder with a glassy, frosted look */}
        <div className="absolute bottom-0 w-full h-32 
          bg-gradient-to-b from-gray-100 to-gray-200 dark:from-stone-600 dark:to-stone-700 
          rounded-b-xl rounded-t-md 
          border border-gray-300 dark:border-white/20 
          backdrop-blur-md shadow-xl 
          transition-transform duration-300 
          group-hover:scale-105
          before:absolute before:inset-0 before:bg-white/10 before:opacity-40 before:rounded-b-xl before:rounded-t-md
          after:absolute after:bottom-0 after:left-0 after:right-0 after:h-2 after:bg-gradient-to-b after:from-transparent after:to-gray-300/30"
        >

          <div className="absolute inset-0 overflow-hidden rounded-b-xl rounded-t-md bg-gradient-to-b from-cyan-300 via-blue-400 to-blue-600
">

            <div className="absolute top-2 left-2 right-2 h-0.5 bg-gray-300/30"></div>

            <div className="absolute top-2 left-1/2 transform -translate-x-1/2 text-center">
              <div className="text-sm font-semibold text-gray-700   px-2 py-1 rounded-md ">
                Beta: {betaPower.toFixed(1)}%
              </div>
            </div>
          </div>
        </div>

        {/* Yellow-Themed Animated Flame */}
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 200 300"
          className="absolute top-0 left-1/2 transform -translate-x-1/2 w-full h-48 z-10 drop-shadow-xl"
        >
          <defs>
            {/* Outer Flame Gradient: Rich, Realistic Candle Flame Colors */}
            <linearGradient id="outerFlameGradient" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor={`rgba(255,140,0, ${brightness * 0.6})`} />
              <stop offset="100%" stopColor={`rgba(255,69,0, ${brightness * 0.3})`} />
            </linearGradient>

            {/* Inner Flame Gradient: Warm, Luminous Colors */}
            <linearGradient id="innerFlameGradient" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor={`rgba(255,165,0, ${brightness * 0.8})`} />
              <stop offset="100%" stopColor={`rgba(255,99,71, ${brightness * 0.5})`} />
            </linearGradient>

            {/* Filters for Enhanced Realism */}
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


          {/* Outer Flame Layer */}
          <path
            d={generateFlamePath()}
            fill="url(#outerFlameGradient)"
            filter="url(#flameBlur)"
            className="transition-all duration-300 animate-flicker opacity-70"
          />

          {/* Inner Flame Layer */}
          <path
            d={generateFlamePath()}
            fill="url(#innerFlameGradient)"
            filter="url(#innerGlow)"
            className="transition-all duration-300 animate-flicker"
          />

          {/* White Hot Core */}
          <ellipse
            cx="100"
            cy="150"
            rx={`${12 * brightness}`}
            ry={`${24 * brightness}`}
            fill={`rgba(255,255,255, ${brightness * 0.6})`}
            filter="url(#innerGlow)"
            className="transition-all duration-300"
          />
        </svg>


      </div>
    </div>
  );
};

export default BrightCandleView;
