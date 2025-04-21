import React, { useState, useEffect } from 'react';

type FFTChannel = number[];
type FFTData = FFTChannel[];

interface BrightCandleViewProps {
  fftData?: FFTData;
  betaPower: number;
  fullscreen?: boolean;
}

interface CandleLitProps {
  betaPower: number;
}

const BrightCandleView: React.FC<BrightCandleViewProps> = ({ fftData = [], betaPower, fullscreen }) => {
  const brightness = Math.max(0, betaPower / 100); // Normalize brightness
  // Add smoothing and minimum brightness
  const [displayBrightness, setDisplayBrightness] = useState(0.1); // Start with small flame
  const [screenSize, setScreenSize] = useState('normal'); // 'normal', 'large' (150%), 'xlarge' (175%)

  useEffect(() => {
    // Detect screen size
    const detectScreenSize = () => {
      const width = window.innerWidth;
      if (width >= 1920) { // Assuming 1920px is 175% of standard size
        setScreenSize('xlarge');
      } else if (width >= 1680) { // Assuming 1680px is 150% of standard size
        setScreenSize('large');
      } else {
        setScreenSize('normal');
      }
    };

    // Set initial size
    detectScreenSize();

    // Update on resize
    window.addEventListener('resize', detectScreenSize);
    return () => window.removeEventListener('resize', detectScreenSize);
  }, []);

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
      { x: 100, y: 30 },
      { x: 60, y: 80 },
      { x: 100, y: 200 },
      { x: 140, y: 80 }
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

  // Calculate candle size based on screen size and fullscreen state
  const getCandleWidthClass = () => {
    if (fullscreen) {
      return screenSize === 'xlarge' ? 'w-40' : screenSize === 'large' ? 'w-36' : 'w-32';
    } else {
      return screenSize === 'xlarge' ? 'w-28' : screenSize === 'large' ? 'w-24' : 'w-20';
    }
  };

  const getCandleHeightClass = () => {
    if (fullscreen) {
      return 'h-96';
    } else {
      return screenSize === 'xlarge' ? 'h-56' : screenSize === 'large' ? 'h-48' : 'h-40';
    }
  };

  const getCandleHolderHeightClass = () => {
    if (fullscreen) {
      return 'h-48';
    } else {
      return screenSize === 'xlarge' ? 'h-28' : screenSize === 'large' ? 'h-24' : 'h-20';
    }
  };

  const getFlameHeightClass = () => {
    if (fullscreen) {
      return 'h-64';  // Increased from h-48
    } else {
      return screenSize === 'xlarge' ? 'h-56' :
        screenSize === 'large' ? 'h-48' :
          'h-40';
    }
  };
  return (
    <div className={`w-full h-full flex items-end justify-center min-h-0 min-w-0 ${fullscreen ? 'pb-4' : ''}`}>
      {/* Candle Container with dynamic width based on screen size and fullscreen mode */}
      <div className={`relative ${getCandleWidthClass()} ${getCandleHeightClass()} group`}>
        {/* Candle Holder with a glassy, frosted look */}
        <div
          className={`
    absolute bottom-0 w-full ${getCandleHolderHeightClass()}
    bg-gradient-to-b from-gray-100 to-gray-200 dark:from-stone-600 dark:to-stone-700
    rounded-t-md
    border border-gray-900 dark:border-gray-800 border-b-0
    backdrop-blur-md
    transition-transform duration-300
    before:absolute before:inset-0 before:bg-white/10 before:opacity-40 before:rounded-b-xl before:rounded-t-md
  `}
        >
          <div className="absolute inset-0 overflow-hidden rounded-t-md bg-gradient-to-b from-cyan-300 via-blue-400 to-gray-900">
            <div className="absolute top-2 left-1/2 transform -translate-x-1/2 text-center">
              <div className={`${fullscreen ? 'text-3xl' : screenSize === 'xlarge' ? 'text-2xl' : 'text-xl'} font-semibold text-[#030c21] px-2 py-1 rounded-md opacity-70`}>
                {String(Math.floor(betaPower)).padStart(2, '0')}
              </div>
            </div>
          </div>
        </div>

        {/* Yellow-Themed Animated Flame */}
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox={`0 0 200 ${fullscreen ? 200 : 400}`}  // Increased viewBox height
          className={`absolute top-0 left-1/2 transform -translate-x-1/2 w-full ${getFlameHeightClass()} z-10 drop-shadow-xl`}
        >
          <defs>
            {/* Outer Flame Gradient: Rich, Realistic Candle Flame Colors */}
            <linearGradient id="outerFlameGradient" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor={`rgba(255,140,0, ${brightness * 1})`} />
              <stop offset="100%" stopColor={`rgba(255,69,0, ${brightness * 0.6})`} />
            </linearGradient>

            {/* Inner Flame Gradient: Warm, Luminous Colors */}
            <linearGradient id="innerFlameGradient" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor={`rgba(255,165,0, ${brightness * 1.2})`} />
              <stop offset="100%" stopColor={`rgba(255,99,71, ${brightness * 0.8})`} />
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
        </svg>
      </div>
    </div>
  );
};

export default BrightCandleView;