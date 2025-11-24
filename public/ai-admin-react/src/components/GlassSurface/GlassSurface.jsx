import { useEffect, useRef, useId, useState } from 'react';
import './GlassSurface.css';

export const GlassSurface = ({
  children,
  width = 200,
  height = 80,
  borderRadius = 20,
  borderWidth = 0.07,
  brightness = 50,
  opacity = 0.93,
  blur = 11,
  displace = 0,
  backgroundOpacity = 0,
  saturation = 1,
  distortionScale = -180,
  redOffset = 0,
  greenOffset = 10,
  blueOffset = 20,
  xChannel = 'R',
  yChannel = 'G',
  mixBlendMode = 'difference',
  className = '',
  ...props
}) => {
  const containerRef = useRef(null);
  const feImageRef = useRef(null);
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });
  const uniqueId = useId();

  const filterId = `glass-filter-${uniqueId}`;
  const redGradId = `red-grad-${uniqueId}`;
  const blueGradId = `blue-grad-${uniqueId}`;

  // Check if browser supports SVG filters
  const supportsSVGFilters = () => {
    const isWebkit = /Safari/.test(navigator.userAgent) && !/Chrome/.test(navigator.userAgent);
    const isFirefox = /Firefox/.test(navigator.userAgent);

    if (isWebkit || isFirefox) return false;

    const div = document.createElement('div');
    div.style.backdropFilter = `url(#${filterId})`;
    return div.style.backdropFilter !== '';
  };

  const [usesSVG] = useState(supportsSVGFilters());

  // Generate displacement map
  const generateDisplacementMap = (actualWidth, actualHeight) => {
    const edgeSize = Math.min(actualWidth, actualHeight) * (borderWidth * 0.5);

    const svgContent = `
      <svg viewBox="0 0 ${actualWidth} ${actualHeight}" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <linearGradient id="${redGradId}" x1="100%" y1="0%" x2="0%" y2="0%">
            <stop offset="0%" stop-color="#0000"/>
            <stop offset="100%" stop-color="red"/>
          </linearGradient>
          <linearGradient id="${blueGradId}" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stop-color="#0000"/>
            <stop offset="100%" stop-color="blue"/>
          </linearGradient>
        </defs>
        <rect x="0" y="0" width="${actualWidth}" height="${actualHeight}" fill="black"></rect>
        <rect x="0" y="0" width="${actualWidth}" height="${actualHeight}" rx="${borderRadius}" fill="url(#${redGradId})" />
        <rect x="0" y="0" width="${actualWidth}" height="${actualHeight}" rx="${borderRadius}" fill="url(#${blueGradId})" style="mix-blend-mode: ${mixBlendMode}" />
        <rect x="${edgeSize}" y="${edgeSize}" width="${actualWidth - edgeSize * 2}" height="${actualHeight - edgeSize * 2}" rx="${borderRadius}" fill="hsl(0 0% ${brightness}% / ${opacity})" style="filter:blur(${blur}px)" />
      </svg>
    `;

    return `data:image/svg+xml,${encodeURIComponent(svgContent)}`;
  };

  // Update displacement map when dimensions change
  useEffect(() => {
    if (!usesSVG || !containerRef.current || !feImageRef.current) return;

    const rect = containerRef.current.getBoundingClientRect();
    const actualWidth = rect.width || 400;
    const actualHeight = rect.height || 200;

    setDimensions({ width: actualWidth, height: actualHeight });
    feImageRef.current.setAttribute('href', generateDisplacementMap(actualWidth, actualHeight));
  }, [width, height, borderRadius, brightness, opacity, blur, mixBlendMode, usesSVG]);

  // Resize observer
  useEffect(() => {
    if (!usesSVG || !containerRef.current) return;

    const resizeObserver = new ResizeObserver(() => {
      if (!containerRef.current || !feImageRef.current) return;

      const rect = containerRef.current.getBoundingClientRect();
      const actualWidth = rect.width || 400;
      const actualHeight = rect.height || 200;

      setDimensions({ width: actualWidth, height: actualHeight });
      feImageRef.current.setAttribute('href', generateDisplacementMap(actualWidth, actualHeight));
    });

    resizeObserver.observe(containerRef.current);

    return () => resizeObserver.disconnect();
  }, [usesSVG]);

  const containerStyle = {
    width: typeof width === 'number' ? `${width}px` : width,
    height: typeof height === 'number' ? `${height}px` : height,
    borderRadius: `${borderRadius}px`,
    '--glass-frost': backgroundOpacity,
    '--glass-saturation': saturation,
    '--filter-id': `url(#${filterId})`,
  };

  return (
    <div
      ref={containerRef}
      className={`glass-surface ${usesSVG ? 'glass-surface--svg' : 'glass-surface--fallback'} ${className}`}
      style={containerStyle}
      {...props}
    >
      {usesSVG && (
        <svg className="glass-surface__filter" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <filter
              id={filterId}
              colorInterpolationFilters="sRGB"
              x="0%"
              y="0%"
              width="100%"
              height="100%"
            >
              <feImage
                ref={feImageRef}
                x="0"
                y="0"
                width="100%"
                height="100%"
                preserveAspectRatio="none"
                result="map"
              />

              <feDisplacementMap
                in="SourceGraphic"
                in2="map"
                scale={distortionScale + redOffset}
                xChannelSelector={xChannel}
                yChannelSelector={yChannel}
                result="dispRed"
              />
              <feColorMatrix
                in="dispRed"
                type="matrix"
                values="1 0 0 0 0
                        0 0 0 0 0
                        0 0 0 0 0
                        0 0 0 1 0"
                result="red"
              />

              <feDisplacementMap
                in="SourceGraphic"
                in2="map"
                scale={distortionScale + greenOffset}
                xChannelSelector={xChannel}
                yChannelSelector={yChannel}
                result="dispGreen"
              />
              <feColorMatrix
                in="dispGreen"
                type="matrix"
                values="0 0 0 0 0
                        0 1 0 0 0
                        0 0 0 0 0
                        0 0 0 1 0"
                result="green"
              />

              <feDisplacementMap
                in="SourceGraphic"
                in2="map"
                scale={distortionScale + blueOffset}
                xChannelSelector={xChannel}
                yChannelSelector={yChannel}
                result="dispBlue"
              />
              <feColorMatrix
                in="dispBlue"
                type="matrix"
                values="0 0 0 0 0
                        0 0 0 0 0
                        0 0 1 0 0
                        0 0 0 1 0"
                result="blue"
              />

              <feBlend in="red" in2="green" mode="screen" result="rg" />
              <feBlend in="rg" in2="blue" mode="screen" result="output" />
              <feGaussianBlur in="output" stdDeviation={displace} />
            </filter>
          </defs>
        </svg>
      )}

      <div className="glass-surface__content">
        {children}
      </div>
    </div>
  );
};

export default GlassSurface;
