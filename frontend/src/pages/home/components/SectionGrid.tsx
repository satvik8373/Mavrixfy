import { Song } from '@/types';
import { Button } from '@/components/ui/button';
import PlayButton from './PlayButton';
import { getOptimizedArtworkUrl } from '@/services/cloudinaryService';

type SectionGridProps = {
  title: string;
  songs: Song[];
  isLoading: boolean;
};
const SectionGrid = ({ songs, title, isLoading }: SectionGridProps) => {
  // Do not render skeletons; render nothing until data is ready
  if (isLoading) return null;

  return (
    <div className="mb-8">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl sm:text-2xl font-semibold">{title}</h2>
        <Button variant="link" className="text-sm text-zinc-400 hover:text-white">
          Show all
        </Button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {songs.map((song, index) => (
          <div
            key={song._id}
            className="bg-zinc-800/40 p-4 rounded-md hover:bg-zinc-700/40 transition-all group cursor-pointer"
          >
            <div className="relative mb-4">
              <div className="aspect-square rounded-md shadow-lg overflow-hidden">
                <img
                  src={getOptimizedArtworkUrl(song.imageUrl, {
                    width: 360,
                    height: 360,
                    crop: 'fill',
                  })}
                  alt={song.title}
                  className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                  loading={index < 4 ? "eager" : "lazy"}
                  {...(index < 4 ? { fetchPriority: "high" } : {})}
                />
              </div>
              <PlayButton song={song} />
            </div>
            <h3 className="font-medium mb-2 truncate">{song.title}</h3>
            <p className="text-sm text-zinc-400 truncate">{song.artist}</p>
          </div>
        ))}
      </div>
    </div>
  );
};
export default SectionGrid;
