import { useState, useEffect } from 'react';
import { getOptimizedArtworkUrl } from '@/services/cloudinaryService';

export interface AlbumColors {
  primary: string;
  secondary: string;
  accent: string;
  text: string;
  overlay: string;
  gradient: string;
  isLight: boolean;
  cssVars: React.CSSProperties;
  vibrant: string;
  muted: string;
  darkVibrant: string;
  lightVibrant: string;
  dominantHue: number;
  saturation: number;
  brightness: number;
}

type ColorThiefInstance = {
  getColor: (sourceImage: HTMLImageElement) => number[];
  getPalette: (sourceImage: HTMLImageElement, colorCount?: number) => number[][];
};

const albumColorsCache = new Map<string, AlbumColors>();
let colorThiefPromise: Promise<ColorThiefInstance> | null = null;

function loadColorThief(): Promise<ColorThiefInstance> {
  if (!colorThiefPromise) {
    colorThiefPromise = import('colorthief').then((module) => {
      const ColorThief = module ? (module.default || module) : null;
      if (!ColorThief) {
        throw new Error('ColorThief module is undefined');
      }
      return new ColorThief() as ColorThiefInstance;
    });
  }

  return colorThiefPromise;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function rgbToCss([r, g, b]: number[]): string {
  return `rgb(${clamp(r, 0, 255)}, ${clamp(g, 0, 255)}, ${clamp(b, 0, 255)})`;
}

// Convert RGB to HSL for better color manipulation
function rgbToHsl(r: number, g: number, b: number): [number, number, number] {
  r /= 255;
  g /= 255;
  b /= 255;

  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let h = 0, s = 0, l = (max + min) / 2;

  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);

    switch (max) {
      case r: h = (g - b) / d + (g < b ? 6 : 0); break;
      case g: h = (b - r) / d + 2; break;
      case b: h = (r - g) / d + 4; break;
    }
    h /= 6;
  }

  return [h * 360, s, l];
}

// Convert HSL back to RGB
function hslToRgb(h: number, s: number, l: number): [number, number, number] {
  h /= 360;
  
  const hue2rgb = (p: number, q: number, t: number) => {
    if (t < 0) t += 1;
    if (t > 1) t -= 1;
    if (t < 1/6) return p + (q - p) * 6 * t;
    if (t < 1/2) return q;
    if (t < 2/3) return p + (q - p) * (2/3 - t) * 6;
    return p;
  };

  let r, g, b;

  if (s === 0) {
    r = g = b = l; // achromatic
  } else {
    const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
    const p = 2 * l - q;
    r = hue2rgb(p, q, h + 1/3);
    g = hue2rgb(p, q, h);
    b = hue2rgb(p, q, h - 1/3);
  }

  return [Math.round(r * 255), Math.round(g * 255), Math.round(b * 255)];
}

// Relative luminance per WCAG
function luminance(r: number, g: number, b: number): number {
  const a = [r, g, b].map((v) => {
    v /= 255;
    return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * a[0] + 0.7152 * a[1] + 0.0722 * a[2];
}

function contrastRatio(rgb1: number[], rgb2: number[]): number {
  const L1 = luminance(rgb1[0], rgb1[1], rgb1[2]) + 0.05;
  const L2 = luminance(rgb2[0], rgb2[1], rgb2[2]) + 0.05;
  return L1 > L2 ? L1 / L2 : L2 / L1;
}

function blend(rgb: number[], target: number[], amount: number): number[] {
  return [
    Math.round(rgb[0] * (1 - amount) + target[0] * amount),
    Math.round(rgb[1] * (1 - amount) + target[1] * amount),
    Math.round(rgb[2] * (1 - amount) + target[2] * amount),
  ];
}

function hueDistance(a: number, b: number): number {
  const diff = Math.abs(a - b) % 360;
  return diff > 180 ? 360 - diff : diff;
}

// Calculate saturation (0-1)
function getSaturation(rgb: number[]): number {
  const r = rgb[0] / 255;
  const g = rgb[1] / 255;
  const b = rgb[2] / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;

  if (max === min) return 0;
  const d = max - min;
  return l > 0.5 ? d / (2 - max - min) : d / (max + min);
}

// Get color temperature (warm vs cool)
function getColorTemperature(rgb: number[]): number {
  const [r, g, b] = rgb;
  // Simplified color temperature calculation
  // Higher values = warmer (red/orange), lower = cooler (blue)
  return (r - b) / 255;
}

// Advanced color scoring with professional criteria - enhanced for maximum vibrancy
function scoreColorProfessional(rgb: number[]): number {
  const [r, g, b] = rgb;
  const [h, s, l] = rgbToHsl(r, g, b);
  const sat = getSaturation(rgb);
  const lum = luminance(r, g, b);
  const temp = getColorTemperature(rgb);

  // Heavily penalize greyscale colors
  if (sat < 0.2) return 0.05;

  // Professional color preferences (enhanced for maximum vibrancy)
  let score = 0;

  // 1. Saturation score (heavily prefer vibrant colors)
  score += sat * 4.0; // Increased from 3.0

  // 2. Luminance score (prefer colors that work well as vibrant backgrounds)
  const idealLuminance = 0.4; // Slightly brighter sweet spot
  const lumScore = 1 - Math.abs(lum - idealLuminance) * 1.5; // Less penalty for brightness
  score += Math.max(0, lumScore) * 2.5; // Increased weight

  // 3. Hue preferences (enhanced for more color variety)
  // Prefer all vibrant hues more equally
  const hueScore = Math.sin((h + 60) * Math.PI / 180) * 0.5 + 0.5;
  score += hueScore * 2.0; // Increased from 1.5

  // 4. Enhanced color harmony bonus
  if (h >= 200 && h <= 280) score += 1.5; // Blues and purples (increased)
  if (h >= 300 && h <= 360) score += 1.2; // Magentas (increased)
  if (h >= 0 && h <= 60) score += 1.2; // Reds and oranges (increased)
  if (h >= 80 && h <= 140) score += 1.0; // Greens (increased)
  if (h >= 140 && h <= 200) score += 0.8; // Cyans and teals

  // 5. Bonus for highly saturated colors
  if (sat > 0.6) score += 2.0; // Big bonus for very saturated colors
  if (sat > 0.8) score += 1.0; // Extra bonus for extremely saturated

  // 6. Avoid muddy colors but prefer rich, vibrant ones
  if (l > 0.25 && l < 0.75 && sat > 0.4) score += 1.5; // Increased bonus

  // 7. Bonus for colors that "pop" - high contrast potential
  if (sat > 0.5 && (l > 0.3 && l < 0.6)) score += 1.0;

  return Math.max(0, score);
}

// Generate professional color palette from base color - enhanced for maximum vibrancy
function generateProfessionalPalette(baseRgb: number[]): {
  vibrant: number[];
  muted: number[];
  darkVibrant: number[];
  lightVibrant: number[];
  accent: number[];
  secondary: number[];
} {
  const [h, s, l] = rgbToHsl(baseRgb[0], baseRgb[1], baseRgb[2]);

  // Vibrant: Maximum saturation and optimal lightness for impact
  const vibrantS = Math.min(1, s * 1.6); // Increased boost
  const vibrantL = Math.max(0.45, Math.min(0.65, l * 1.3)); // Brighter range
  const vibrant = hslToRgb(h, vibrantS, vibrantL);

  // Muted: Still colorful but less intense
  const mutedS = Math.max(0.3, s * 0.6); // Keep some saturation
  const mutedL = Math.max(0.35, Math.min(0.55, l));
  const muted = hslToRgb(h, mutedS, mutedL);

  // Dark Vibrant: Rich, deep colors with high saturation
  const darkVibrantS = Math.min(1, s * 1.4);
  const darkVibrantL = Math.max(0.2, Math.min(0.4, l * 0.7));
  const darkVibrant = hslToRgb(h, darkVibrantS, darkVibrantL);

  // Light Vibrant: Bright, energetic colors
  const lightVibrantS = Math.min(1, s * 1.3);
  const lightVibrantL = Math.max(0.65, Math.min(0.85, l * 1.5));
  const lightVibrant = hslToRgb(h, lightVibrantS, lightVibrantL);

  // Accent: Complementary or analogous color with high impact
  const accentH = (h + 45) % 360; // Slightly wider analogous harmony
  const accentS = Math.min(1, s * 1.2);
  const accentL = Math.max(0.5, Math.min(0.75, l * 1.2));
  const accent = hslToRgb(accentH, accentS, accentL);

  // Secondary: Rich, saturated version for gradients (no black mixing)
  const secondaryS = Math.min(1, s * 1.2);
  const secondaryL = Math.max(0.15, Math.min(0.35, l * 0.6));
  const secondary = hslToRgb(h, secondaryS, secondaryL);

  return { vibrant, muted, darkVibrant, lightVibrant, accent, secondary };
}

function adjustForProfessionalContrast(baseInput: number[], isLikedSongs: boolean = false): {
  bg: number[];
  text: string;
  overlay: string;
  accent: string;
  secondary: number[];
  vibrant: number[];
  muted: number[];
  darkVibrant: number[];
  lightVibrant: number[];
  dominantHue: number;
  saturation: number;
  brightness: number;
} {
  let base = baseInput;

  // Special processing for Liked Songs: iconic purple-pink gradient
  if (isLikedSongs) {
    base = [138, 43, 226]; // Professional purple base
  }

  const white = [255, 255, 255];
  const black = [0, 0, 0];

  // Generate professional color palette
  const palette = generateProfessionalPalette(base);

  // Keep backgrounds closer to the dominant album tone (Spotify-like),
  // then enrich with vibrant color depth without over-shifting hue.
  const bg = blend(palette.vibrant, palette.darkVibrant, 0.42);
  
  // Get color properties for metadata
  const [h, s, l] = rgbToHsl(bg[0], bg[1], bg[2]);
  const dominantHue = Math.round(h);
  const saturation = Math.round(s * 100);
  const brightness = Math.round(l * 100);

  // Professional text color selection
  const bgLuminance = luminance(bg[0], bg[1], bg[2]);
  let text = 'white';
  
  // Only use dark text on very light backgrounds
  if (bgLuminance > 0.75) {
    text = 'black';
  }

  // No overlay needed - solid colors provide enough contrast
  let overlay = 'none';

  // Enhanced accent color with better contrast
  const accentRgb = palette.accent;
  const accentContrast = contrastRatio(bg, accentRgb);
  let finalAccent = accentRgb;
  
  // Ensure accent has good contrast
  if (accentContrast < 3) {
    const [ah, as, al] = rgbToHsl(accentRgb[0], accentRgb[1], accentRgb[2]);
    const newL = bgLuminance > 0.5 ? Math.max(0.2, al - 0.3) : Math.min(0.8, al + 0.3);
    finalAccent = hslToRgb(ah, as, newL);
  }

  const accent = rgbToCss(finalAccent);

  return {
    bg,
    text,
    overlay,
    accent,
    secondary: blend(palette.secondary, palette.darkVibrant, 0.35),
    vibrant: palette.vibrant,
    muted: palette.muted,
    darkVibrant: palette.darkVibrant,
    lightVibrant: palette.lightVibrant,
    dominantHue,
    saturation,
    brightness
  };
}

export const useAlbumColors = (imageUrl: string | undefined, isLikedSongs: boolean = false): AlbumColors => {
  const [colors, setColors] = useState<AlbumColors>({
    primary: 'rgb(64, 64, 64)',
    secondary: 'rgb(32, 32, 32)',
    accent: 'rgb(29, 185, 84)',
    text: 'white',
    overlay: 'rgba(0,0,0,0.1)',
    gradient: 'linear-gradient(180deg, rgb(64,64,64) 0%, rgb(32,32,32) 100%)',
    isLight: false,
    cssVars: {
      '--album-primary': 'rgb(64,64,64)'
    } as React.CSSProperties,
    vibrant: 'rgb(64, 64, 64)',
    muted: 'rgb(96, 96, 96)',
    darkVibrant: 'rgb(32, 32, 32)',
    lightVibrant: 'rgb(128, 128, 128)',
    dominantHue: 0,
    saturation: 0,
    brightness: 25,
  });

  useEffect(() => {
    if (!imageUrl) return;

    const cacheKey = `${isLikedSongs ? 'liked' : 'album'}:${imageUrl}`;
    const cachedColors = albumColorsCache.get(cacheKey);
    if (cachedColors) {
      setColors(cachedColors);
      return;
    }

    let isCancelled = false;
    const colorSourceUrl = getOptimizedArtworkUrl(imageUrl, {
      width: 96,
      height: 96,
      crop: 'fill',
    });
    const img = new Image();
    img.crossOrigin = 'Anonymous';

    img.onload = async () => {
      try {
        const colorThief = await loadColorThief();
        if (isCancelled) return;

        // Dominant color keeps the UI matched to the overall cover artwork.
        const dominantColor = colorThief.getColor(img) as number[];
        const palette = colorThief.getPalette(img, 16) as number[][];

        // Professional color selection algorithm with more color candidates
        let bestColor = palette[0] || dominantColor;
        let maxScore = -Infinity;

        // Analyze all colors with professional scoring - prioritize vibrant, saturated colors
        for (const color of palette) {
          const score = scoreColorProfessional(color);
          if (score > maxScore) {
            maxScore = score;
            bestColor = color;
          }
        }

        // If no good color found, find the most vibrant and saturated one
        if (maxScore < 1) {
          bestColor = palette.reduce((best, current) => {
            const bestSat = getSaturation(best);
            const currentSat = getSaturation(current);
            const bestLum = luminance(best[0], best[1], best[2]);
            const currentLum = luminance(current[0], current[1], current[2]);
            
            // Prefer colors with higher saturation and good luminance
            const bestScore = bestSat * 2 + (bestLum > 0.2 && bestLum < 0.7 ? 1 : 0);
            const currentScore = currentSat * 2 + (currentLum > 0.2 && currentLum < 0.7 ? 1 : 0);
            
            return currentScore > bestScore ? current : best;
          });
        }

        // Blend dominant + vibrant candidate so large-area album tones win.
        const [dominantHue, dominantSat] = rgbToHsl(dominantColor[0], dominantColor[1], dominantColor[2]);
        const [candidateHue] = rgbToHsl(bestColor[0], bestColor[1], bestColor[2]);
        const hueGap = hueDistance(dominantHue, candidateHue);

        let enrichment = 0.26;
        if (dominantSat < 0.2) enrichment = 0.38;
        if (hueGap > 40) enrichment = 0.14;

        const baseColor = blend(dominantColor, bestColor, enrichment);
        const result = adjustForProfessionalContrast(baseColor, isLikedSongs);

        const primaryCss = rgbToCss(result.bg);
        const secondaryCss = rgbToCss(result.secondary);
        const vibrantCss = rgbToCss(result.vibrant);
        const mutedCss = rgbToCss(result.muted);
        const darkVibrantCss = rgbToCss(result.darkVibrant);
        const lightVibrantCss = rgbToCss(result.lightVibrant);

        // Professional gradient with multiple stops for depth
        const gradient = `linear-gradient(180deg, ${primaryCss} 0%, ${rgbToCss(blend(result.bg, result.secondary, 0.3))} 50%, ${secondaryCss} 100%)`;

        const isLight = luminance(result.bg[0], result.bg[1], result.bg[2]) > 0.5;

        const cssVars: React.CSSProperties = {
          '--album-primary': primaryCss,
          '--album-primary-rgb': `${result.bg[0]}, ${result.bg[1]}, ${result.bg[2]}`,
          '--album-secondary': secondaryCss,
          '--album-text': result.text,
          '--album-overlay': result.overlay,
          '--album-accent': result.accent,
          '--album-gradient': gradient,
          '--album-vibrant': vibrantCss,
          '--album-muted': mutedCss,
          '--album-dark-vibrant': darkVibrantCss,
          '--album-light-vibrant': lightVibrantCss,
          '--album-hue': result.dominantHue.toString(),
          '--album-saturation': `${result.saturation}%`,
          '--album-brightness': `${result.brightness}%`,
        } as React.CSSProperties;

        const nextColors = {
          primary: primaryCss,
          secondary: secondaryCss,
          accent: result.accent,
          text: result.text,
          overlay: result.overlay,
          gradient,
          isLight,
          cssVars,
          vibrant: vibrantCss,
          muted: mutedCss,
          darkVibrant: darkVibrantCss,
          lightVibrant: lightVibrantCss,
          dominantHue: result.dominantHue,
          saturation: result.saturation,
          brightness: result.brightness,
        };

        albumColorsCache.set(cacheKey, nextColors);
        if (!isCancelled) {
          setColors(nextColors);
        }
      } catch (error) {
        // ColorThief failed, using fallback
      }
    };

    img.onerror = () => {
      // Keep default/previous colors
    };

    img.src = colorSourceUrl;

    return () => {
      isCancelled = true;
      img.onload = null;
      img.onerror = null;
    };
  }, [imageUrl, isLikedSongs]);

  return colors;
};
