import { Button } from "@/components/ui/button";
import { usePlayerStore } from "@/stores/usePlayerStore";
import { renderToStaticMarkup } from "react-dom/server";
import { type ReactElement, type ReactNode, type SVGProps, useCallback, useEffect, useReducer, useRef, useState } from "react";
import SongDetailsView from "@/components/SongDetailsView";
import { LikeButton } from "@/components/LikeButton";
import { ShuffleButton } from "@/components/ShuffleButton";
import { cn } from "@/lib/utils";
import { useLikedSongsStore } from "@/stores/useLikedSongsStore";
import QueueDrawer from "@/components/QueueDrawer";
import ElasticSlider from "@/components/ui/ElasticSlider";
import { usePlayerSync } from "@/hooks/usePlayerSync";
import { PingPongScroll } from "@/components/PingPongScroll";
import { toast } from "react-hot-toast";

const formatTime = (seconds: number) => {
	if (isNaN(seconds)) return "0:00";
	const minutes = Math.floor(seconds / 60);
	const remainingSeconds = Math.floor(seconds % 60);
	return `${minutes}:${remainingSeconds.toString().padStart(2, "0")}`;
};

const numberFormatter = new Intl.NumberFormat("en-US");
const formatNumber = (value: number) => {
	return numberFormatter.format(Math.max(0, Math.round(value)));
};

type MaterialIconProps = SVGProps<SVGSVGElement>;

const createMaterialIcon = (path: ReactNode) => {
	const MaterialIcon = ({ className, ...props }: MaterialIconProps) => (
		<svg
			className={className}
			focusable="false"
			aria-hidden="true"
			viewBox="0 0 24 24"
			fill="currentColor"
			{...props}
		>
			{path}
		</svg>
	);

	return MaterialIcon;
};

const AddCircleOutlineIcon = createMaterialIcon(
	<path d="M13 7h-2v4H7v2h4v4h2v-4h4v-2h-4V7Zm-1-5C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2Zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8Z" />
);
const CheckCircleOutlineIcon = createMaterialIcon(
	<path d="m10 14.17-3.59-3.58L5 12l5 5 8-8-1.41-1.42L10 14.17ZM12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2Zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8Z" />
);
const ChevronLeftIcon = createMaterialIcon(<path d="M15.41 7.41 14 6l-6 6 6 6 1.41-1.41L10.83 12l4.58-4.59Z" />);
const ChevronRightIcon = createMaterialIcon(<path d="M8.59 16.59 10 18l6-6-6-6-1.41 1.41L13.17 12l-4.58 4.59Z" />);
const CloseIcon = createMaterialIcon(<path d="M18.3 5.71 16.89 4.3 12 9.17 7.11 4.3 5.7 5.71 10.59 10.6 5.7 15.49l1.41 1.41L12 12.01l4.89 4.89 1.41-1.41-4.89-4.89 4.89-4.89Z" />);
const CloseFullscreenIcon = createMaterialIcon(<path d="M22 3.41 20.59 2 17 5.59V3h-2v6h6V7h-2.59L22 3.41ZM3.41 22 7 18.41V21h2v-6H3v2h2.59L2 20.59 3.41 22ZM2 3.41 5.59 7H3v2h6V3H7v2.59L3.41 2 2 3.41ZM20.59 22 22 20.59 18.41 17H21v-2h-6v6h2v-2.59L20.59 22Z" />);
const DeleteIcon = createMaterialIcon(<path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12ZM8 9h8v10H8V9Zm7.5-5-1-1h-5l-1 1H5v2h14V4h-3.5Z" />);
const IosShareIcon = createMaterialIcon(<path d="M16 5 12 1 8 5l1.41 1.41L11 4.83V16h2V4.83l1.59 1.59L16 5Zm4 5v11H4V10h2v9h12v-9h2Z" />);
const OpenInFullIcon = createMaterialIcon(<path d="M5 5h5V3H3v7h2V5Zm9-2v2h5v5h2V3h-7ZM5 14H3v7h7v-2H5v-5Zm14 5h-5v2h7v-7h-2v5Z" />);
const PauseIcon = createMaterialIcon(<path d="M6 19h4V5H6v14Zm8-14v14h4V5h-4Z" />);
const PictureInPictureAltIcon = createMaterialIcon(<path d="M19 11h-8v6h8v-6Zm4 8V4c0-1.1-.9-2-2-2H3c-1.1 0-2 .9-2 2v15c0 1.1.9 2 2 2h18c1.1 0 2-.9 2-2Zm-2 0H3V4h18v15Z" />);
const PlayArrowIcon = createMaterialIcon(<path d="M8 5v14l11-7L8 5Z" />);
const QueueMusicIcon = createMaterialIcon(<path d="M15 6H3v2h12V6Zm0 4H3v2h12v-2ZM3 16h8v-2H3v2Zm14-10v8.18c-.31-.11-.65-.18-1-.18-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3V8h3V6h-5Z" />);
const RepeatIcon = createMaterialIcon(<path d="M7 7h11v3l4-4-4-4v3H5v6h2V7Zm10 10H6v-3l-4 4 4 4v-3h13v-6h-2v4Z" />);
const ShuffleIcon = createMaterialIcon(<path d="M10.59 9.17 5.41 4 4 5.41l5.17 5.17 1.42-1.41ZM14.5 4l2.04 2.04L4 18.59 5.41 20 17.96 7.46 20 9.5V4h-5.5Zm.33 9.41-1.41 1.41 3.13 3.13L14.5 20H20v-5.5l-2.04 2.04-3.13-3.13Z" />);
const SkipNextIcon = createMaterialIcon(<path d="m6 18 8.5-6L6 6v12ZM16 6v12h2V6h-2Z" />);
const SkipPreviousIcon = createMaterialIcon(<path d="M6 6h2v12H6V6Zm3.5 6 8.5 6V6l-8.5 6Z" />);
const VolumeOffIcon = createMaterialIcon(<path d="M16.5 12c0-1.77-1-3.29-2.5-4.03v2.21l2.45 2.45c.03-.2.05-.41.05-.63ZM19 12c0 .94-.2 1.82-.54 2.64l1.51 1.51C20.62 14.91 21 13.5 21 12c0-4.28-2.99-7.86-7-8.77v2.06c2.89.86 5 3.54 5 6.71ZM4.27 3 3 4.27 7.73 9H3v6h4l5 5v-6.73L16.25 17.52c-.67.52-1.43.93-2.25 1.18v2.06c1.38-.31 2.63-.95 3.69-1.81L19.73 21 21 19.73l-9-9L4.27 3ZM12 4 9.91 6.09 12 8.18V4Z" />);
const VolumeUpIcon = createMaterialIcon(<path d="M3 9v6h4l5 5V4L7 9H3Zm13.5 3c0-1.77-1-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02ZM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77Z" />);

const getSeededRange = (seedText: string, min: number, max: number) => {
	if (!seedText) return min;
	let hash = 0;
	for (let i = 0; i < seedText.length; i += 1) {
		hash = (hash * 31 + seedText.charCodeAt(i)) >>> 0;
	}
	const normalized = hash / 4294967295;
	return Math.round(min + normalized * (max - min));
};

interface DocumentPictureInPictureApi {
	requestWindow: (options?: { width?: number; height?: number }) => Promise<Window>;
	window?: Window | null;
}

interface FullscreenUiState {
	isPlayerOpen: boolean;
	isQueueOpen: boolean;
	scrollY: number;
	hasDetailsUnlocked: boolean;
}

type FullscreenUiAction =
	| { type: "player_open"; value: boolean }
	| { type: "queue_open"; value: boolean }
	| { type: "toggle_queue" }
	| { type: "scroll"; value: number }
	| { type: "reset_details" }
	| { type: "reset" };

const initialFullscreenUiState: FullscreenUiState = {
	isPlayerOpen: false,
	isQueueOpen: false,
	scrollY: 0,
	hasDetailsUnlocked: false,
};

const fullscreenUiReducer = (state: FullscreenUiState, action: FullscreenUiAction): FullscreenUiState => {
	switch (action.type) {
		case "player_open":
			if (!action.value) return initialFullscreenUiState;
			return { ...state, isPlayerOpen: true, isQueueOpen: false };
		case "queue_open":
			return { ...state, isQueueOpen: state.isPlayerOpen && action.value };
		case "toggle_queue":
			return { ...state, isQueueOpen: state.isPlayerOpen ? !state.isQueueOpen : false };
		case "scroll":
			return {
				...state,
				scrollY: action.value,
				hasDetailsUnlocked: state.hasDetailsUnlocked || action.value > 18,
			};
		case "reset_details":
			return { ...state, hasDetailsUnlocked: false };
		case "reset":
			return initialFullscreenUiState;
		default:
			return state;
	}
};

interface PlaybackUiState {
	isTransitioning: boolean;
	showSongDetails: boolean;
	showQueue: boolean;
	isMiniPlayerOpen: boolean;
}

type PlaybackUiAction =
	| { type: "transitioning"; value: boolean }
	| { type: "song_details"; value: boolean }
	| { type: "queue"; value: boolean }
	| { type: "mini_player"; value: boolean };

const initialPlaybackUiState: PlaybackUiState = {
	isTransitioning: false,
	showSongDetails: false,
	showQueue: false,
	isMiniPlayerOpen: false,
};

const playbackUiReducer = (state: PlaybackUiState, action: PlaybackUiAction): PlaybackUiState => {
	switch (action.type) {
		case "transitioning":
			return { ...state, isTransitioning: action.value };
		case "song_details":
			return { ...state, showSongDetails: action.value };
		case "queue":
			return { ...state, showQueue: action.value };
		case "mini_player":
			return { ...state, isMiniPlayerOpen: action.value };
		default:
			return state;
	}
};

const miniIcon = (icon: ReactElement) => renderToStaticMarkup(icon);

const MINI_PREV_ICON = miniIcon(<SkipPreviousIcon className="mini-material-icon" aria-hidden="true" />);
const MINI_PLAY_ICON = miniIcon(<PlayArrowIcon className="mini-material-icon" aria-hidden="true" />);
const MINI_PAUSE_ICON = miniIcon(<PauseIcon className="mini-material-icon" aria-hidden="true" />);
const MINI_NEXT_ICON = miniIcon(<SkipNextIcon className="mini-material-icon" aria-hidden="true" />);
const MINI_SHUFFLE_ICON = miniIcon(<ShuffleIcon className="mini-material-icon mini-material-icon--sm" aria-hidden="true" />);
const MINI_QUEUE_ICON = miniIcon(<QueueMusicIcon className="mini-material-icon mini-material-icon--sm" aria-hidden="true" />);
const MINI_SHARE_ICON = miniIcon(<IosShareIcon className="mini-material-icon mini-material-icon--sm" aria-hidden="true" />);
const MINI_VOLUME_ICON = miniIcon(<VolumeUpIcon className="mini-material-icon mini-material-icon--sm" aria-hidden="true" />);
const MINI_VOLUME_MUTE_ICON = miniIcon(<VolumeOffIcon className="mini-material-icon mini-material-icon--sm" aria-hidden="true" />);
const MINI_PLUS_ICON = miniIcon(<AddCircleOutlineIcon className="mini-material-icon" aria-hidden="true" />);
const MINI_CHECK_ICON = miniIcon(<CheckCircleOutlineIcon className="mini-material-icon" aria-hidden="true" />);

const getDocumentPictureInPictureApi = (): DocumentPictureInPictureApi | null => {
	if (typeof window === "undefined") return null;
	const api = (window as any).documentPictureInPicture;
	if (!api || typeof api.requestWindow !== "function") {
		return null;
	}
	return api as DocumentPictureInPictureApi;
};

const getActiveFullscreenElement = (): Element | null => {
	if (typeof document === "undefined") return null;
	const doc = document as any;
	return document.fullscreenElement || doc.webkitFullscreenElement || null;
};

const requestElementFullscreen = async (target: HTMLElement): Promise<void> => {
	const element = target as any;
	if (typeof element.requestFullscreen === "function") {
		await element.requestFullscreen();
		return;
	}
	if (typeof element.webkitRequestFullscreen === "function") {
		await element.webkitRequestFullscreen();
		return;
	}
	throw new Error("Fullscreen API is not supported.");
};

const exitElementFullscreen = async (): Promise<void> => {
	const doc = document as any;
	if (typeof document.exitFullscreen === "function") {
		await document.exitFullscreen();
		return;
	}
	if (typeof doc.webkitExitFullscreen === "function") {
		await doc.webkitExitFullscreen();
		return;
	}
};

const clampUnit = (value: number) => Math.min(1, Math.max(0, value));

const parseColorToRgb = (colorValue: string): [number, number, number] | null => {
	const color = colorValue.trim();
	if (!color) return null;

	if (color.startsWith("#")) {
		const hex = color.slice(1);
		if (hex.length === 3) {
			const r = parseInt(hex[0] + hex[0], 16);
			const g = parseInt(hex[1] + hex[1], 16);
			const b = parseInt(hex[2] + hex[2], 16);
			if ([r, g, b].some(Number.isNaN)) return null;
			return [r, g, b];
		}
		if (hex.length === 6) {
			const r = parseInt(hex.slice(0, 2), 16);
			const g = parseInt(hex.slice(2, 4), 16);
			const b = parseInt(hex.slice(4, 6), 16);
			if ([r, g, b].some(Number.isNaN)) return null;
			return [r, g, b];
		}
	}

	const rgbMatch = color.match(/rgba?\(([^)]+)\)/i);
	if (!rgbMatch) return null;
	const parts = rgbMatch[1].split(",").map(part => Number(part.trim()));
	if (parts.length < 3 || parts.slice(0, 3).some(Number.isNaN)) return null;
	return [
		Math.round(Math.max(0, Math.min(255, parts[0]))),
		Math.round(Math.max(0, Math.min(255, parts[1]))),
		Math.round(Math.max(0, Math.min(255, parts[2]))),
	];
};

const rgbToLuminance = (r: number, g: number, b: number) => {
	const normalize = (value: number) => {
		const channel = value / 255;
		return channel <= 0.03928 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
	};
	return 0.2126 * normalize(r) + 0.7152 * normalize(g) + 0.0722 * normalize(b);
};

const getPrimaryThemeLuminance = () => {
	if (typeof window === "undefined") return 0.45;
	const raw = getComputedStyle(document.documentElement).getPropertyValue("--player-primary");
	const rgb = parseColorToRgb(raw);
	if (!rgb) return 0.45;
	return rgbToLuminance(rgb[0], rgb[1], rgb[2]);
};

const getPlayerSecondaryRgb = (): [number, number, number] => {
	if (typeof window === "undefined") return [16, 16, 22];
	const raw = getComputedStyle(document.documentElement).getPropertyValue("--player-secondary");
	return parseColorToRgb(raw) || [16, 16, 22];
};

const mixRgb = (from: [number, number, number], to: [number, number, number], t: number): [number, number, number] => {
	const ratio = clampUnit(t);
	return [
		Math.round(from[0] + (to[0] - from[0]) * ratio),
		Math.round(from[1] + (to[1] - from[1]) * ratio),
		Math.round(from[2] + (to[2] - from[2]) * ratio),
	];
};

const rgbToCss = ([r, g, b]: [number, number, number]) => `rgb(${r} ${g} ${b})`;

// eslint-disable-next-line react-doctor/no-giant-component
export const PlaybackControls = () => {
	const { togglePlay, playNext, playPrevious, playAlbum, removeFromQueue, seekTo, toggleRepeat, setVolume } = usePlayerStore();
	const { isPlaying, currentSong } = usePlayerSync();
	const { likedSongIds, toggleLikeSong } = useLikedSongsStore();
	const shuffleMode = usePlayerStore(state => state.shuffleMode);
	const queue = usePlayerStore(state => state.queue);
	const currentIndex = usePlayerStore(state => state.currentIndex);
	const currentTime = usePlayerStore(state => state.currentTime);
	const duration = usePlayerStore(state => state.duration);
	const volume = usePlayerStore(state => state.volume);
	const isRepeating = usePlayerStore(state => state.isRepeating);

	const [playbackUi, dispatchPlaybackUi] = useReducer(playbackUiReducer, initialPlaybackUiState);
	const [isLiked, setIsLiked] = useState(false);
	const [fullscreenUi, dispatchFullscreenUi] = useReducer(fullscreenUiReducer, initialFullscreenUiState);
	const [fullscreenArtworkTheme, setFullscreenArtworkTheme] = useState<{
		luminance: number;
		secondaryRgb: [number, number, number];
	}>({
		luminance: 0.45,
		secondaryRgb: [16, 16, 22],
	});
	const playerRef = useRef<HTMLDivElement>(null);
	const miniPlayerWindowRef = useRef<Window | null>(null);
	const fullscreenScrollContainerRef = useRef<HTMLDivElement | null>(null);
	const fullscreenRelatedSliderRef = useRef<HTMLDivElement | null>(null);
	const lastFullscreenScrollYRef = useRef(0);
	const fullscreenUpcomingSongs = queue.slice(currentIndex + 1);
	const {
		isTransitioning,
		showSongDetails,
		showQueue,
		isMiniPlayerOpen,
	} = playbackUi;
	const {
		isPlayerOpen: isFullscreenPlayerOpen,
		isQueueOpen: isFullscreenQueueOpen,
		scrollY: fullscreenScrollY,
	} = fullscreenUi;
	const fullscreenArtworkLuminance = fullscreenArtworkTheme.luminance;
	const fullscreenSecondaryRgb = fullscreenArtworkTheme.secondaryRgb;
	const fullscreenRelatedSongs = queue
		.reduce<{ song: any; index: number }[]>((acc, song, index) => {
			if (!song) return acc;
			const isCurrent = index === currentIndex || song._id === currentSong?._id;
			if (!isCurrent) acc.push({ song, index });
			return acc;
		}, [])
		.slice(0, 24);
	const artistNames = (currentSong?.artist || "")
		.split(",")
		.flatMap(name => {
			const trimmed = name.trim();
			return trimmed ? [trimmed] : [];
		});
	const primaryArtist = artistNames[0] || currentSong?.artist || "Unknown Artist";
	const creditArtists = Array.from(new Set([
		primaryArtist,
		...artistNames.slice(1),
		...fullscreenRelatedSongs.flatMap(({ song }) => (song.artist || "").split(",").flatMap(name => {
			const trimmed = name.trim();
			return trimmed ? [trimmed] : [];
		})),
	])).slice(0, 4);
	const artistMonthlyListeners = getSeededRange(primaryArtist, 1800000, 92000000);
	const nextQueueSong = fullscreenUpcomingSongs[0] || null;
	const fullscreenHeroProgress = clampUnit(fullscreenScrollY / 360);
	const fullscreenTopShadeProgressLinear = clampUnit((fullscreenScrollY - 12) / 180);
	const fullscreenTopShadeOpacity = fullscreenTopShadeProgressLinear * fullscreenTopShadeProgressLinear * (3 - 2 * fullscreenTopShadeProgressLinear);
	const useDarkFullscreenControls = fullscreenTopShadeOpacity < 0.22 && fullscreenArtworkLuminance > 0.58;
	const fullscreenTopShadeStrong = (0.98 * fullscreenTopShadeOpacity).toFixed(4);
	const fullscreenTopShadeMid = (0.66 * fullscreenTopShadeOpacity).toFixed(4);
	const fullscreenTopShadeSoft = (0.22 * fullscreenTopShadeOpacity).toFixed(4);
	const fullscreenBgTop = fullscreenSecondaryRgb;
	const fullscreenBgMid = mixRgb(fullscreenSecondaryRgb, [0, 0, 0], 0.14);
	const fullscreenBgBottom = mixRgb(fullscreenSecondaryRgb, [0, 0, 0], 0.3);
	const fullscreenBgTopCss = rgbToCss(fullscreenBgTop);
	const fullscreenBgMidCss = rgbToCss(fullscreenBgMid);
	const fullscreenBgBottomCss = rgbToCss(fullscreenBgBottom);
	const fullscreenBaseBackgroundStyle = {
		background: `linear-gradient(180deg, ${fullscreenBgTopCss} 0%, ${fullscreenBgTopCss} 62%, ${fullscreenBgMidCss} 84%, ${fullscreenBgBottomCss} 100%)`,
		transform: "translateZ(0)",
		backfaceVisibility: "hidden",
		WebkitBackfaceVisibility: "hidden",
	} as const;
	const fullscreenTopShadeStyle = {
		background: `linear-gradient(180deg, rgba(0,0,0,${fullscreenTopShadeStrong}) 0%, rgba(0,0,0,${fullscreenTopShadeMid}) 38%, rgba(0,0,0,${fullscreenTopShadeSoft}) 78%, rgba(0,0,0,0) 100%)`,
		transform: "translateZ(0)",
		backfaceVisibility: "hidden",
		WebkitBackfaceVisibility: "hidden",
	} as const;
	const fullscreenTopControlsStyle = {
		backgroundColor: "transparent",
		transition: "background-color 420ms cubic-bezier(0.22,1,0.36,1)",
	} as const;
	const fullscreenDetailsStyle = {
		opacity: 1,
		transform: "translate3d(0, 0, 0)",
		filter: "saturate(1)",
	} as const;
	const fullscreenSurfaceStyle = {
		background: "rgba(20, 20, 28, 0.5)",
		backdropFilter: "blur(12px)",
		WebkitBackdropFilter: "blur(12px)",
	} as const;

	// Desktop seek helper for custom progress bar
	const seekToPosition = (newTime: number) => {
		if (isNaN(newTime)) return;
		seekTo(Math.max(0, Math.min(newTime, isNaN(duration) ? 0 : duration)));
	};

	const applyFullscreenArtworkTheme = useCallback((luminance: number, secondaryRgb: [number, number, number]) => {
		setFullscreenArtworkTheme({ luminance, secondaryRgb });
	}, []);

	// Get liked state from the liked songs store if possible
	useEffect(() => {
		if (!currentSong) return;

		const id = (currentSong as any).id;
		const _id = currentSong._id;
		const isCurrentSongLiked = (id && likedSongIds?.has(id)) || (_id && likedSongIds?.has(_id));

		setIsLiked(!!isCurrentSongLiked);
	}, [currentSong, likedSongIds]);

	useEffect(() => {
		let isCancelled = false;
		const fallbackLuminance = getPrimaryThemeLuminance();
		const fallbackSecondary = getPlayerSecondaryRgb();
		applyFullscreenArtworkTheme(fallbackLuminance, fallbackSecondary);

		if (!currentSong?.imageUrl || typeof window === "undefined") {
			return () => {
				isCancelled = true;
			};
		}

		const image = new Image();
		image.crossOrigin = "anonymous";
		image.referrerPolicy = "no-referrer";
		image.decoding = "async";

		image.onload = () => {
			if (isCancelled) return;

			try {
				const sampleSize = 28;
				const canvas = document.createElement("canvas");
				canvas.width = sampleSize;
				canvas.height = sampleSize;
				const context = canvas.getContext("2d", { willReadFrequently: true });
				if (!context) {
					applyFullscreenArtworkTheme(fallbackLuminance, fallbackSecondary);
					return;
				}

				context.drawImage(image, 0, 0, sampleSize, sampleSize);
				const { data } = context.getImageData(0, 0, sampleSize, sampleSize);
				let luminanceSum = 0;
				let redSum = 0;
				let greenSum = 0;
				let blueSum = 0;
				let samples = 0;

				for (let y = 0; y < sampleSize; y += 2) {
					for (let x = 0; x < sampleSize; x += 2) {
						const index = (y * sampleSize + x) * 4;
						const alpha = data[index + 3] / 255;
						if (alpha < 0.05) continue;

						const r = data[index];
						const g = data[index + 1];
						const b = data[index + 2];
						luminanceSum += rgbToLuminance(r, g, b);
						redSum += r;
						greenSum += g;
						blueSum += b;
						samples += 1;
					}
				}

				if (!samples) {
					applyFullscreenArtworkTheme(fallbackLuminance, fallbackSecondary);
					return;
				}

				const sampledRgb: [number, number, number] = [
					Math.round(redSum / samples),
					Math.round(greenSum / samples),
					Math.round(blueSum / samples),
				];
				applyFullscreenArtworkTheme(clampUnit(luminanceSum / samples), sampledRgb);
			} catch {
				applyFullscreenArtworkTheme(fallbackLuminance, fallbackSecondary);
			}
		};

		image.onerror = () => {
			if (!isCancelled) {
				applyFullscreenArtworkTheme(fallbackLuminance, fallbackSecondary);
			}
		};

		image.src = currentSong.imageUrl;

		return () => {
			isCancelled = true;
		};
	}, [currentSong?.imageUrl, applyFullscreenArtworkTheme]);

	// Listen for like updates from other components
	useEffect(() => {
		const handleLikeUpdate = (e: Event) => {
			if (!currentSong) return;

			const songId = (currentSong as any).id || currentSong._id;

			// Check if this event includes details about which song was updated
			if (e instanceof CustomEvent && e.detail) {
				// If we have details and it's not for our current song, ignore
				if (e.detail.songId && e.detail.songId !== songId) {
					return;
				}

				// If we have explicit like state in the event, use it
				if (typeof e.detail.isLiked === 'boolean') {
					setIsLiked(e.detail.isLiked);
					return;
				}
			}

			// Otherwise do a fresh check from the store
			const freshCheck = songId ? likedSongIds?.has(songId) : false;
			setIsLiked(freshCheck);
		};

		document.addEventListener('likedSongsUpdated', handleLikeUpdate);
		document.addEventListener('songLikeStateChanged', handleLikeUpdate);

		return () => {
			document.removeEventListener('likedSongsUpdated', handleLikeUpdate);
			document.removeEventListener('songLikeStateChanged', handleLikeUpdate);
		};
	}, [currentSong, likedSongIds]);

	// Smooth song changes and handle navigation
	useEffect(() => {
		if (currentSong) {
			dispatchPlaybackUi({ type: "transitioning", value: true });
			// Use requestAnimationFrame instead of setTimeout to avoid performance violations
			const animationId = requestAnimationFrame(() => {
				requestAnimationFrame(() => {
					dispatchPlaybackUi({ type: "transitioning", value: false });
				});
			});
			return () => cancelAnimationFrame(animationId);
		}
	}, [currentSong]);

	// Fix for layout issues after navigation
	useEffect(() => {
		const handleFocus = () => {
			if (playerRef.current) {
				playerRef.current.style.display = 'none';
				void playerRef.current.offsetHeight;
				playerRef.current.style.display = '';
			}
		};

		window.addEventListener('focus', handleFocus);
		window.addEventListener('pageshow', handleFocus);

		return () => {
			window.removeEventListener('focus', handleFocus);
			window.removeEventListener('pageshow', handleFocus);
		};
	}, []);

	const closeMiniPlayer = useCallback(() => {
		const miniPlayerWindow = miniPlayerWindowRef.current;
		if (miniPlayerWindow && !miniPlayerWindow.closed) {
			miniPlayerWindow.close();
		}
		miniPlayerWindowRef.current = null;
		dispatchPlaybackUi({ type: "mini_player", value: false });
	}, []);

	const toggleFullscreenPlayer = useCallback(async () => {
		try {
			if (getActiveFullscreenElement()) {
				await exitElementFullscreen();
				dispatchFullscreenUi({ type: "reset" });
				return;
			}

			dispatchFullscreenUi({ type: "queue_open", value: false });
			await requestElementFullscreen(document.documentElement);
			dispatchFullscreenUi({ type: "player_open", value: true });
		} catch (_error) {
			dispatchFullscreenUi({ type: "reset" });
			toast.error("Fullscreen was blocked by the browser.");
		}
	}, []);

	const toggleFullscreenQueue = useCallback(() => {
		if (!isFullscreenPlayerOpen) return;
		dispatchFullscreenUi({ type: "toggle_queue" });
	}, [isFullscreenPlayerOpen]);

	const handleFullscreenScroll = useCallback((event: React.UIEvent<HTMLDivElement>) => {
		const nextScrollTop = event.currentTarget.scrollTop || 0;
		dispatchFullscreenUi({ type: "scroll", value: nextScrollTop });
		lastFullscreenScrollYRef.current = nextScrollTop;
	}, []);

	const scrollFullscreenRelated = useCallback((direction: "left" | "right") => {
		const track = fullscreenRelatedSliderRef.current;
		if (!track) return;
		const step = Math.max(260, Math.round(track.clientWidth * 0.72));
		track.scrollBy({
			left: direction === "right" ? step : -step,
			behavior: "smooth",
		});
	}, []);

	const playSongFromFullscreenQueue = useCallback((queueIndex: number) => {
		if (!queue.length) return;
		playAlbum(queue, queueIndex);
	}, [playAlbum, queue]);

	const removeSongFromFullscreenQueue = useCallback((queueIndex: number) => {
		removeFromQueue(queueIndex);
	}, [removeFromQueue]);

	const updateMiniPlayerContent = useCallback(() => {
		const miniPlayerWindow = miniPlayerWindowRef.current;
		if (!miniPlayerWindow || miniPlayerWindow.closed) {
			return;
		}

		const doc = miniPlayerWindow.document;
		const titleEl = doc.getElementById("mini-title");
		const artistEl = doc.getElementById("mini-artist");
		const coverEl = doc.getElementById("mini-cover") as HTMLImageElement | null;
		const playBtn = doc.getElementById("mini-play");
		const likeBtn = doc.getElementById("mini-like");
		const shuffleBtn = doc.getElementById("mini-shuffle");
		const volumeBtn = doc.getElementById("mini-volume");
		const progressFill = doc.getElementById("mini-progress-fill");
		const currentTimeEl = doc.getElementById("mini-time-current");
		const durationEl = doc.getElementById("mini-time-duration");

		const songTitle = currentSong?.title || "No song selected";
		const songArtist = currentSong?.artist || "Play something in Mavrixfy";
		const imageUrl = currentSong?.imageUrl || "https://cdn.iconscout.com/icon/free/png-256/free-music-1779799-1513951.png";
		const safeDuration = Number.isFinite(duration) && duration > 0 ? duration : 0;
		const safeCurrent = Number.isFinite(currentTime) && currentTime >= 0 ? Math.min(currentTime, safeDuration || currentTime) : 0;
		const progressPct = safeDuration > 0 ? (safeCurrent / safeDuration) * 100 : 0;
		const isAudioMuted = volume <= 0;

		if (titleEl) titleEl.textContent = songTitle;
		if (artistEl) artistEl.textContent = songArtist;
		if (coverEl && coverEl.src !== imageUrl) coverEl.src = imageUrl;
		if (playBtn) playBtn.innerHTML = isPlaying ? MINI_PAUSE_ICON : MINI_PLAY_ICON;
		if (likeBtn) {
			likeBtn.innerHTML = isLiked ? MINI_CHECK_ICON : MINI_PLUS_ICON;
			likeBtn.classList.toggle("active", isLiked);
		}
		if (shuffleBtn) {
			shuffleBtn.classList.toggle("active", shuffleMode !== "off");
		}
		if (volumeBtn) {
			volumeBtn.innerHTML = isAudioMuted ? MINI_VOLUME_MUTE_ICON : MINI_VOLUME_ICON;
			volumeBtn.classList.toggle("active", !isAudioMuted);
		}
		if (progressFill) {
			(progressFill as HTMLElement).style.width = `${progressPct || 0}%`;
		}
		if (currentTimeEl) currentTimeEl.textContent = formatTime(safeCurrent);
		if (durationEl) durationEl.textContent = formatTime(safeDuration);

		doc.title = `${songTitle} - ${songArtist}`;
	}, [
		currentSong?.title,
		currentSong?.artist,
		currentSong?.imageUrl,
		currentTime,
		duration,
		volume,
		isPlaying,
		isLiked,
		shuffleMode
	]);

	const createMiniPlayerDocument = useCallback((miniWindow: Window) => {
		const doc = miniWindow.document;
		doc.head.innerHTML = "";
		doc.body.innerHTML = "";
		doc.body.style.margin = "0";
		doc.body.className = "mini-root";

		const style = doc.createElement("style");
		style.textContent = `
			* { box-sizing: border-box; }
			html, body {
				margin: 0;
				width: 100%;
				height: 100%;
				overflow: hidden;
			}
			body.mini-root {
				--ui-scale: 1;
				--space-1: calc(4px * var(--ui-scale));
				--space-2: calc(6px * var(--ui-scale));
				--space-3: calc(8px * var(--ui-scale));
				--space-4: calc(10px * var(--ui-scale));
				--radius: calc(12px * var(--ui-scale));
				margin: 0;
				padding: var(--space-1);
				background: #070709;
				color: #f4f4f5;
				font-family: ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif;
				width: 100%;
				height: 100%;
				overflow: hidden;
			}
			.mini-shell {
				width: 100%;
				height: 100%;
				min-height: 0;
				display: flex;
				flex-direction: column;
				border-radius: var(--radius);
				overflow: hidden;
				background: linear-gradient(180deg, rgba(24,24,27,0.98), rgba(10,10,12,0.98));
				border: 1px solid rgba(255,255,255,0.09);
				box-shadow: 0 16px 32px rgba(0,0,0,0.42);
			}
			.cover-wrap {
				width: 100%;
				flex: 1 1 auto;
				min-height: 0;
				overflow: hidden;
				background: #141417;
				position: relative;
			}
			.cover-wrap img {
				width: 100%;
				height: 100%;
				object-fit: cover;
				display: block;
			}
			.cover-overlay {
				position: absolute;
				inset: 0;
				display: flex;
				flex-direction: column;
				justify-content: flex-end;
				padding: var(--space-3);
				background: linear-gradient(180deg, rgba(0,0,0,0.02) 25%, rgba(0,0,0,0.68) 100%);
				opacity: 0;
				pointer-events: none;
				transition: opacity 0.18s ease;
			}
			body.mini-root:hover .cover-overlay {
				opacity: 1;
				pointer-events: auto;
			}
			body.mini-root[data-layout="compact"] .cover-overlay {
				opacity: 1;
				pointer-events: auto;
			}
			.tool-row {
				display: flex;
				align-items: center;
				justify-content: center;
				gap: var(--space-2);
				background: rgba(13,13,16,0.85);
				border: 1px solid rgba(255,255,255,0.12);
				border-radius: 999px;
				padding: var(--space-1) var(--space-2);
				backdrop-filter: blur(3px);
			}
			.meta {
				min-width: 0;
				flex: 0 0 auto;
				padding: var(--space-3) var(--space-3) calc(9px * var(--ui-scale));
				background: rgba(8,8,10,0.94);
				border-top: 1px solid rgba(255,255,255,0.08);
			}
			.icon-btn {
				min-height: calc(34px * var(--ui-scale));
				padding: 0;
				background: transparent;
				border: none;
				width: calc(28px * var(--ui-scale));
				height: calc(28px * var(--ui-scale));
				border-radius: 999px;
				color: rgba(255,255,255,0.95);
				display: inline-flex;
				align-items: center;
				justify-content: center;
				cursor: pointer;
			}
			.icon-btn:hover {
				background: rgba(255,255,255,0.12);
			}
			.icon-btn.primary {
				width: calc(42px * var(--ui-scale));
				height: calc(42px * var(--ui-scale));
				background: #fff;
				color: #111;
				box-shadow: 0 8px 18px rgba(0,0,0,0.35);
			}
			.icon-btn.active {
				color: #1ed760;
			}
			.mini-material-icon {
				width: 18px;
				height: 18px;
				font-size: 18px;
				fill: currentColor;
				display: block;
				flex-shrink: 0;
			}
			.mini-material-icon--sm {
				width: 16px;
				height: 16px;
				font-size: 16px;
			}
			.progress-wrap {
				margin-top: var(--space-2);
				display: flex;
				flex-direction: column;
				gap: 3px;
			}
			.progress-track {
				height: 3px;
				border-radius: 999px;
				background: rgba(255,255,255,0.28);
				position: relative;
				overflow: hidden;
				cursor: pointer;
			}
			.progress-fill {
				position: absolute;
				inset: 0 auto 0 0;
				height: 100%;
				width: 0;
				background: #fff;
			}
			.time-row {
				display: flex;
				justify-content: space-between;
				font-size: calc(11px * var(--ui-scale));
				color: rgba(255,255,255,0.86);
				font-variant-numeric: tabular-nums;
			}
			.open-main {
				cursor: pointer;
			}
			.meta-row {
				display: flex;
				align-items: center;
				gap: var(--space-3);
			}
			.meta-text {
				min-width: 0;
				flex: 1;
			}
			.title {
				margin: 0;
				font-size: calc(15px * var(--ui-scale));
				font-weight: 800;
				line-height: 1.2;
				white-space: nowrap;
				overflow: hidden;
				text-overflow: ellipsis;
			}
			.artist {
				margin: calc(4px * var(--ui-scale)) 0 0;
				font-size: calc(12px * var(--ui-scale));
				color: rgba(244,244,245,0.7);
				white-space: nowrap;
				overflow: hidden;
				text-overflow: ellipsis;
			}
			.mini-like {
				width: calc(30px * var(--ui-scale));
				height: calc(30px * var(--ui-scale));
				border-radius: 999px;
				border: 1px solid rgba(255,255,255,0.22);
				background: rgba(255,255,255,0.05);
				color: rgba(255,255,255,0.9);
				display: flex;
				align-items: center;
				justify-content: center;
				cursor: pointer;
				flex-shrink: 0;
			}
			.mini-like.active {
				color: #1ed760;
				border-color: rgba(30,215,96,0.7);
				background: rgba(30,215,96,0.14);
			}
			body.mini-root[data-layout="wide"] .mini-shell {
				display: grid;
				grid-template-columns: minmax(0, 1fr) minmax(130px, 46%);
				grid-template-rows: minmax(0, 1fr);
			}
			body.mini-root[data-layout="wide"] .meta {
				border-top: 0;
				border-left: 1px solid rgba(255,255,255,0.08);
				display: flex;
				align-items: center;
				padding: var(--space-3);
			}
			body.mini-root[data-layout="wide"] .meta-row {
				width: 100%;
			}
			body.mini-root[data-layout="wide"] .title,
			body.mini-root[data-layout="wide"] .artist {
				white-space: nowrap;
				text-overflow: ellipsis;
				overflow: hidden;
			}
			body.mini-root[data-layout="compact"] .optional-control,
			body.mini-root[data-layout="compact"] .mini-like {
				display: none;
			}
			body.mini-root[data-layout="compact"] .progress-wrap {
				display: none;
			}
			body.mini-root[data-layout="compact"] .tool-row {
				padding: calc(2px * var(--ui-scale)) var(--space-1);
				gap: calc(2px * var(--ui-scale));
			}
			body.mini-root[data-layout="compact"] .icon-btn {
				width: calc(24px * var(--ui-scale));
				height: calc(24px * var(--ui-scale));
			}
			body.mini-root[data-layout="compact"] .icon-btn.primary {
				width: calc(32px * var(--ui-scale));
				height: calc(32px * var(--ui-scale));
			}
			body.mini-root[data-layout="compact"] .meta {
				padding: calc(6px * var(--ui-scale)) var(--space-2) calc(7px * var(--ui-scale));
			}
			body.mini-root[data-layout="compact"] .title {
				font-size: calc(12px * var(--ui-scale));
			}
			body.mini-root[data-layout="compact"] .artist {
				font-size: calc(10px * var(--ui-scale));
			}
		`;
		doc.head.appendChild(style);

		doc.body.innerHTML = `
			<div class="mini-shell">
				<div class="cover-wrap">
					<img id="mini-cover" class="open-main" alt="Current track cover" src="https://cdn.iconscout.com/icon/free/png-256/free-music-1779799-1513951.png" />
					<div class="cover-overlay">
						<div class="tool-row">
							<button id="mini-shuffle" class="icon-btn optional-control" type="button" title="Shuffle">${MINI_SHUFFLE_ICON}</button>
							<button id="mini-prev" class="icon-btn" type="button" title="Previous">${MINI_PREV_ICON}</button>
							<button id="mini-play" class="icon-btn primary" type="button" title="Play/Pause">${MINI_PLAY_ICON}</button>
							<button id="mini-next" class="icon-btn" type="button" title="Next">${MINI_NEXT_ICON}</button>
							<button id="mini-queue" class="icon-btn optional-control" type="button" title="Queue">${MINI_QUEUE_ICON}</button>
							<button id="mini-share" class="icon-btn optional-control" type="button" title="Share">${MINI_SHARE_ICON}</button>
						</div>
						<div class="progress-wrap">
							<div id="mini-progress-track" class="progress-track" title="Seek">
								<div id="mini-progress-fill" class="progress-fill"></div>
							</div>
							<div class="time-row">
								<span id="mini-time-current">0:00</span>
								<span id="mini-time-duration">0:00</span>
							</div>
						</div>
					</div>
				</div>
				<div class="meta">
					<div class="meta-row">
						<div class="meta-text">
							<h2 id="mini-title" class="title open-main">No song selected</h2>
							<p id="mini-artist" class="artist open-main">Play something in Mavrixfy</p>
						</div>
						<button id="mini-like" class="mini-like" type="button" title="Like">${MINI_PLUS_ICON}</button>
					</div>
				</div>
			</div>
		`;

		const coverEl = doc.getElementById("mini-cover");
		const titleMainEl = doc.getElementById("mini-title");
		const artistMainEl = doc.getElementById("mini-artist");
		const prevBtn = doc.getElementById("mini-prev");
		const playBtn = doc.getElementById("mini-play");
		const nextBtn = doc.getElementById("mini-next");
		const shuffleBtn = doc.getElementById("mini-shuffle");
		const queueBtn = doc.getElementById("mini-queue");
		const shareBtn = doc.getElementById("mini-share");
		const likeBtn = doc.getElementById("mini-like");
		const progressTrack = doc.getElementById("mini-progress-track");

		const focusMainPlayer = () => {
			window.focus();
		};
		coverEl?.addEventListener("click", focusMainPlayer);
		titleMainEl?.addEventListener("click", focusMainPlayer);
		artistMainEl?.addEventListener("click", focusMainPlayer);

		const syncMiniLayout = () => {
			const width = Math.max(miniWindow.innerWidth || 0, doc.documentElement.clientWidth || 0);
			const height = Math.max(miniWindow.innerHeight || 0, doc.documentElement.clientHeight || 0);
			const shortestEdge = Math.max(160, Math.min(width, height));
			const scale = Math.max(0.62, Math.min(1.02, shortestEdge / 320));
			doc.body.style.setProperty("--ui-scale", scale.toFixed(3));

			let layout: "card" | "wide" | "compact" = "card";
			if (width >= height * 1.4 && height <= 255) {
				layout = "wide";
			} else if (width <= 235 || height <= 190) {
				layout = "compact";
			}
			doc.body.dataset.layout = layout;
		};

		syncMiniLayout();
		miniWindow.addEventListener("resize", syncMiniLayout);
		miniWindow.addEventListener("pagehide", () => {
			miniWindow.removeEventListener("resize", syncMiniLayout);
		}, { once: true });

		prevBtn?.addEventListener("click", () => {
			const store = usePlayerStore.getState();
			store.setUserInteracted?.();
			store.playPrevious?.();
		});

		playBtn?.addEventListener("click", () => {
			const store = usePlayerStore.getState();
			store.setUserInteracted?.();
			store.togglePlay?.();
		});

		nextBtn?.addEventListener("click", () => {
			const store = usePlayerStore.getState();
			store.setUserInteracted?.();
			store.playNext?.();
		});

		shuffleBtn?.addEventListener("click", () => {
			const store = usePlayerStore.getState();
			store.toggleShuffle?.();
		});

		queueBtn?.addEventListener("click", () => {
			window.dispatchEvent(new Event('toggleQueue'));
			window.focus();
		});

		shareBtn?.addEventListener("click", async () => {
			try {
				const song = usePlayerStore.getState().currentSong;
				if (!song) return;
				const shareText = `${song.title} - ${song.artist} | Mavrixfy`;
				await navigator.clipboard.writeText(shareText);
				toast.success('Track copied to clipboard');
			} catch (_error) {
				toast.error('Unable to copy track');
			}
		});

		likeBtn?.addEventListener("click", () => {
			const song = usePlayerStore.getState().currentSong;
			if (!song) return;
			toggleLikeSong(song);
		});

		progressTrack?.addEventListener("click", (event) => {
			const effectiveDuration = Number.isFinite(duration) && duration > 0 ? duration : 0;
			if (!effectiveDuration || effectiveDuration <= 0) return;
			const rect = (event.currentTarget as HTMLElement).getBoundingClientRect();
			const offsetX = event.clientX - rect.left;
			const ratio = Math.max(0, Math.min(1, offsetX / rect.width));
			seekTo(ratio * effectiveDuration);
		});
	}, [duration, seekTo, toggleLikeSong]);

	const toggleMiniPlayer = useCallback(async () => {
		if (miniPlayerWindowRef.current && !miniPlayerWindowRef.current.closed) {
			closeMiniPlayer();
			return;
		}

		const pipApi = getDocumentPictureInPictureApi();
		if (!pipApi) {
			toast.error("Mini player is supported in Chrome/Edge desktop browsers.");
			return;
		}

		try {
			const miniWindow = await pipApi.requestWindow({
				width: 320,
				height: 370,
			});

			miniPlayerWindowRef.current = miniWindow;
			dispatchPlaybackUi({ type: "mini_player", value: true });
			createMiniPlayerDocument(miniWindow);
			updateMiniPlayerContent();

			miniWindow.addEventListener("pagehide", () => {
				miniPlayerWindowRef.current = null;
				dispatchPlaybackUi({ type: "mini_player", value: false });
			}, { once: true });
		} catch (error) {
			const domError = error as DOMException | null;
			if (domError?.name === "NotAllowedError") {
				toast.error("Mini player blocked by browser. Try clicking Mini once again.");
			} else {
				toast.error("Unable to open mini player.");
			}
		}
	}, [closeMiniPlayer, createMiniPlayerDocument, updateMiniPlayerContent]);

	useEffect(() => {
		updateMiniPlayerContent();
	}, [updateMiniPlayerContent]);

	useEffect(() => {
		if (currentSong) return;
		closeMiniPlayer();
	}, [currentSong, closeMiniPlayer]);

	useEffect(() => {
		if (currentSong) return;
		dispatchFullscreenUi({ type: "reset" });
		lastFullscreenScrollYRef.current = 0;
		if (getActiveFullscreenElement()) {
			void exitElementFullscreen().catch(() => { });
		}
	}, [currentSong]);

	useEffect(() => {
		if (!isFullscreenPlayerOpen) {
			dispatchFullscreenUi({ type: "reset" });
			lastFullscreenScrollYRef.current = 0;
		}
	}, [isFullscreenPlayerOpen]);

	useEffect(() => {
		if (!isFullscreenPlayerOpen) return;
		dispatchFullscreenUi({ type: "reset_details" });
		const frame = window.requestAnimationFrame(() => {
			if (!fullscreenScrollContainerRef.current) return;
			fullscreenScrollContainerRef.current.scrollTop = 0;
		});
		return () => {
			window.cancelAnimationFrame(frame);
		};
	}, [isFullscreenPlayerOpen, currentSong?._id]);

	useEffect(() => {
		const syncFullscreenState = () => {
			dispatchFullscreenUi({ type: "player_open", value: Boolean(getActiveFullscreenElement()) });
		};

		document.addEventListener("fullscreenchange", syncFullscreenState);
		document.addEventListener("webkitfullscreenchange", syncFullscreenState as EventListener);

		return () => {
			document.removeEventListener("fullscreenchange", syncFullscreenState);
			document.removeEventListener("webkitfullscreenchange", syncFullscreenState as EventListener);
		};
	}, []);

	useEffect(() => {
		if (!isFullscreenPlayerOpen) return;

		const handleKeyDown = (event: KeyboardEvent) => {
			if (event.key === "Escape") {
				dispatchFullscreenUi({ type: "reset" });
			}
		};

		window.addEventListener("keydown", handleKeyDown);
		return () => {
			window.removeEventListener("keydown", handleKeyDown);
		};
	}, [isFullscreenPlayerOpen]);

	useEffect(() => {
		return () => {
			closeMiniPlayer();
			if (getActiveFullscreenElement()) {
				void exitElementFullscreen().catch(() => { });
			}
		};
	}, [closeMiniPlayer]);

	const handleLikeToggle = (e: React.MouseEvent) => {
		// Stop event propagation to prevent the song details view from opening
		e.stopPropagation();

		if (!currentSong) return;

		const songId = (currentSong as any).id || currentSong._id;

		// Optimistically update UI
		setIsLiked(!isLiked);

		// Actually toggle the like status
		toggleLikeSong(currentSong);

		// Also dispatch a direct event for immediate notification
		document.dispatchEvent(new CustomEvent('songLikeStateChanged', {
			detail: {
				songId,
				song: currentSong,
				isLiked: !isLiked,
				timestamp: Date.now(),
				source: 'PlaybackControls'
			}
		}));
	};

	if (!currentSong) return null;

	return (
		<>
			<SongDetailsView isOpen={showSongDetails} onClose={() => dispatchPlaybackUi({ type: "song_details", value: false })} />
			<QueueDrawer isOpen={showQueue} onClose={() => dispatchPlaybackUi({ type: "queue", value: false })} />

			{isFullscreenPlayerOpen && (
				<div className="fixed inset-0 bottom-[90px] z-[110] hidden sm:block">
					<div
						className="absolute inset-0"
						style={fullscreenBaseBackgroundStyle}
					/>

					<div className="relative h-full overflow-hidden">
						<div
							className="pointer-events-none absolute top-0 inset-x-0 z-[3] h-[54px]"
							style={fullscreenTopShadeStyle}
						/>
						<div className="absolute inset-x-0 top-0 z-[5] pointer-events-none">
							<div
								className="w-full px-8 pt-3 pb-1 flex items-center justify-between pointer-events-auto transition-all duration-200"
								style={fullscreenTopControlsStyle}
							>
								<div className="min-w-0 flex items-center gap-2.5">
									<img
										src="/mavrixfy.png"
										alt="MAVRIXFY"
										className="h-8 w-8 object-contain shrink-0 select-none"
										draggable={false}
									/>
									<div className="min-w-0">
										<p className={cn(
											"text-[0.76rem] sm:text-[0.82rem] font-black leading-none uppercase tracking-[0.2em] transition-colors duration-200",
											useDarkFullscreenControls ? "text-black/90" : "text-white/92"
										)}>
											MAVRIXFY
										</p>
										<p className={cn(
											"text-[10px] sm:text-[11px] truncate mt-1 uppercase tracking-[0.08em] transition-colors duration-200 max-w-[44vw] sm:max-w-[380px]",
											useDarkFullscreenControls ? "text-black/65" : "text-white/65"
										)}>
											{currentSong?.title || currentSong?.artist || "Now playing"}
										</p>
									</div>
								</div>
								<div className="flex items-center gap-2">
									<Button
										type="button"
										size="icon"
										variant="ghost"
										className={cn(
											"h-9 w-9 transition-colors duration-200",
											useDarkFullscreenControls
												? "hover:text-black hover:bg-black/10"
												: "hover:text-white hover:bg-white/10",
											isFullscreenQueueOpen
												? (useDarkFullscreenControls ? "text-black bg-black/15" : "text-white bg-white/15")
												: (useDarkFullscreenControls ? "text-black/70" : "text-white/75")
										)}
										onClick={toggleFullscreenQueue}
										title="Queue"
									>
										<QueueMusicIcon className="h-4 w-4" />
									</Button>
									<Button
										type="button"
										size="icon"
										variant="ghost"
										className={cn(
											"h-9 w-9 transition-colors duration-200",
											useDarkFullscreenControls
												? "text-black/70 hover:text-black hover:bg-black/10"
												: "text-white/75 hover:text-white hover:bg-white/10"
										)}
										onClick={toggleFullscreenPlayer}
										title="Exit Fullscreen"
									>
										<CloseFullscreenIcon className="h-4 w-4" />
									</Button>
								</div>
							</div>
						</div>
						<div
							ref={fullscreenScrollContainerRef}
							className="h-full min-h-0 overflow-y-auto scroll-smooth"
							onScroll={handleFullscreenScroll}
						>
							<div className="max-w-[1400px] mx-auto px-6 pt-14 pb-8">
								<div
									className="relative flex items-stretch gap-6"
									style={{ minHeight: "max(430px, calc(100dvh - 320px))" }}
								>
									<div
										className={cn(
											"flex-1 min-w-0 flex items-center justify-center",
											fullscreenHeroProgress > 0 && fullscreenHeroProgress < 1 && "will-change-transform"
										)}
										style={{
											transform: `translate3d(0, ${-4 - 16 * fullscreenHeroProgress}px, 0) scale(${1 - 0.08 * fullscreenHeroProgress})`,
											transformOrigin: "center top",
										}}
									>
										<div className={cn(
											"aspect-square rounded-2xl overflow-hidden shadow-[0_10px_26px_rgba(0,0,0,0.2)] transition-[width] duration-300 ease-out",
											isFullscreenQueueOpen ? "w-[min(44vh,460px)]" : "w-[min(56vh,620px)]"
										)}
										style={{
											backfaceVisibility: "hidden",
											WebkitBackfaceVisibility: "hidden",
										}}
										>
											<img
												src={currentSong?.imageUrl}
												alt={currentSong?.title}
												className="w-full h-full object-cover"
											/>
										</div>
									</div>

									<aside className={cn(
										"h-[min(74vh,760px)] min-h-0 transition-all duration-300 ease-out",
										isFullscreenQueueOpen
											? "w-[clamp(300px,31vw,430px)] opacity-100 translate-x-0"
											: "w-0 opacity-0 translate-x-6 pointer-events-none"
									)}>
										<div className="h-full min-h-0 flex flex-col overflow-hidden">
											<div className="px-2 py-2.5 flex items-center justify-between">
												<div className="min-w-0">
													<p className="text-[11px] uppercase tracking-[0.18em] text-white/55">Queue</p>
													<p className="text-sm font-semibold text-white truncate">
														{fullscreenUpcomingSongs.length} song{fullscreenUpcomingSongs.length === 1 ? "" : "s"} up next
													</p>
												</div>
												<Button
													size="icon"
													variant="ghost"
													className="h-8 w-8 text-white/70 hover:text-white hover:bg-white/10"
													onClick={() => dispatchFullscreenUi({ type: "queue_open", value: false })}
													title="Close Queue"
												>
													<CloseIcon className="h-4 w-4" />
												</Button>
											</div>

											<div className="px-2 pb-3">
												<p className="text-[11px] uppercase tracking-[0.18em] text-white/45 mb-1.5">Now Playing</p>
												<div className="flex items-center gap-3 p-1.5">
													<img
														src={currentSong?.imageUrl}
														alt={currentSong?.title}
														className="w-12 h-12 rounded-md object-cover flex-shrink-0"
													/>
													<div className="min-w-0">
														<p className="text-sm font-semibold text-white truncate">{currentSong?.title}</p>
														<p className="text-xs text-white/70 truncate">{currentSong?.artist}</p>
													</div>
												</div>
											</div>

											<div className="flex-1 min-h-0 overflow-y-auto p-1.5 space-y-1.5">
												{fullscreenUpcomingSongs.length === 0 ? (
													<div className="h-full min-h-[180px] grid place-items-center text-center px-3">
														<div>
															<p className="text-sm font-semibold text-white/90">Your queue is clear</p>
															<p className="text-xs text-white/60 mt-1">Add songs to continue playback seamlessly.</p>
														</div>
													</div>
												) : (
													fullscreenUpcomingSongs.map((song, idx) => {
														const queueIndex = currentIndex + 1 + idx;
														const songDuration = Number((song as any).duration);

														return (
															<button
																type="button"
																key={`${song._id || (song as any).id || song.title}-${queueIndex}`}
																className="group flex w-full items-center gap-3 rounded-lg hover:bg-white/[0.1] transition-all duration-200 px-2 py-1.5 cursor-pointer text-left bg-transparent border-0"
																onClick={() => playSongFromFullscreenQueue(queueIndex)}
															>
																<div className="w-5 text-center text-[11px] text-white/45 tabular-nums">{idx + 1}</div>
																<img
																	src={song.imageUrl}
																	alt={song.title}
																	className="w-11 h-11 rounded-md object-cover flex-shrink-0"
																/>
																<div className="min-w-0 flex-1">
																	<p className="text-sm text-white font-medium truncate">{song.title}</p>
																	<p className="text-xs text-white/65 truncate">{song.artist}</p>
																</div>
																<div className="flex items-center gap-1.5">
																	<span className="text-[11px] text-white/45 tabular-nums w-10 text-right">
																		{Number.isFinite(songDuration) && songDuration > 0 ? formatTime(songDuration) : "--:--"}
																	</span>
																	<Button
																		type="button"
																		size="icon"
																		variant="ghost"
																		className="h-7 w-7 text-white/45 hover:text-red-300 hover:bg-red-500/10 opacity-0 group-hover:opacity-100 transition-opacity"
																		onClick={(event) => {
																			event.stopPropagation();
																			removeSongFromFullscreenQueue(queueIndex);
																		}}
																		title="Remove From Queue"
																	>
																		<DeleteIcon className="h-3.5 w-3.5" />
																	</Button>
																</div>
															</button>
														);
													})
												)}
											</div>
										</div>
									</aside>

								</div>

								<div className="space-y-8 pt-4 pb-8" style={fullscreenDetailsStyle}>
								<section>
									<div className="mb-4">
										<h3 className="text-3xl md:text-4xl leading-none font-semibold tracking-[-0.025em] text-white/88">
											Related music videos
										</h3>
									</div>

									{fullscreenRelatedSongs.length === 0 ? (
										<div className="rounded-2xl border border-white/15 px-6 py-8 text-center text-white/70" style={fullscreenSurfaceStyle}>
											No related tracks yet.
										</div>
									) : (
										<div className="relative">
											<Button
												type="button"
												size="icon"
												variant="ghost"
												className="absolute left-2 top-1/2 -translate-y-1/2 z-10 h-9 w-9 rounded-full border border-white/15 bg-black/40 text-white/90 hover:bg-black/60"
												onClick={() => scrollFullscreenRelated("left")}
												title="Scroll Left"
											>
												<ChevronLeftIcon className="h-4 w-4" />
											</Button>
											<Button
												type="button"
												size="icon"
												variant="ghost"
												className="absolute right-2 top-1/2 -translate-y-1/2 z-10 h-9 w-9 rounded-full border border-white/15 bg-black/40 text-white/90 hover:bg-black/60"
												onClick={() => scrollFullscreenRelated("right")}
												title="Scroll Right"
											>
												<ChevronRightIcon className="h-4 w-4" />
											</Button>
											<div
												ref={fullscreenRelatedSliderRef}
												className="flex gap-4 overflow-x-auto pb-2 snap-x snap-mandatory scroll-smooth [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden px-12 md:px-14"
											>
												{fullscreenRelatedSongs.map(({ song, index: queueIndex }) => (
													<button
														type="button"
														key={`${song._id || (song as any).id || song.title}-related-slider-${queueIndex}`}
														className="group snap-start shrink-0 w-[clamp(190px,22vw,300px)] cursor-pointer text-left bg-transparent border-0 p-0"
														onClick={() => playSongFromFullscreenQueue(queueIndex)}
													>
														<div
															className="h-[clamp(116px,13vw,170px)] rounded-xl overflow-hidden border border-white/15 bg-white/8 shadow-[0_8px_24px_rgba(0,0,0,0.24)]"
															style={fullscreenSurfaceStyle}
														>
															<img
																src={song.imageUrl}
																alt={song.title}
																className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-[1.04]"
															/>
														</div>
														<p className="text-[1.1rem] leading-tight font-semibold text-white mt-2.5 line-clamp-2">{song.title}</p>
														<p className="text-sm leading-tight text-white/70 truncate mt-1">{song.artist}</p>
													</button>
												))}
											</div>
										</div>
									)}
								</section>

								<div className="grid grid-cols-1 xl:grid-cols-[1.05fr_1fr] gap-5">
									<section className="rounded-2xl overflow-hidden border border-white/10" style={fullscreenSurfaceStyle}>
										<div className="relative h-[360px]">
											<img
												src={currentSong?.imageUrl}
												alt={primaryArtist}
												className="absolute inset-0 w-full h-full object-cover"
											/>
											<div
												className="absolute inset-0"
												style={{
													background: "linear-gradient(180deg, rgba(255,255,255,0.08) 0%, rgba(25,35,58,0.26) 48%, rgba(15,22,38,0.7) 100%)",
												}}
											/>
											<div className="absolute inset-0 p-6 flex flex-col justify-between">
												<p className="text-3xl leading-none font-semibold text-white/90">About the artist</p>
												<div>
													<p className="text-2xl leading-tight font-semibold text-white">{primaryArtist}</p>
													<p className="text-lg leading-tight text-white/85 mt-1">{formatNumber(artistMonthlyListeners)} monthly listeners</p>
												</div>
											</div>
										</div>
										<div className="px-6 py-5 bg-white/[0.08]">
											<p className="text-base leading-relaxed text-white/78">
												{primaryArtist} is trending on Mavrixfy right now. Explore related songs, keep the queue moving, and discover more from the same artist flow.
											</p>
										</div>
									</section>

									<section className="rounded-2xl border border-white/10 p-6" style={fullscreenSurfaceStyle}>
										<div className="flex items-center justify-between mb-4">
											<h3 className="text-3xl leading-none font-semibold text-white/90">Credits</h3>
											<button
												type="button"
												className="text-sm leading-tight font-semibold text-white/65 hover:text-white transition-colors"
											>
												Show all
											</button>
										</div>
										<div className="space-y-4">
											{creditArtists.map((artist, index) => (
												<div key={`${artist}-${index}`}>
													<p className="text-2xl leading-tight font-semibold text-white">{artist}</p>
													<p className="text-base leading-tight text-white/70">
														{index === 0 ? "Main Artist • Writer • Producer" : index === 1 ? "Writer" : "Performer"}
													</p>
												</div>
											))}
										</div>
									</section>
								</div>

								<section className="rounded-2xl border border-white/10 px-6 py-5" style={fullscreenSurfaceStyle}>
									<div className="flex items-center justify-between mb-3">
										<h3 className="text-3xl leading-none font-semibold text-white/90">Next in queue</h3>
										<button
											type="button"
											onClick={() => dispatchFullscreenUi({ type: "queue_open", value: true })}
											className="text-sm leading-tight font-semibold text-white/65 hover:text-white transition-colors"
										>
											Open queue
										</button>
									</div>

									{nextQueueSong ? (
										<button
											type="button"
											className="flex w-full items-center gap-3 rounded-xl hover:bg-white/[0.09] transition-colors cursor-pointer p-2 text-left bg-transparent border-0"
											onClick={() => playSongFromFullscreenQueue(currentIndex + 1)}
										>
											<img
												src={nextQueueSong.imageUrl}
												alt={nextQueueSong.title}
												className="w-14 h-14 rounded-md object-cover flex-shrink-0"
											/>
											<div className="min-w-0">
												<p className="text-xl leading-tight font-semibold text-white truncate">{nextQueueSong.title}</p>
												<p className="text-base leading-tight text-white/70 truncate">{nextQueueSong.artist}</p>
											</div>
										</button>
									) : (
										<p className="text-base leading-tight text-white/70">Queue is empty right now.</p>
									)}
								</section>
							</div>
						</div>

					</div>
				</div>
			</div>
			)}

			{/* Desktop Player */}
			<footer
				ref={playerRef}
				className="h-[90px] px-4 hidden sm:block transition-opacity duration-300 bg-zinc-950 text-foreground border-t border-white/5 relative z-[120]"
				style={{ opacity: isTransitioning ? 0.95 : 1 }}
			>
				<div className="flex justify-between items-center h-full max-w-[1800px] mx-auto py-2">
					{/* currently playing song */}
					<div className="flex items-center gap-3 min-w-[180px] w-[30%]">
						{currentSong && (
							<>
								<div className="relative group cursor-pointer">
									<img
										src={currentSong.imageUrl}
										alt={currentSong.title}
										className="w-14 h-14 object-cover rounded-md"
									/>
								</div>
								<div className="flex-1 min-w-0 max-w-[200px]">
									<PingPongScroll
										text={currentSong.title}
										className="text-sm text-white hover:underline cursor-pointer leading-tight mb-0.5"
										velocity={30}
										delay={2}
									/>
									<PingPongScroll
										text={currentSong.artist}
										className="text-[11px] text-white/60 hover:underline hover:text-white cursor-pointer leading-tight"
										velocity={25}
										delay={2}
									/>
								</div>
								<LikeButton
									isLiked={isLiked}
									onToggle={(e) => handleLikeToggle(e)}
									className="hover:scale-110 transition-transform flex-shrink-0"
									iconSize={16}
								/>
							</>
						)}
					</div>

					{/* player controls */}
					<div className="flex flex-col items-center gap-2 flex-1 max-w-[40%]">
						<div className="flex items-center justify-center gap-4 mb-0">
							<ShuffleButton size="sm" />

							<Button
								type="button"
								size="icon"
								variant="ghost"
								className="hover:text-white text-white/70 h-8 w-8 hover:scale-105 transition-all"
								onClick={playPrevious}
								disabled={!currentSong}
								aria-label="Previous track"
							>
								<SkipPreviousIcon className="h-4 w-4" />
							</Button>

							<Button
								type="button"
								size="icon"
								className="bg-white hover:bg-white hover:scale-110 active:scale-95 text-black rounded-full h-8 w-8 flex items-center justify-center transition-all shadow-sm"
								onClick={togglePlay}
								disabled={!currentSong}
								aria-label={isPlaying ? "Pause" : "Play"}
							>
								{isPlaying ?
									<PauseIcon className="h-4 w-4" /> :
									<PlayArrowIcon className="h-4 w-4 ml-[1px]" />
								}
							</Button>

							<Button
								type="button"
								size="icon"
								variant="ghost"
								className="hover:text-white text-white/70 h-8 w-8 hover:scale-105 transition-all"
								onClick={playNext}
								disabled={!currentSong}
								aria-label="Next track"
							>
								<SkipNextIcon className="h-4 w-4" />
							</Button>

							<Button
								type="button"
								size="icon"
								variant="ghost"
								className={cn('hover:text-white h-8 w-8 hover:scale-105 transition-all', isRepeating ? 'text-[#1ed760]' : 'text-white/70')}
								onClick={toggleRepeat}
								aria-label={isRepeating ? "Turn repeat off" : "Turn repeat on"}
								aria-pressed={isRepeating}
							>
								<RepeatIcon className="h-4 w-4" />
							</Button>
						</div>

						<div className="flex items-center gap-2 w-full">
							<div className="text-[11px] text-white/70 w-[40px] text-right font-normal tabular-nums">{formatTime(currentTime)}</div>
							<div className="w-full relative group">
								<div
									className="relative w-full py-1"
								>
									<input
										type="range"
										min={0}
										max={Number.isFinite(duration) ? duration : 0}
										step={0.1}
										value={Number.isFinite(currentTime) ? currentTime : 0}
										aria-label="Seek time"
										disabled={!duration}
										className="absolute inset-0 z-10 h-full w-full cursor-pointer opacity-0 disabled:cursor-default"
										onChange={(event) => seekToPosition(Number(event.currentTarget.value))}
									/>
									<div className="h-1 w-full rounded-full overflow-hidden bg-white/30 group-hover:bg-white/40 transition-colors">
										<div
											className="h-full bg-white rounded-full relative"
											style={{ width: `${(isNaN(duration) || duration === 0) ? 0 : (currentTime / duration) * 100}%` }}
										>
											<div className="absolute right-0 top-1/2 -translate-y-1/2 w-3 h-3 bg-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity shadow-lg" />
										</div>
									</div>
								</div>
							</div>
							<div className="text-[11px] text-white/70 w-[40px] font-normal tabular-nums">{formatTime(duration)}</div>
						</div>
					</div>

					{/* volume controls */}
					<div className="flex items-center gap-3 min-w-[220px] w-[30%] justify-end">
						<Button
							type="button"
							size="icon"
							variant="ghost"
							className={cn(
								"hover:text-white h-8 w-8 hover:scale-105 transition-all",
								isFullscreenPlayerOpen && isFullscreenQueueOpen ? "text-white" : "text-white/70"
							)}
							onClick={() => {
								if (isFullscreenPlayerOpen) {
									dispatchFullscreenUi({ type: "toggle_queue" });
									return;
								}
								window.dispatchEvent(new Event('toggleQueue'));
								// Also keep the mobile drawer for mobile devices
								if (window.innerWidth < 768) {
									dispatchPlaybackUi({ type: "queue", value: true });
								}
							}}
							data-queue-button
							title={isFullscreenPlayerOpen ? "Toggle Fullscreen Queue" : "Toggle Queue"}
						>
							<QueueMusicIcon className="h-4 w-4" />
						</Button>

						<div className="flex items-center gap-2 ml-1">
							<div className="w-32 sm:w-48">
								<ElasticSlider
									defaultValue={volume}
									maxValue={100}
									startingValue={0}
									onValueChange={(val) => {
										setVolume(val);
									}}
									className="w-full"
								/>
							</div>
						</div>

						<Button
							type="button"
							size="icon"
							variant="ghost"
							className={cn(
								"hover:text-white h-8 w-8 hover:scale-105 transition-all",
								isMiniPlayerOpen ? "text-[#1ed760]" : "text-white/70"
							)}
							onClick={toggleMiniPlayer}
							title={isMiniPlayerOpen ? "Close Miniplayer" : "Open Miniplayer"}
						>
							<PictureInPictureAltIcon className="h-4 w-4" />
						</Button>

						<Button
							type="button"
							size="icon"
							variant="ghost"
							className={cn(
								"hover:text-white h-8 w-8 hover:scale-105 transition-all",
								isFullscreenPlayerOpen ? "text-[#1ed760]" : "text-white/70"
							)}
							onClick={toggleFullscreenPlayer}
							title={isFullscreenPlayerOpen ? "Exit Fullscreen" : "Open Fullscreen"}
						>
							{isFullscreenPlayerOpen ? (
								<CloseFullscreenIcon className="h-4 w-4" />
							) : (
								<OpenInFullIcon className="h-4 w-4" />
							)}
						</Button>
					</div>
				</div>
			</footer>
		</>
	);
};

export default PlaybackControls;
