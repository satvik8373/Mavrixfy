import { Music, Play } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { HorizontalScroll, ScrollItem } from '@/components/ui/horizontal-scroll';
import { SectionWrapper } from '@/components/ui/section-wrapper';
import { RecommendationItem, RecommendationSection as RecommendationSectionType } from '@/services/recommendationService';
import { recentlyPlayedService } from '@/services/recentlyPlayedService';
import { getOptimizedArtworkUrl } from '@/services/cloudinaryService';

interface RecommendationSectionProps {
  section: RecommendationSectionType;
}

const CARD_WIDTH = 160;

export const RecommendationSection = ({ section }: RecommendationSectionProps) => {
  const navigate = useNavigate();
  const playlists = section.items.filter((item) => item.kind === 'playlist');

  const openItem = (item: RecommendationItem) => {
    if (item.playlist?.type === 'jiosaavn-playlist' || item.source === 'jiosaavn') {
      recentlyPlayedService.addJioSaavnPlaylist(item.playlist || {
        id: item.contentId,
        name: item.title,
        image: item.imageUrl,
      });
    } else if (item.playlist) {
      recentlyPlayedService.addPlaylist(item.playlist);
    }
    navigate(item.routePath || `/playlist/${item.contentId}`, {
      state: item.playlist ? { playlist: item.playlist } : undefined,
    });
  };

  if (playlists.length === 0) return null;

  return (
    <SectionWrapper title={section.title} subtitle={section.subtitle}>
      <HorizontalScroll itemWidth={CARD_WIDTH} gap={10} showArrows snapToItems={false} edgeToEdge className="min-h-[238px] md:min-h-[258px]">
        {playlists.map((item, index) => (
          <ScrollItem key={item.id} width={CARD_WIDTH}>
            <button
              type="button"
              onClick={() => openItem(item)}
              className="group w-full rounded-md p-1 text-left transition-all duration-200 hover:bg-white/5 active:scale-95 md:p-2"
            >
              <span className="relative mb-2 block aspect-square w-full overflow-hidden rounded-[4px] bg-white/5 shadow-lg md:mb-3">
                {item.imageUrl ? (
                  <img
                    src={getOptimizedArtworkUrl(item.imageUrl, {
                      width: 320,
                      height: 320,
                      crop: 'fill',
                    })}
                    alt={item.title}
                    className="h-full w-full object-cover"
                    loading={index < 2 ? 'eager' : 'lazy'}
                    ref={index < 2 ? (el) => { if (el) (el as any).fetchPriority = 'high'; } : undefined}
                  />
                ) : (
                  <span className="flex h-full w-full items-center justify-center">
                    <Music className="h-7 w-7 text-white/20" />
                  </span>
                )}
                <span className="absolute bottom-2 right-2 hidden h-10 w-10 items-center justify-center rounded-full bg-primary text-primary-foreground opacity-0 shadow-2xl transition-all duration-200 group-hover:scale-105 group-hover:opacity-100 md:flex">
                  <Play className="ml-0.5 h-4 w-4" fill="currentColor" stroke="none" />
                </span>
              </span>
              <span className="block line-clamp-2 text-xs font-medium leading-tight text-foreground md:text-sm">
                {item.title}
              </span>
              <span className="mt-1 block line-clamp-2 text-[10px] text-muted-foreground md:text-xs">
                {item.subtitle || 'Playlist'}
              </span>
            </button>
          </ScrollItem>
        ))}
      </HorizontalScroll>
    </SectionWrapper>
  );
};
