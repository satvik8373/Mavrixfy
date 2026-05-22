import React, { useEffect, useRef } from 'react';

interface LightPillarProps {
  topColor?: string;
  bottomColor?: string;
  intensity?: number;
  rotationSpeed?: number;
  interactive?: boolean;
  glowAmount?: number;
  pillarWidth?: number;
  pillarHeight?: number;
  noiseIntensity?: number;
  pillarRotation?: number;
  className?: string;
}

export const LightPillar: React.FC<LightPillarProps> = ({
  topColor = '#4a8d37',
  bottomColor = '#215180',
  intensity = 1,
  rotationSpeed = 0.3,
  interactive = false,
  glowAmount = 0.005,
  pillarWidth = 3,
  pillarHeight = 0.4,
  noiseIntensity = 0.5,
  pillarRotation = 0,
  className = '',
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);


  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let rotation = pillarRotation;

    let animationId: number;

    const resize = () => {
      canvas.width = canvas.offsetWidth;
      canvas.height = canvas.offsetHeight;
    };

    // Helper function to convert hex to rgba
    const hexToRgba = (hex: string, alpha: number) => {
      const r = parseInt(hex.slice(1, 3), 16);
      const g = parseInt(hex.slice(3, 5), 16);
      const b = parseInt(hex.slice(5, 7), 16);
      return `rgba(${r}, ${g}, ${b}, ${alpha})`;
    };

    const drawPillar = () => {
      if (!ctx || !canvas) return;

      ctx.clearRect(0, 0, canvas.width, canvas.height);

      const centerX = canvas.width / 2;
      const centerY = canvas.height / 2;

      // Apply rotation
      rotation += rotationSpeed * 0.01;

      // Create gradient pillars
      const numPillars = 12;
      for (let i = 0; i < numPillars; i++) {
        const angle = (i / numPillars) * Math.PI * 2 + rotation;
        const x = centerX + Math.cos(angle) * (canvas.width * 0.3);
        const y = centerY + Math.sin(angle) * (canvas.height * 0.3);

        // Create radial gradient with proper rgba colors
        const gradient = ctx.createRadialGradient(x, y, 0, x, y, canvas.width * pillarWidth * 0.1);
        gradient.addColorStop(0, hexToRgba(topColor, intensity));
        gradient.addColorStop(0.5, hexToRgba(bottomColor, intensity * 0.8));
        gradient.addColorStop(1, 'rgba(0, 0, 0, 0)');

        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, canvas.width, canvas.height);
      }

      // Add glow effect
      ctx.globalCompositeOperation = 'lighter';
      const glowGradient = ctx.createRadialGradient(
        centerX,
        centerY,
        0,
        centerX,
        centerY,
        canvas.width * 0.5
      );
      glowGradient.addColorStop(0, hexToRgba(topColor, glowAmount * 100));
      glowGradient.addColorStop(0.5, hexToRgba(bottomColor, glowAmount * 50));
      glowGradient.addColorStop(1, 'rgba(0, 0, 0, 0)');

      ctx.fillStyle = glowGradient;
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      ctx.globalCompositeOperation = 'source-over';

      animationId = requestAnimationFrame(drawPillar);
    };

    resize();
    window.addEventListener('resize', resize);

    drawPillar();

    return () => {
      window.removeEventListener('resize', resize);
      if (animationId) {
        cancelAnimationFrame(animationId);
      }
    };
  }, [topColor, bottomColor, intensity, rotationSpeed, interactive, glowAmount, pillarWidth, pillarHeight, noiseIntensity, pillarRotation]);

  return (
    <canvas
      ref={canvasRef}
      className={`w-full h-full ${className}`}
      style={{ display: 'block' }}
    />
  );
};
