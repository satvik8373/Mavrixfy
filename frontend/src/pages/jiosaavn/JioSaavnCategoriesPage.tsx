import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Music, TrendingUp, Sparkles } from 'lucide-react';
import { CustomScrollbar } from '@/components/ui/CustomScrollbar';
import { Button } from '@/components/ui/button';
import { JioSaavnPlaylistsSection } from '@/components/jiosaavn/JioSaavnPlaylistsSection';
import { PLAYLIST_CATEGORIES, CATEGORY_ICON_MAP } from '@/services/jioSaavnService';

const JioSaavnCategoriesPage: React.FC = () => {
  const navigate = useNavigate();

  const handleCategoryClick = (categoryId: string) => {
    navigate('/jiosaavn/playlists', {
      state: { category: categoryId }
    });
  };

  return (
    <div className="min-h-screen bg-[#121212] text-white">
      <CustomScrollbar className="h-screen">
        <div className="pb-32 md:pb-24">
          {/* Header */}
          <div className="sticky top-0 z-10 bg-[#121212]/95 backdrop-blur-sm border-b border-white/10">
            <div className="flex items-center gap-4 p-4">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => navigate(-1)}
                className="rounded-full hover:bg-white/10"
              >
                <ArrowLeft className="h-5 w-5" />
              </Button>

              <div className="flex-1">
                <h1 className="text-2xl font-semibold flex items-center gap-2">
                  <Music className="w-6 h-6 text-orange-500" />
                  Mavrixfy Categories
                </h1>
                <p className="text-sm text-white/60 mt-1">Discover music by mood, genre, and language</p>
              </div>
            </div>
          </div>

          {/* Categories Grid */}
          <div className="p-4">
            <div className="mb-6">
              <h2 className="text-xl font-semibold mb-2 flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-yellow-500" />
                Browse by Category
              </h2>
              <p className="text-white/60 text-sm">Choose a category to explore curated playlists</p>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 mb-8">
              {PLAYLIST_CATEGORIES.map((category) => (
                <button type="button"
                  key={category.id}
                  onClick={() => handleCategoryClick(category.id)}
                  className="group relative p-6 rounded-lg transition-all duration-200 hover:scale-105 overflow-hidden"
                  style={{
                    backgroundColor: category.color + '20',
                    borderColor: category.color + '40'
                  }}
                >
                  {/* Background gradient */}
                  <div
                    className="absolute inset-0 opacity-10 group-hover:opacity-20 transition-opacity"
                    style={{
                      background: `linear-gradient(135deg, ${category.color}40 0%, ${category.color}20 100%)`
                    }}
                  />

                  <div className="relative z-10 text-center">
                    <div className="flex justify-center mb-3">
                      {(() => {
                        const IconComp = CATEGORY_ICON_MAP[category.id] || Music;
                        return <IconComp className="w-8 h-8" style={{ color: category.color }} />;
                      })()}
                    </div>
                    <h3 className="font-semibold text-lg mb-2" style={{ color: category.color }}>
                      {category.name}
                    </h3>
                    <p className="text-white/60 text-sm leading-tight">
                      {category.description}
                    </p>

                    {/* Priority indicator */}
                    {category.priority >= 8 && (
                      <div className="absolute top-2 right-2">
                        <TrendingUp className="w-4 h-4 text-red-500" />
                      </div>
                    )}
                  </div>

                  {/* Hover effect */}
                  <div className="absolute inset-0 border-2 border-transparent group-hover:border-current rounded-lg transition-colors"
                    style={{ borderColor: category.color + '60' }} />
                </button>
              ))}
            </div>

            {/* Featured Section - Show trending category */}
            <div className="mb-8">
              <JioSaavnPlaylistsSection
                categoryId="trending"
                limit={8}
                showViewAll={true}
              />
            </div>

            {/* Popular Categories Preview */}
            <div className="space-y-8">
              {PLAYLIST_CATEGORIES
                .filter(cat => cat.priority >= 7 && cat.id !== 'trending')
                .slice(0, 3)
                .map((category) => (
                  <JioSaavnPlaylistsSection
                    key={category.id}
                    categoryId={category.id}
                    limit={6}
                    showViewAll={true}
                  />
                ))
              }
            </div>
          </div>
        </div>
      </CustomScrollbar>
    </div>
  );
};

export default JioSaavnCategoriesPage;
