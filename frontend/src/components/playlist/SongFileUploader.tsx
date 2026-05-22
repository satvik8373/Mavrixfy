import { ReactNode, useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Upload, FileText, X, CheckCircle, AlertCircle, Search, ArrowRight, Check, ChevronLeft, ArrowLeftRight, ExternalLink, Copy, HelpCircle } from 'lucide-react';
import { toast } from 'sonner';
import { usePlaylistStore } from '@/stores/usePlaylistStore';
import { useMusicStore } from '@/stores/useMusicStore';
import { Song } from '@/types';
import { Progress } from '../../components/ui/progress';
import { Badge } from '../../components/ui/badge';
import { useNavigate } from 'react-router-dom';
import { ContentLoading } from '@/components/ui/loading';
import { ChevronRight } from 'lucide-react';

interface SongFileUploaderProps {
  playlistId: string;
  onClose: () => void;
}

interface ParsedSong {
  title: string;
  artist: string;
  album?: string;
  duration?: string;
  imageUrl?: string;
  audioUrl?: string;
  status: 'ready' | 'added' | 'error' | 'searching';
  message?: string;
  matchConfidence?: 'high' | 'medium' | 'low';
  stableKey?: string;
}

interface ImportGuidePage {
  content: ReactNode;
  title: string;
}

interface ImportGuideBookProps {
  currentPage: number;
  onClose: () => void;
  onPageChange: (page: number) => void;
  onUploadClick: () => void;
  pages: ImportGuidePage[];
}

const ImportGuideBook = ({
  currentPage,
  onClose,
  onPageChange,
  onUploadClick,
  pages,
}: ImportGuideBookProps) => {
  const totalPages = pages.length;

  return (
    <div className="border rounded-lg overflow-hidden mb-6 bg-zinc-900/80">
      {/* Book pages */}
      <div className="min-h-[400px] md:min-h-[450px] relative">
        {/* Page content */}
        <div className="p-6 h-full">
          {pages[currentPage].content}
        </div>

        {/* Book binding effect */}
        <div className="absolute inset-y-0 left-1/2 transform -translate-x-1/2 w-4 bg-gradient-to-r from-zinc-800/50 to-zinc-800/10 pointer-events-none"></div>

        {/* Page corner fold effect */}
        <div className="absolute bottom-0 right-0 w-10 h-10 bg-zinc-800 rounded-tl-lg shadow-inner pointer-events-none"></div>
      </div>

      {/* Navigation controls */}
      <div className="bg-zinc-800 p-4 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onPageChange(currentPage - 1)}
            disabled={currentPage === 0}
            className="h-8 w-8 p-0 rounded-full"
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>

          <div className="text-sm text-zinc-300">
            Page {currentPage + 1} of {totalPages}
          </div>

          <Button
            variant="ghost"
            size="sm"
            onClick={() => onPageChange(currentPage + 1)}
            disabled={currentPage === totalPages - 1}
            className="h-8 w-8 p-0 rounded-full"
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>

        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={onClose}
            className="h-8 text-xs"
          >
            Close Guide
          </Button>

          {currentPage === totalPages - 1 && (
            <Button
              size="sm"
              onClick={onUploadClick}
              className="h-8 text-xs bg-green-600 hover:bg-green-700"
            >
              Start Importing
            </Button>
          )}
        </div>
      </div>
    </div>
  );
};


interface ImportGuideProps {
  currentPage: number;
  onClose: () => void;
  onPageChange: (page: number) => void;
  onUploadClick: () => void;
  copyToClipboard: (text: string) => void;
}

const ImportGuide = ({
  currentPage,
  onClose,
  onPageChange,
  onUploadClick,
  copyToClipboard,
}: ImportGuideProps) => {
  const guidePages: ImportGuidePage[] = [
    // Cover page
    {
      title: "How to Import Your Playlists",
      content: (
        <div className="flex flex-col items-center justify-center h-full">
          <div className="mb-8 p-4 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full">
            <ArrowLeftRight className="h-12 w-12 text-white" />
          </div>
          <h2 className="text-xl md:text-2xl font-semibold mb-4 text-center">Mavrixfy</h2>
          <p className="text-lg text-center mb-8">Import Guide</p>
          <p className="text-sm text-zinc-300 text-center max-w-xs">
            Follow this step-by-step guide to import your playlists from other music platforms
          </p>
        </div>
      )
    },
    // Page 1
    {
      title: "Step 1: Get your playlist link",
      content: (
        <div className="space-y-4">
          <div className="flex items-center gap-2 mb-6">
            <div className="h-8 w-8 rounded-full bg-blue-500 flex items-center justify-center text-white font-bold">1</div>
            <h3 className="text-lg font-medium">Get your playlist from the original platform</h3>
          </div>

          <ol className="list-decimal ml-6 space-y-4 text-sm">
            <li className="pb-2 border-b border-zinc-700">
              <p className="mb-2">Open Mavrixfy, Apple Music, or another music platform</p>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mt-2">
                <div className="bg-zinc-800 p-2 rounded flex items-center justify-center">
                  <img src="/spotify.png" alt="Mavrixfy" className="h-8 w-8 object-contain" onError={(e) => {
                    (e.target as HTMLImageElement).src = 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAyNCAyNCIgZmlsbD0iIzFFRDc2MCI+PHBhdGggZD0iTTEyIDJDNi40NzcgMiAyIDYuNDc3IDIgMTJzNC40NzcgMTAgMTAgMTAgMTAtNC40NzcgMTAtMTBTMTcuNTIzIDIgMTIgMnptNC41ODYgMTQuNDI0YTAuNjIyIDAuNjIyIDAgMDEtLjg1Ny4yMDdjLTIuMzQ4LTEuNDM4LTUuMzA0LTEuNzYzLTguNzg1LTAuOTY3YTAuNjIyIDAuNjIyIDAgMDEtLjI1LTEuMjE4YzMuODA5LTAuODcxIDcuMDc3LTAuNDk2IDkuNjg2IDEuMTIxYTAuNjIyIDAuNjIyIDAgMDEwLjIwNiAwLjg1N3ptMS4yMjQtMi43MjdjLTAuMDc5IDAuMTMtMC4xOTEgMC4yMjctMC4zMjUgMC4yODRhMC43NzcgMC43NzcgMCAwMS0wLjc1My0wLjA1N2MtMi44NTQtMS43NTQtNy4yMDEtMi4yNjMtMTAuNTctMS4yMzlhMC43NzggMC43NzggMCAwMS0wLjc1My0wLjA1N2MtMi44NTQtMS43NTQtNy4yMDEtMi4yNjMtMTAuNTctMS4yMzlhMC43NzggMC43NzggMCAwMS0wLjc1My0wLjA1N2MtMi44NTQtMS43NTQtNy4yMDEtMi4yNjMtMTAuNTctMS4yMzlhMC43NzggMC43NzggMCAwMS0wLjUzOS0xLjQ5N2MzLjg1NS0xLjEwNyA4LjY1OC0wLjUxNyAxMS45NDMgMS41NDNhMC43NzcgMC43NzcgMCAwMS0wLjA1NSAxLjA3OGwwLjE4OS0wLjExMnptMC4xMDUtMi44MzVhMC45MzQgMC45MzQgMCAwMS0xLjI5MiAwLjI2N2MtMy4yNzQtMi4wMTQtOC42NTktMi4yLTExLjgwOC0xLjIxM2EwLjkzNyAwLjkzNyAwIDAxLTAuNTE1LTEuODA0YzMuNjA3LTEuMDc2IDkuNjA4LTAuODU5IDEzLjM1IDEuNDU3YTAuOTM0IDAuOTM0IDAgMDEwLjI2NSAxLjI5M3oiLz48L3N2Zz4=';
                  }} />
                </div>
                <div className="bg-zinc-800 p-2 rounded flex items-center justify-center">
                  <img src="/google.png" alt="Apple Music" className="h-8 w-8 object-contain" onError={(e) => {
                    (e.target as HTMLImageElement).src = 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAyNCAyNCIgZmlsbD0iI0ZBMjQzQyI+PHBhdGggZD0iTTEwLjc4IDQuMDY3QTIuMzY3IDIuMzY3IDAgMCAwIDEwLjI3OCAyQzguOTQyIDIuMDEgOC41NzcgMi44IDguNTc3IDIuOHMtLjYzMyAxLjUzMy0uMTMzIDMuMDY3Yy41NyAxLjczMyAxLjg2NyAyLjQ2NyAxLjg2NyAyLjQ2N3MuNjI3LTEuNDc3LS4wMS0zQzEwIDQuODY3IDEwLjc4IDQuMDY3IDEwLjc4IDQuMDY3TTEyLjYzIDE5LjY2N0M4LjYwMyAxOS4zMzMgMi40MzcgMjIgMi4zNyAyMmMtLjQuMjMzLjE5NyAxLjQgMS4zNjQgMS40IDAgMCAyLjMzMyAwIDQuNjY2LTIuMzMzIDEuMTU3LTEuMTU3IDIuNi0xLjgyNyAzLjcxNy0yLjA1IDEuMi0uMjQgMy4wNS0uNTE3IDUuMDE2LjIzM2wuNy4zNjdjLjY2Ny4zNjcgMS4zMzQuNDMzIDEuODM0LjA2NyAxLjI2My0uOTMzIDIuODMzLTguOTY3IDIuODMzLTguOTY3cy0uNjMzLTEuNTMzLTIuODMzLTEuNWMtMS40MzMgMC0xLjggMS4xMzMtMS44IDEuMTMzcy0uMzY3IDEuMS0uMzY3IDIuMTY3Yy0uMDMzIDEuNTMzLjQzNCA0LjkzMy0uNjY2IDcuMTMzczIuMzk2LS4z PrivatZTY3LTMuMDY3IDBaIi8+PC9zdmc+';
                  }} />
                </div>
                <div className="bg-zinc-800 p-2 rounded flex items-center justify-center">
                  <img src="/icons/youtube.svg" alt="YouTube Music" className="h-8 w-8 object-contain" onError={(e) => {
                    (e.target as HTMLImageElement).src = 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAyNCAyNCIgZmlsbD0iI0ZGMDAwMCI+PHBhdGggZD0iTTEyIDE4LjI2Yy0zLjc2OS4wMDItNy4wNjQtLjA5My03LjgxNS0uMjU0LTEuMTEyLS4yNC0xLjk3Mi0xLjA0MS0yLjE4My0yLjA0MS0uNDIyLTIuMDA5LS40MTctNC40MTEgMC02LjM4OS4yMTEtMS0uMDU0LTEuODQ1IDEuMDU4LTIuMDg1Ljc1MS0uMTYyIDMuNjgtLjI1NyA4Ljk0MS0uMjU1IDUuMjYtLjAwMiA4LjE5LjA5MyA4Ljk0MS4yNTVjMS4xMTIuMjQgMS44NjcuNzg1IDIuMDc4IDEuNzg1LjI0LjkzLjI0IDEuOTMzLjI0IDMuMTc1IDAgMS4yNDIgMCAyLjI0NC0uMjQgMy4xNzMtLjIxMSAxLS45NjYgMS41NDUtMi4wNzggMS43ODUtLjc1MS4xNjItNC41NDUuMjU3LTguOTQxLjI1NXptLTEuOTk5LTguMTI1djMuNzMzbDMuNDc4LTEuODY3LTMuNDc4LTEuODY2erIicmNsZSBjeD0iMTIiIGN5PSIxMiIgcj0iMTAiIHN0cm9rZT0iI0ZGMDAwMCIgc3Ryb2tlLXdpZHRoPSIxLjUiIGZpbGw9Im5vbmUiLz48L3N2Zz4=';
                  }} />
                </div>
              </div>
            </li>
            <li className="pb-2 border-b border-zinc-700">
              <p className="mb-2">Find the playlist you want to import</p>
              <div className="bg-zinc-800 rounded-md p-2 text-xs">
                <div className="bg-zinc-700 h-3 w-2/3 rounded mb-2"></div>
                <div className="flex gap-2 items-center">
                  <div className="bg-green-900 h-10 w-10 rounded"></div>
                  <div>
                    <div className="bg-zinc-600 h-2 w-28 rounded mb-1"></div>
                    <div className="bg-zinc-600 h-2 w-20 rounded"></div>
                  </div>
                </div>
              </div>
            </li>
            <li>
              <p className="mb-2">Copy the playlist URL by using the share option</p>
              <div className="bg-zinc-800 rounded-md p-3 text-xs flex items-center gap-2 overflow-hidden">
                <code className="text-xs whitespace-nowrap overflow-hidden text-ellipsis">https://www.mavrixfy.site/playlist/sample</code>
                <button type="button" 
                  onClick={() => copyToClipboard('https://www.mavrixfy.site/playlist/sample')}
                  className="bg-zinc-700 hover:bg-zinc-600 p-1 rounded"
                >
                  <Copy className="h-3 w-3" />
                </button>
              </div>
            </li>
          </ol>
        </div>
      )
    },
    // Page 2
    {
      title: "Step 2: Convert to TXT/CSV file",
      content: (
        <div className="space-y-4">
          <div className="flex items-center gap-2 mb-6">
            <div className="h-8 w-8 rounded-full bg-blue-500 flex items-center justify-center text-white font-bold">2</div>
            <h3 className="text-lg font-medium">Convert the playlist to a file</h3>
          </div>

          <div className="bg-blue-500/10 border border-blue-500/30 rounded-md p-3 mb-4">
            <div className="flex items-center gap-2 mb-2">
              <ExternalLink className="h-4 w-4 text-blue-400" />
              <a 
                href="https://www.tunemymusic.com" 
                target="_blank" 
                rel="noopener noreferrer" 
                className="text-blue-400 font-medium hover:underline text-sm"
              >
                Visit TuneMyMusic.com
              </a>
            </div>
            <p className="text-xs text-zinc-300">This free service helps convert playlists between different platforms</p>
          </div>

          <div className="space-y-3 text-sm">
            <div className="flex gap-2">
              <div className="h-5 w-5 rounded-full bg-zinc-700 flex items-center justify-center text-xs">1</div>
              <p>Click on "Let's Start" and select your source platform</p>
            </div>
            <div className="flex gap-2">
              <div className="h-5 w-5 rounded-full bg-zinc-700 flex items-center justify-center text-xs">2</div>
              <p>Paste the playlist URL you copied</p>
            </div>
            <div className="flex gap-2">
              <div className="h-5 w-5 rounded-full bg-zinc-700 flex items-center justify-center text-xs">3</div>
              <p>After the songs load, click "Next"</p>
            </div>
            <div className="flex gap-2">
              <div className="h-5 w-5 rounded-full bg-zinc-700 flex items-center justify-center text-xs">4</div>
              <p>For the destination, choose "CSV File" or "Text File"</p>
            </div>
            <div className="flex gap-2">
              <div className="h-5 w-5 rounded-full bg-zinc-700 flex items-center justify-center text-xs">5</div>
              <p>Click "Start Moving My Music" and download the file</p>
            </div>
          </div>

          <div className="mt-4 pt-4 border-t border-zinc-700 flex justify-center">
            <div className="relative bg-zinc-800 rounded-md p-2 w-4/5 h-20 flex items-center justify-center">
              <div className="absolute top-2 right-2 h-3 w-3 bg-green-500 rounded-full animate-pulse"></div>
              <div className="text-center">
                <div className="h-2 w-20 bg-zinc-600 rounded mb-2 mx-auto"></div>
                <div className="h-8 w-32 bg-blue-600 rounded mx-auto flex items-center justify-center text-xs text-white font-medium">
                  Download
                </div>
              </div>
            </div>
          </div>
        </div>
      )
    },
    // Page 3
    {
      title: "Step 3: Import to Mavrixfy",
      content: (
        <div className="space-y-4">
          <div className="flex items-center gap-2 mb-6">
            <div className="h-8 w-8 rounded-full bg-blue-500 flex items-center justify-center text-white font-bold">3</div>
            <h3 className="text-lg font-medium">Import your file to Mavrixfy</h3>
          </div>

          <div className="space-y-3 text-sm">
            <div className="flex gap-2 items-start">
              <div className="h-5 w-5 rounded-full bg-zinc-700 flex-shrink-0 flex items-center justify-center text-xs">1</div>
              <div>
                <p className="mb-1">Click the "Select File" button below to upload your TXT or CSV file</p>
                <div className="bg-zinc-800 rounded-md p-2 flex items-center justify-center">
                  <Button 
                    size="sm" 
                    className="h-8 bg-zinc-700 hover:bg-zinc-600 flex items-center gap-1"
                    onClick={onUploadClick}
                  >
                    <Upload className="h-3 w-3" />
                    <span className="text-xs">Select File</span>
                  </Button>
                </div>
              </div>
            </div>
            <div className="flex gap-2 items-start">
              <div className="h-5 w-5 rounded-full bg-zinc-700 flex-shrink-0 flex items-center justify-center text-xs">2</div>
              <div>
                <p className="mb-1">Review the songs found in your file</p>
                <div className="bg-zinc-800 rounded-md p-2">
                  <div className="h-2 w-full bg-zinc-700 rounded mb-1"></div>
                  <div className="h-2 w-full bg-zinc-700 rounded mb-1"></div>
                  <div className="h-2 w-3/4 bg-zinc-700 rounded"></div>
                </div>
              </div>
            </div>
            <div className="flex gap-2 items-start">
              <div className="h-5 w-5 rounded-full bg-zinc-700 flex-shrink-0 flex items-center justify-center text-xs">3</div>
              <div>
                <p className="mb-1">Click "Add Songs" to import them to your playlist</p>
                <div className="bg-zinc-800 rounded-md p-2 flex items-center justify-center">
                  <Button 
                    size="sm" 
                    className="h-8 bg-green-600 hover:bg-green-700 flex items-center gap-1"
                  >
                    <ArrowRight className="h-3 w-3" />
                    <span className="text-xs">Add Songs</span>
                  </Button>
                </div>
              </div>
            </div>
          </div>

          <div className="mt-6 pt-3 border-t border-zinc-700">
            <div className="bg-green-500/20 p-3 rounded-md border border-green-500/30 text-center">
              <p className="text-green-400 font-medium text-sm flex items-center justify-center gap-2">
                <Check className="h-4 w-4" />
                Ready to import your favorite playlists!
              </p>
            </div>
          </div>
        </div>
      )
    }
  ];

  return (
    <ImportGuideBook
      currentPage={currentPage}
      onClose={onClose}
      onPageChange={onPageChange}
      onUploadClick={onUploadClick}
      pages={guidePages}
    />
  );
};

interface FileSelectionViewProps {
  fileInputRef: React.RefObject<HTMLInputElement>;
  handleFileChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  handleUploadClick: () => void;
  onShowGuide: () => void;
}

const FileSelectionView = ({
  fileInputRef,
  handleFileChange,
  handleUploadClick,
  onShowGuide,
}: FileSelectionViewProps) => {
  return (
    <div className="border-2 border-dashed border-gray-300 dark:border-gray-700 rounded-lg p-6 text-center">
      <input
        ref={fileInputRef}
        type="file"
        accept=".txt,.csv"
        onChange={handleFileChange}
        className="hidden"
      />
      <div className="flex flex-col items-center justify-center">
        <FileText className="h-12 w-12 text-gray-400 mb-4" />
        <h3 className="text-lg font-medium mb-2">Import Songs from a File</h3>
        <p className="text-sm text-muted-foreground mb-4 max-w-md mx-auto">
          Upload a TXT or CSV file containing song titles and artists to add them to your playlist.
        </p>
        <div className="flex flex-col sm:flex-row gap-3">
          <Button
            onClick={handleUploadClick}
            className="flex items-center gap-2"
            size="sm"
          >
            <Upload className="h-4 w-4" />
            <span>Select File</span>
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={onShowGuide}
            className="flex items-center gap-2"
          >
            <HelpCircle className="h-4 w-4" />
            <span>Show Import Guide</span>
          </Button>
        </div>
        <div className="mt-4 text-xs text-muted-foreground">
          <p className="mb-1">Supported formats:</p>
          <ul className="list-disc list-inside">
            <li>CSV: title,artist,duration,imageUrl,audioUrl</li>
            <li>TXT: Artist - Title</li>
            <li>TXT: Title by Artist</li>
          </ul>
        </div>
      </div>
    </div>
  );
};

interface ParsedSongsListViewProps {
  parsedSongs: ParsedSong[];
  onReset: () => void;
  onRemoveSong: (index: number) => void;
  onAddSongs: () => void;
}

const ParsedSongsListView = ({
  parsedSongs,
  onReset,
  onRemoveSong,
  onAddSongs,
}: ParsedSongsListViewProps) => {
  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center mb-2">
        <h3 className="text-lg font-medium">{parsedSongs.length} Songs Found</h3>
        <Button
          size="sm"
          variant="ghost"
          onClick={onReset}
          className="h-8 px-2 text-xs sm:text-sm"
        >
          <X className="h-3 w-3 mr-1 sm:h-4 sm:w-4" />
          <span>Reset</span>
        </Button>
      </div>
      
      <div className="border rounded-lg overflow-hidden">
        <div className="max-h-[40vh] overflow-y-auto">
          <table className="w-full">
            <thead className="bg-secondary sticky top-0">
              <tr>
                <th className="text-left p-2 text-xs sm:text-sm font-medium">#</th>
                <th className="text-left p-2 text-xs sm:text-sm font-medium">Title</th>
                <th className="text-left p-2 text-xs sm:text-sm font-medium hidden sm:table-cell">Artist</th>
                <th className="w-8"></th>
              </tr>
            </thead>
            <tbody>
              {parsedSongs.map((song, index) => (
                <tr key={song.stableKey || index} className="border-t border-gray-200 dark:border-gray-800">
                  <td className="p-2 text-xs sm:text-sm">{index + 1}</td>
                  <td className="p-2 text-xs sm:text-sm">
                    <div className="truncate max-w-[150px] sm:max-w-[200px]">{song.title}</div>
                  </td>
                  <td className="p-2 text-xs sm:text-sm hidden sm:table-cell">
                    <div className="truncate max-w-[100px] sm:max-w-[150px]">{song.artist}</div>
                  </td>
                  <td className="p-2">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7"
                      onClick={() => onRemoveSong(index)}
                    >
                      <X className="h-3 w-3" />
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      
      <div className="flex flex-col sm:flex-row justify-between gap-3 mt-4">
        <div className="flex sm:flex-row flex-col gap-2">
          <Button
            onClick={onAddSongs}
            className="flex items-center gap-2"
            disabled={parsedSongs.length === 0}
          >
            <ArrowRight className="h-4 w-4" />
            <span>Add {parsedSongs.length} Songs</span>
          </Button>
        </div>
      </div>
    </div>
  );
};

interface ProcessingSongsViewProps {
  addedSongsCount: number;
  totalSongs: number;
  progress: number;
  displaySongs: ParsedSong[];
}

const ProcessingSongsView = ({
  addedSongsCount,
  totalSongs,
  progress,
  displaySongs,
}: ProcessingSongsViewProps) => {
  return (
    <div key="processing-section" className="border rounded-lg p-6 bg-background">
      <div className="space-y-4">
        <div className="flex justify-between items-center">
          <h3 className="text-lg font-medium">Adding Songs&hellip;</h3>
          <Badge variant="outline">
            {addedSongsCount}/{totalSongs}
          </Badge>
        </div>
        
        <Progress value={progress} className="h-2" />
        
        <div className="max-h-[30vh] overflow-y-auto border rounded-lg p-2 bg-secondary/20">
          {displaySongs.map((song, index) => {
            const keyVal = song.stableKey || 'processing-' + song.title + '-' + index;
            return (
              <div
                key={keyVal}
                className="flex items-center justify-between p-2 border-b last:border-0 text-xs sm:text-sm"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-2">
                    <div className="font-medium truncate max-w-[200px]">{song.title}</div>
                    <div className="text-muted-foreground truncate max-w-[150px] hidden sm:block">
                      {song.artist}
                    </div>
                  </div>
                </div>
                <div className="ml-2 flex-shrink-0 flex items-center gap-1">
                  {song.status === 'added' && (
                    <div className="flex items-center gap-1">
                      <CheckCircle className="h-4 w-4 text-green-500" />
                      {song.matchConfidence === 'high' && (
                        <Badge variant="outline" className="text-[10px] px-1 py-0 h-4 bg-green-500/10 text-green-600 border-green-500/30">
                          Verified
                        </Badge>
                      )}
                      {song.matchConfidence === 'medium' && (
                        <Badge variant="outline" className="text-[10px] px-1 py-0 h-4 bg-yellow-500/10 text-yellow-600 border-yellow-500/30">
                          Likely
                        </Badge>
                      )}
                      {song.matchConfidence === 'low' && (
                        <Badge variant="outline" className="text-[10px] px-1 py-0 h-4 bg-orange-500/10 text-orange-600 border-orange-500/30">
                          Low
                        </Badge>
                      )}
                    </div>
                  )}
                  {song.status === 'error' && (
                    <div className="flex items-center gap-1">
                      <AlertCircle className="h-4 w-4 text-red-500" />
                      <span className="text-[10px] text-red-500">{song.message}</span>
                    </div>
                  )}
                  {song.status === 'searching' && (
                    <div className="flex items-center gap-1">
                      <Search className="h-4 w-4 animate-pulse text-blue-500" />
                      <span className="text-[10px] text-blue-500">Searching&hellip;</span>
                    </div>
                  )}
                  {song.status === 'ready' && <div className="h-4 w-4" />}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

interface ImportCompletionViewProps {
  addedSongsCount: number;
  totalSongs: number;
  parsedSongs: ParsedSong[];
  onFinish: () => void;
  onReset: () => void;
}

const ImportCompletionView = ({
  addedSongsCount,
  totalSongs,
  parsedSongs,
  onFinish,
  onReset,
}: ImportCompletionViewProps) => {
  return (
    <div className="border rounded-lg p-6">
      <div className="flex flex-col items-center justify-center">
        <div className="h-12 w-12 bg-green-100 dark:bg-green-900 rounded-full flex items-center justify-center mb-4">
          <Check className="h-6 w-6 text-green-600 dark:text-green-300" />
        </div>
        <h3 className="text-lg font-medium mb-2">Import Complete</h3>
        <p className="text-sm text-muted-foreground mb-4">
          Successfully added {addedSongsCount} out of {totalSongs} songs to your playlist.
        </p>
        
        {/* Match quality breakdown */}
        <div className="w-full max-w-md mb-4 p-3 bg-secondary rounded-lg">
          <div className="text-xs font-medium mb-2 text-center">Match Quality</div>
          <div className="space-y-2">
            {parsedSongs.filter(s => s.matchConfidence === 'high').length > 0 && (
              <div className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-2">
                  <div className="h-2 w-2 rounded-full bg-green-500"></div>
                  <span>Verified matches</span>
                </div>
                <Badge variant="outline" className="bg-green-500/10 text-green-600 border-green-500/30">
                  {parsedSongs.filter(s => s.matchConfidence === 'high').length}
                </Badge>
              </div>
            )}
            {parsedSongs.filter(s => s.matchConfidence === 'medium').length > 0 && (
              <div className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-2">
                  <div className="h-2 w-2 rounded-full bg-yellow-500"></div>
                  <span>Likely matches</span>
                </div>
                <Badge variant="outline" className="bg-yellow-500/10 text-yellow-600 border-yellow-500/30">
                  {parsedSongs.filter(s => s.matchConfidence === 'medium').length}
                </Badge>
              </div>
            )}
            {parsedSongs.filter(s => s.matchConfidence === 'low').length > 0 && (
              <div className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-2">
                  <div className="h-2 w-2 rounded-full bg-orange-500"></div>
                  <span>Low confidence</span>
                </div>
                <Badge variant="outline" className="bg-orange-500/10 text-orange-600 border-orange-500/30">
                  {parsedSongs.filter(s => s.matchConfidence === 'low').length}
                </Badge>
              </div>
            )}
            {parsedSongs.filter(s => s.status === 'error').length > 0 && (
              <div className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-2">
                  <div className="h-2 w-2 rounded-full bg-red-500"></div>
                  <span>Failed</span>
                </div>
                <Badge variant="outline" className="bg-red-500/10 text-red-600 border-red-500/30">
                  {parsedSongs.filter(s => s.status === 'error').length}
                </Badge>
              </div>
            )}
          </div>
        </div>
        
        <div className="flex flex-col sm:flex-row gap-3">
          <Button onClick={onFinish}>
            View Playlist
          </Button>
          <Button variant="outline" onClick={onReset}>
            Import More Songs
          </Button>
        </div>
      </div>
    </div>
  );
};

export function SongFileUploader({ playlistId, onClose }: SongFileUploaderProps) {
  const [state, setState] = useState({
    parsedSongs: [] as ParsedSong[],
    displaySongs: [] as ParsedSong[],
    isUploading: false,
    isProcessing: false,
    fileName: null as string | null,
    progress: 0,
    addedSongsCount: 0,
    isComplete: false,
    showGuide: (() => {
      const hasUsedImporter = localStorage.getItem('has_used_importer');
      return !hasUsedImporter;
    })(),
    currentPage: 0,
  });
  const { parsedSongs, displaySongs, isUploading, isProcessing, fileName, progress, addedSongsCount, isComplete, showGuide, currentPage } = state;
  const fileInputRef = useRef<HTMLInputElement>(null);
  const processingRef = useRef(false); // Track processing state to prevent re-render issues
  const navigate = useNavigate();
  
  const { addSongToPlaylist } = usePlaylistStore();
  const { convertIndianSongToAppSong, searchIndianSongs } = useMusicStore();

  // Mark that the user has used the importer when they complete an import
  useEffect(() => {
    if (isComplete) {
      localStorage.setItem('has_used_importer', 'true');
    }
  }, [isComplete]);

  const handleUploadClick = () => {
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
    
    // Set that the user has seen the guide
    setState(prev => ({ ...prev, showGuide: false }));
  };

  const parseCSV = (content: string): ParsedSong[] => {
    const lines = content.split(/\r?\n/).filter(line => line.trim() !== '');
    const songs: ParsedSong[] = [];

    if (lines.length === 0) return songs;

    // Parse CSV properly handling quoted fields
    const parseCSVLine = (line: string): string[] => {
      const result: string[] = [];
      let current = '';
      let inQuotes = false;
      
      for (let i = 0; i < line.length; i++) {
        const char = line[i];
        const nextChar = line[i + 1];
        
        if (char === '"') {
          if (inQuotes && nextChar === '"') {
            current += '"';
            i++; // Skip next quote
          } else {
            inQuotes = !inQuotes;
          }
        } else if (char === ',' && !inQuotes) {
          result.push(current.trim());
          current = '';
        } else {
          current += char;
        }
      }
      result.push(current.trim());
      return result;
    };

    // Parse header to detect column indices
    const headerLine = parseCSVLine(lines[0]);
    const headers = headerLine.map(h => h.toLowerCase().trim());
    
    // Detect column indices for different formats
    const trackNameIdx = headers.findIndex(h => 
      h.includes('track name') || h.includes('song') || h.includes('title') || h === 'name'
    );
    const artistIdx = headers.findIndex(h => 
      h.includes('artist') || h.includes('singer')
    );
    const albumIdx = headers.findIndex(h => 
      h.includes('album')
    );
    const durationIdx = headers.findIndex(h => 
      h.includes('duration')
    );

    // If no proper headers found, assume simple format: title, artist
    const hasHeaders = trackNameIdx !== -1 || artistIdx !== -1;
    const startIdx = hasHeaders ? 1 : 0;

    for (let i = startIdx; i < lines.length; i++) {
      const columns = parseCSVLine(lines[i]);
      
      if (columns.length < 2) continue;

      let title = '';
      let artist = '';
      let album = '';
      let duration = '';

      if (hasHeaders) {
        // Use detected column indices
        title = trackNameIdx !== -1 ? columns[trackNameIdx] : columns[1];
        artist = artistIdx !== -1 ? columns[artistIdx] : columns[3];
        album = albumIdx !== -1 ? columns[albumIdx] : '';
        duration = durationIdx !== -1 ? columns[durationIdx] : '';
      } else {
        // Simple format: title, artist
        title = columns[0];
        artist = columns[1];
        duration = columns[2] || '';
      }

      // Clean up the data
      title = title.replace(/^["']|["']$/g, '').trim();
      artist = artist.replace(/^["']|["']$/g, '').trim();
      album = album.replace(/^["']|["']$/g, '').trim();
      
      // Convert duration from ms to seconds if needed
      if (duration && !/:/.test(duration)) {
        const ms = parseInt(duration);
        if (!isNaN(ms)) {
          const seconds = Math.floor(ms / 1000);
          const mins = Math.floor(seconds / 60);
          const secs = seconds % 60;
          duration = `${mins}:${secs.toString().padStart(2, '0')}`;
        }
      }

      if (title && artist) {
        songs.push({
          title,
          artist,
          album,
          duration: duration || '0:00',
          imageUrl: '',
          audioUrl: '',
          status: 'ready'
        });
      }
    }
    
    return songs;
  };

  const parseTXT = (content: string): ParsedSong[] => {
    const lines = content.split(/\r?\n/).filter(line => line.trim() !== '');
    const songs: ParsedSong[] = [];

    for (const line of lines) {
      // Try to split by common separators
      let columns;
      
      if (line.includes(' - ')) {
        // Format: Artist - Title
        columns = line.split(' - ').map(part => part.trim());
        if (columns.length >= 2) {
          songs.push({
            title: columns[1],
            artist: columns[0],
            status: 'ready'
          });
        }
      } else if (line.includes(' by ')) {
        // Format: Title by Artist
        columns = line.split(' by ').map(part => part.trim());
        if (columns.length >= 2) {
          songs.push({
            title: columns[0],
            artist: columns[1],
            status: 'ready'
          });
        }
      } else if (line.includes('\t')) {
        // Tab-separated
        columns = line.split('\t').map(part => part.trim());
        if (columns.length >= 2) {
          songs.push({
            title: columns[0],
            artist: columns[1],
            status: 'ready'
          });
        }
      } else {
        // Just use as title with unknown artist
        songs.push({
          title: line,
          artist: 'Unknown Artist',
          status: 'ready'
        });
      }
    }
    
    return songs;
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    setState(prev => ({ ...prev, isUploading: true, fileName: file.name }));
    
    try {
      const content = await file.text();
      let songs: ParsedSong[] = [];
      
      if (file.name.toLowerCase().endsWith('.csv')) {
        songs = parseCSV(content);
      } else if (file.name.toLowerCase().endsWith('.txt')) {
        songs = parseTXT(content);
      } else {
        toast.error('Unsupported file format. Please upload a CSV or TXT file.');
        setState(prev => ({ ...prev, isUploading: false }));
        return;
      }
      
      if (songs.length === 0) {
        toast.error('No valid songs found in the file.');
        setState(prev => ({ ...prev, isUploading: false }));
        return;
      }
      
      const mappedSongs = songs.map((song, index) => ({
        ...song,
        stableKey: `upload-${song.title}-${song.artist}-${index}`
      }));

      setState(prev => ({ ...prev, parsedSongs: mappedSongs }));
      
      // Single notification for successful upload
      toast.success(`Found ${songs.length} songs in the file. Ready to add to playlist.`);
    } catch (error) {
      toast.error('Failed to read the file. Please try again.');
    } finally {
      setState(prev => ({ ...prev, isUploading: false }));
    }
  };

  // Enhanced function to search for song details with better matching
  const searchForSongDetails = async (title: string, artist: string, album?: string): Promise<any> => {
    try {
      // Create multiple search queries for better matching
      const queries = [
        `${title} ${artist}`.trim(),
        title.trim(),
        `${artist} ${title}`.trim()
      ];

      // If album is provided, add it to search
      if (album) {
        queries.unshift(`${title} ${artist} ${album}`.trim());
      }

      let bestMatch: any = null;
      let bestScore = 0;

      // Use recursion to process queries sequentially and support early exit without a loop block
      const runQuery = async (index: number): Promise<void> => {
        if (index >= queries.length) return;

        await searchIndianSongs(queries[index]);
        
        // Get search results from store
        const results = useMusicStore.getState().indianSearchResults;
        
        if (results && results.length > 0) {
          // Score each result based on similarity
          for (const result of results.slice(0, 5)) { // Check top 5 results
            const score = calculateMatchScore(
              { title, artist, album },
              { 
                title: result.title, 
                artist: result.artist || '', 
                album: result.album || '' 
              }
            );

            if (score > bestScore) {
              bestScore = score;
              bestMatch = result;
            }
          }
        }

        // If we found a high confidence match, stop searching
        if (bestScore >= 0.7) return;

        await runQuery(index + 1);
      };

      await runQuery(0);

      return (bestMatch && bestScore >= 0.4) ? { ...bestMatch, matchScore: bestScore } : null;
    } catch (error) {
      return null;
    }
  };

  // Calculate similarity score between two songs
  const calculateMatchScore = (
    original: { title: string; artist: string; album?: string },
    candidate: { title: string; artist: string; album?: string }
  ): number => {
    let score = 0;
    let maxScore = 0;

    // Title matching (most important - 50% weight)
    maxScore += 50;
    const titleSimilarity = stringSimilarity(
      normalizeString(original.title),
      normalizeString(candidate.title)
    );
    score += titleSimilarity * 50;

    // Artist matching (40% weight)
    maxScore += 40;
    const artistSimilarity = stringSimilarity(
      normalizeString(original.artist),
      normalizeString(candidate.artist)
    );
    score += artistSimilarity * 40;

    // Album matching (10% weight, if available)
    if (original.album && candidate.album) {
      maxScore += 10;
      const albumSimilarity = stringSimilarity(
        normalizeString(original.album),
        normalizeString(candidate.album)
      );
      score += albumSimilarity * 10;
    }

    return score / maxScore;
  };

  // Normalize string for comparison
  const normalizeString = (str: string): string => {
    return str
      .toLowerCase()
      .replace(/[^\w\s]/g, '') // Remove special characters
      .replace(/\s+/g, ' ') // Normalize whitespace
      .trim();
  };

  // Calculate string similarity using Levenshtein distance
  const stringSimilarity = (str1: string, str2: string): number => {
    if (str1 === str2) return 1;
    if (!str1 || !str2) return 0;

    // Check if one string contains the other
    if (str1.includes(str2) || str2.includes(str1)) {
      return 0.8;
    }

    // Calculate Levenshtein distance
    const matrix: number[][] = [];
    const len1 = str1.length;
    const len2 = str2.length;

    for (let i = 0; i <= len1; i++) {
      matrix[i] = [i];
    }

    for (let j = 0; j <= len2; j++) {
      matrix[0][j] = j;
    }

    for (let i = 1; i <= len1; i++) {
      for (let j = 1; j <= len2; j++) {
        const cost = str1[i - 1] === str2[j - 1] ? 0 : 1;
        matrix[i][j] = Math.min(
          matrix[i - 1][j] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j - 1] + cost
        );
      }
    }

    const distance = matrix[len1][len2];
    const maxLen = Math.max(len1, len2);
    return 1 - distance / maxLen;
  };

  const addSongsToPlaylist = async () => {
    if (parsedSongs.length === 0) return;
    
    // Set processing flag
    processingRef.current = true;
    setState(prev => ({
      ...prev,
      isProcessing: true,
      progress: 0,
      addedSongsCount: 0,
      isComplete: false,
      displaySongs: parsedSongs.map(song => ({ ...song })),
    }));
    
    // Initialize display songs - create a working copy
    const workingSongs = parsedSongs.map(song => ({ ...song }));
    
    // Clear any existing toast notifications
    toast.dismiss();
    
    const progressToastId = 'progress-toast';
    toast.loading('Starting import...', {
      id: progressToastId,
      duration: Infinity, // Keep toast visible
    });
    
    let addedCount = 0;
    let errorCount = 0;
    let skippedCount = 0;
    
    // Process songs one by one using a recursive helper to avoid await-in-loop warning
    const processIndex = async (i: number): Promise<void> => {
      if (i >= workingSongs.length) return;
      const song = workingSongs[i];
      
      // Skip already processed songs
      if (song.status === 'added') {
        addedCount++;
        return processIndex(i + 1);
      }
      
      if (song.status === 'error') {
        errorCount++;
        return processIndex(i + 1);
      }
      
      try {
        // Update status to searching
        workingSongs[i] = { ...song, status: 'searching', message: 'Searching...' };
        
        // Update display state - use requestAnimationFrame to batch updates
        requestAnimationFrame(() => {
          if (processingRef.current) {
            setState(prev => ({ ...prev, displaySongs: [...workingSongs] }));
          }
        });
        
        // Calculate and update progress
        const currentProgress = Math.round(((i + 1) / workingSongs.length) * 100);
        setState(prev => ({ ...prev, progress: currentProgress }));
        
        // Update toast every 3 songs
        if (i % 3 === 0 || i === workingSongs.length - 1) {
          toast.loading(`Processing ${i + 1}/${workingSongs.length}: ${song.title.substring(0, 30)}...`, { 
            id: progressToastId,
            duration: Infinity,
          });
        }
        
        // Search for the song with enhanced matching
        const searchResult = await searchForSongDetails(song.title, song.artist, song.album);
        
        // Determine match confidence
        let matchConfidence: 'high' | 'medium' | 'low' = 'low';
        let statusMessage = '';
        
        if (searchResult) {
          const matchScore = searchResult.matchScore || 0;
          
          if (matchScore >= 0.7) {
            matchConfidence = 'high';
            statusMessage = 'Added (verified match)';
          } else if (matchScore >= 0.5) {
            matchConfidence = 'medium';
            statusMessage = 'Added (likely match)';
          } else {
            matchConfidence = 'low';
            statusMessage = 'Added (low confidence)';
          }
        } else {
          statusMessage = 'Added (no audio found)';
        }
        
        // Only add if we have audio URL or it's a high confidence match
        if (searchResult?.url || !searchResult) {
          // Create app song with found details or fallback to defaults
          const appSong: Song = convertIndianSongToAppSong({
            id: `imported-${Date.now()}-${i}`,
            title: song.title,
            artist: song.artist,
            album: searchResult?.album || song.album,
            image: searchResult?.image || song.imageUrl || '/placeholder-song.jpg',
            url: searchResult?.url || song.audioUrl || '',
            duration: searchResult?.duration || song.duration || '0'
          });
          
          // Add to playlist
          await addSongToPlaylist(playlistId, appSong);
          
          // Update status
          workingSongs[i] = {
            ...song,
            status: 'added',
            message: statusMessage,
            matchConfidence,
            imageUrl: searchResult?.image || song.imageUrl,
            audioUrl: searchResult?.url || song.audioUrl,
            album: searchResult?.album || song.album
          };
          
          addedCount++;
          setState(prev => ({ ...prev, addedSongsCount: addedCount }));
        } else {
          // Skip songs without audio
          workingSongs[i] = {
            ...song,
            status: 'error',
            message: 'No audio source found'
          };
          skippedCount++;
        }
      } catch (error) {
        
        // Update status to error
        workingSongs[i] = {
          ...song,
          status: 'error',
          message: 'Failed to add'
        };
        
        errorCount++;
      }
      
      // Update display state using requestAnimationFrame
      requestAnimationFrame(() => {
        if (processingRef.current) {
          setState(prev => ({ ...prev, displaySongs: [...workingSongs] }));
        }
      });
      
      // Add a delay between requests to avoid rate limiting
      if (i < workingSongs.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 500));
      }

      return processIndex(i + 1);
    };

    await processIndex(0);
    
    // Final update
    setState(prev => ({
      ...prev,
      parsedSongs: [...workingSongs],
      displaySongs: [...workingSongs],
      isProcessing: false,
      isComplete: true,
    }));
    
    // Hide the progress toast
    toast.dismiss(progressToastId);
    
    // Clear processing flag
    processingRef.current = false;
    
    // Show detailed completion message
    if (addedCount > 0) {
      const highConfidence = workingSongs.filter(s => s.matchConfidence === 'high').length;
      
      let message = `Successfully added ${addedCount} songs to the playlist!`;
      if (highConfidence > 0) {
        message += ` (${highConfidence} verified matches)`;
      }
      if (errorCount > 0 || skippedCount > 0) {
        message += ` ${errorCount + skippedCount} songs could not be added.`;
      }
      
      toast.success(message, { duration: 5000 });
    } else if (errorCount > 0 || skippedCount > 0) {
      toast.error(`Failed to add ${errorCount + skippedCount} songs. Please check the file format.`, { duration: 5000 });
    }
  };

  const resetUpload = () => {
    processingRef.current = false;
    setState(prev => ({
      ...prev,
      parsedSongs: [],
      displaySongs: [],
      fileName: null,
      progress: 0,
      addedSongsCount: 0,
      isComplete: false,
      isProcessing: false,
    }));
    
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const finishAndViewPlaylist = () => {
    onClose();
    // Navigate to the playlist page
    navigate(`/playlist/${playlistId}`);
  };

  const removeSong = (index: number) => {
    const newSongs = [...parsedSongs];
    newSongs.splice(index, 1);
    setState(prev => ({ ...prev, parsedSongs: newSongs }));
  };

  // Function to copy text to clipboard
  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text).then(() => {
      toast.success('Copied to clipboard!');
    });
  };

  // Book pages content
  const guidePages: ImportGuidePage[] = [
    // Cover page
    {
      title: "How to Import Your Playlists",
      content: (
        <div className="flex flex-col items-center justify-center h-full">
          <div className="mb-8 p-4 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full">
            <ArrowLeftRight className="h-12 w-12 text-white" />
          </div>
          <h2 className="text-xl md:text-2xl font-semibold mb-4 text-center">Mavrixfy</h2>
          <p className="text-lg text-center mb-8">Import Guide</p>
          <p className="text-sm text-zinc-300 text-center max-w-xs">
            Follow this step-by-step guide to import your playlists from other music platforms
          </p>
        </div>
      )
    },
    // Page 1
    {
      title: "Step 1: Get your playlist link",
      content: (
        <div className="space-y-4">
          <div className="flex items-center gap-2 mb-6">
            <div className="h-8 w-8 rounded-full bg-blue-500 flex items-center justify-center text-white font-bold">1</div>
            <h3 className="text-lg font-medium">Get your playlist from the original platform</h3>
          </div>

          <ol className="list-decimal ml-6 space-y-4 text-sm">
            <li className="pb-2 border-b border-zinc-700">
              <p className="mb-2">Open Mavrixfy, Apple Music, or another music platform</p>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mt-2">
                <div className="bg-zinc-800 p-2 rounded flex items-center justify-center">
                  <img src="/spotify.png" alt="Mavrixfy" className="h-8 w-8 object-contain" onError={(e) => {
                    (e.target as HTMLImageElement).src = 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAyNCAyNCIgZmlsbD0iIzFFRDc2MCI+PHBhdGggZD0iTTEyIDJDNi40NzcgMiAyIDYuNDc3IDIgMTJzNC40NzcgMTAgMTAgMTAgMTAtNC40NzcgMTAtMTBTMTcuNTIzIDIgMTIgMnptNC41ODYgMTQuNDI0YTAuNjIyIDAuNjIyIDAgMDEtLjg1Ny4yMDdjLTIuMzQ4LTEuNDM4LTUuMzA0LTEuNzYzLTguNzg1LTAuOTY3YTAuNjIyIDAuNjIyIDAgMDEtLjI1LTEuMjE4YzMuODA5LTAuODcxIDcuMDc3LTAuNDk2IDkuNjg2IDEuMTIxYTAuNjIyIDAuNjIyIDAgMDEwLjIwNiAwLjg1N3ptMS4yMjQtMi43MjdjLTAuMDc5IDAuMTMtMC4xOTEgMC4yMjctMC4zMjUgMC4yODRhMC43NzcgMC43NzcgMCAwMS0wLjc1My0wLjA1N2MtMi44NTQtMS43NTQtNy4yMDEtMi4yNjMtMTAuNTctMS4yMzlhMC43NzggMC43NzggMCAwMS0wLjQyOS0xLjQ5N2MzLjg1NS0xLjEwNyA4LjY1OC0wLjUxNyAxMS45NDMgMS41NDNhMC43NzcgMC43NzcgMCAwMS0wLjA1NSAxLjA3OGwwLjE4OS0wLjExMnptMC4xMDUtMi44MzVhMC45MzQgMC45MzQgMCAwMS0xLjI5MiAwLjI2N2MtMy4yNzQtMi4wMTQtOC42NTktMi4yLTExLjgwOC0xLjIxM2EwLjkzNyAwLjkzNyAwIDAxLTAuNTE1LTEuODA0YzMuNjA3LTEuMDc2IDkuNjA4LTAuODU5IDEzLjM1IDEuNDU3YTAuOTM0IDAuOTM0IDAgMDEwLjI2NSAxLjI5M3oiLz48L3N2Zz4=';
                  }} />
                </div>
                <div className="bg-zinc-800 p-2 rounded flex items-center justify-center">
                  <img src="/google.png" alt="Apple Music" className="h-8 w-8 object-contain" onError={(e) => {
                    (e.target as HTMLImageElement).src = 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAyNCAyNCIgZmlsbD0iI0ZBMjQzQyI+PHBhdGggZD0iTTEwLjc4IDQuMDY3QTIuMzY3IDIuMzY3IDAgMCAwIDEwLjI3OCAyQzguOTQyIDIuMDEgOC41NzcgMi44IDguNTc3IDIuOHMtLjYzMyAxLjUzMy0uMTMzIDMuMDY3Yy41NyAxLjczMyAxLjg2NyAyLjQ2NyAxLjg2NyAyLjQ2N3MuNjI3LTEuNDc3LS4wMS0zQzEwIDQuODY3IDEwLjc4IDQuMDY3IDEwLjc4IDQuMDY3TTEyLjYzIDE5LjY2N0M4LjYwMyAxOS4zMzMgMi40MzcgMjIgMi4zNyAyMmMtLjQuMjMzLjE5NyAxLjQgMS4zNjQgMS40IDAgMCAyLjMzMyAwIDQuNjY2LTIuMzMzIDEuMTU3LTEuMTU3IDIuNi0xLjgyNyAzLjcxNy0yLjA1IDEuMi0uMjQgMy4wNS0uNTE3IDUuMDE2LjIzM2wuNy4zNjdjLjY2Ny4zNjcgMS4zMzQuNDMzIDEuODM0LjA2NyAxLjI2My0uOTMzIDIuODMzLTguOTY3IDIuODMzLTguOTY3cy0uNjMzLTEuNTMzLTIuODMzLTEuNWMtMS40MzMgMC0xLjggMS4xMzMtMS44IDEuMTMzcy0uMzY3IDEuMS0uMzY3IDIuMTY3Yy0uMDMzIDEuNTMzLjQzNCA0LjkzMy0uNjY2IDcuMTMzczIuMzk2LS4zIDIuMzk2LS4zaC4wMzRjLTEuOC0uNzMzLTMtMi43NjctMy0yLjc2Ny0uMjY3IDEuNCAxIDEuOTY3IDEgMS45NjcgMCAwLTMuMzMzLTEuMzMzLTMuNjY3IDBaIi8+PC9zdmc+';
                  }} />
                </div>
                <div className="bg-zinc-800 p-2 rounded flex items-center justify-center">
                  <img src="/icons/youtube.svg" alt="YouTube Music" className="h-8 w-8 object-contain" onError={(e) => {
                    (e.target as HTMLImageElement).src = 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAyNCAyNCIgZmlsbD0iI0ZGMDAwMCI+PHBhdGggZD0iTTEyIDE4LjI2Yy0zLjc2OS4wMDItNy4wNjQtLjA5My03LjgxNS0uMjU0LTEuMTEyLS4yNC0xLjk3Mi0xLjA0MS0yLjE4My0yLjA0MS0uNDIyLTIuMDA5LS40MTctNC40MTEgMC02LjM4OS4yMTEtMS0uMDU0LTEuODQ1IDEuMDU4LTIuMDg1Ljc1MS0uMTYyIDMuNjgtLjI1NyA4Ljk0MS0uMjU1IDUuMjYtLjAwMiA4LjE5LjA5MyA4Ljk0MS4yNTVjMS4xMTIuMjQgMS44NjcuNzg1IDIuMDc4IDEuNzg1LjI0LjkzLjI0IDEuOTMzLjI0IDMuMTc1IDAgMS4yNDIgMCAyLjI0NC0uMjQgMy4xNzMtLjIxMSAxLS45NjYgMS41NDUtMi4wNzggMS43ODUtLjc1MS4xNjItNC41NDUuMjU3LTguOTQxLjI1NXptLTEuOTk5LTguMTI1djMuNzMzbDMuNDc4LTEuODY3LTMuNDc4LTEuODY2eiIvPjxjaXJjbGUgY3g9IjEyIiBjeT0iMTIiIHI9IjEwIiBzdHJva2U9IiNGRjAwMDAiIHN0cm9rZS13aWR0aD0iMS41IiBmaWxsPSJub25lIi8+PC9zdmc+';
                  }} />
                </div>
              </div>
            </li>
            <li className="pb-2 border-b border-zinc-700">
              <p className="mb-2">Find the playlist you want to import</p>
              <div className="bg-zinc-800 rounded-md p-2 text-xs">
                <div className="bg-zinc-700 h-3 w-2/3 rounded mb-2"></div>
                <div className="flex gap-2 items-center">
                  <div className="bg-green-900 h-10 w-10 rounded"></div>
                  <div>
                    <div className="bg-zinc-600 h-2 w-28 rounded mb-1"></div>
                    <div className="bg-zinc-600 h-2 w-20 rounded"></div>
                  </div>
                </div>
              </div>
            </li>
            <li>
              <p className="mb-2">Copy the playlist URL by using the share option</p>
              <div className="bg-zinc-800 rounded-md p-3 text-xs flex items-center gap-2 overflow-hidden">
                <code className="text-xs whitespace-nowrap overflow-hidden text-ellipsis">https://www.mavrixfy.site/playlist/sample</code>
                <button type="button" 
                  onClick={() => copyToClipboard('https://www.mavrixfy.site/playlist/sample')}
                  className="bg-zinc-700 hover:bg-zinc-600 p-1 rounded"
                >
                  <Copy className="h-3 w-3" />
                </button>
              </div>
            </li>
          </ol>
        </div>
      )
    },
    // Page 2
    {
      title: "Step 2: Convert to TXT/CSV file",
      content: (
        <div className="space-y-4">
          <div className="flex items-center gap-2 mb-6">
            <div className="h-8 w-8 rounded-full bg-blue-500 flex items-center justify-center text-white font-bold">2</div>
            <h3 className="text-lg font-medium">Convert the playlist to a file</h3>
          </div>

          <div className="bg-blue-500/10 border border-blue-500/30 rounded-md p-3 mb-4">
            <div className="flex items-center gap-2 mb-2">
              <ExternalLink className="h-4 w-4 text-blue-400" />
              <a 
                href="https://www.tunemymusic.com" 
                target="_blank" 
                rel="noopener noreferrer" 
                className="text-blue-400 font-medium hover:underline text-sm"
              >
                Visit TuneMyMusic.com
              </a>
            </div>
            <p className="text-xs text-zinc-300">This free service helps convert playlists between different platforms</p>
          </div>

          <div className="space-y-3 text-sm">
            <div className="flex gap-2">
              <div className="h-5 w-5 rounded-full bg-zinc-700 flex items-center justify-center text-xs">1</div>
              <p>Click on "Let's Start" and select your source platform</p>
            </div>
            <div className="flex gap-2">
              <div className="h-5 w-5 rounded-full bg-zinc-700 flex items-center justify-center text-xs">2</div>
              <p>Paste the playlist URL you copied</p>
            </div>
            <div className="flex gap-2">
              <div className="h-5 w-5 rounded-full bg-zinc-700 flex items-center justify-center text-xs">3</div>
              <p>After the songs load, click "Next"</p>
            </div>
            <div className="flex gap-2">
              <div className="h-5 w-5 rounded-full bg-zinc-700 flex items-center justify-center text-xs">4</div>
              <p>For the destination, choose "CSV File" or "Text File"</p>
            </div>
            <div className="flex gap-2">
              <div className="h-5 w-5 rounded-full bg-zinc-700 flex items-center justify-center text-xs">5</div>
              <p>Click "Start Moving My Music" and download the file</p>
            </div>
          </div>

          <div className="mt-4 pt-4 border-t border-zinc-700 flex justify-center">
            <div className="relative bg-zinc-800 rounded-md p-2 w-4/5 h-20 flex items-center justify-center">
              <div className="absolute top-2 right-2 h-3 w-3 bg-green-500 rounded-full animate-pulse"></div>
              <div className="text-center">
                <div className="h-2 w-20 bg-zinc-600 rounded mb-2 mx-auto"></div>
                <div className="h-8 w-32 bg-blue-600 rounded mx-auto flex items-center justify-center text-xs text-white font-medium">
                  Download
                </div>
              </div>
            </div>
          </div>
        </div>
      )
    },
    // Page 3
    {
      title: "Step 3: Import to Mavrixfy",
      content: (
        <div className="space-y-4">
          <div className="flex items-center gap-2 mb-6">
            <div className="h-8 w-8 rounded-full bg-blue-500 flex items-center justify-center text-white font-bold">3</div>
            <h3 className="text-lg font-medium">Import your file to Mavrixfy</h3>
          </div>

          <div className="space-y-3 text-sm">
            <div className="flex gap-2 items-start">
              <div className="h-5 w-5 rounded-full bg-zinc-700 flex-shrink-0 flex items-center justify-center text-xs">1</div>
              <div>
                <p className="mb-1">Click the "Select File" button below to upload your TXT or CSV file</p>
                <div className="bg-zinc-800 rounded-md p-2 flex items-center justify-center">
                  <Button 
                    size="sm" 
                    className="h-8 bg-zinc-700 hover:bg-zinc-600 flex items-center gap-1"
                    onClick={handleUploadClick}
                  >
                    <Upload className="h-3 w-3" />
                    <span className="text-xs">Select File</span>
                  </Button>
                </div>
              </div>
            </div>
            <div className="flex gap-2 items-start">
              <div className="h-5 w-5 rounded-full bg-zinc-700 flex-shrink-0 flex items-center justify-center text-xs">2</div>
              <div>
                <p className="mb-1">Review the songs found in your file</p>
                <div className="bg-zinc-800 rounded-md p-2">
                  <div className="h-2 w-full bg-zinc-700 rounded mb-1"></div>
                  <div className="h-2 w-full bg-zinc-700 rounded mb-1"></div>
                  <div className="h-2 w-3/4 bg-zinc-700 rounded"></div>
                </div>
              </div>
            </div>
            <div className="flex gap-2 items-start">
              <div className="h-5 w-5 rounded-full bg-zinc-700 flex-shrink-0 flex items-center justify-center text-xs">3</div>
              <div>
                <p className="mb-1">Click "Add Songs" to import them to your playlist</p>
                <div className="bg-zinc-800 rounded-md p-2 flex items-center justify-center">
                  <Button 
                    size="sm" 
                    className="h-8 bg-green-600 hover:bg-green-700 flex items-center gap-1"
                  >
                    <ArrowRight className="h-3 w-3" />
                    <span className="text-xs">Add Songs</span>
                  </Button>
                </div>
              </div>
            </div>
          </div>

          <div className="mt-6 pt-3 border-t border-zinc-700">
            <div className="bg-green-500/20 p-3 rounded-md border border-green-500/30 text-center">
              <p className="text-green-400 font-medium text-sm flex items-center justify-center gap-2">
                <Check className="h-4 w-4" />
                Ready to import your favorite playlists!
              </p>
            </div>
          </div>
        </div>
      )
    }
  ];

  return (
    <div className="w-full">
      {/* Show the guide if this is the first time */}
      {showGuide && (
        <ImportGuide
          currentPage={currentPage}
          onClose={() => setState(prev => ({ ...prev, showGuide: false }))}
          onPageChange={(page) => setState(prev => ({ ...prev, currentPage: Math.max(0, Math.min(page, 3 - 1)) }))}
          onUploadClick={handleUploadClick}
          copyToClipboard={copyToClipboard}
        />
      )}

      {/* File upload area */}
      {!parsedSongs.length && !isUploading && !showGuide && (
        <FileSelectionView
          fileInputRef={fileInputRef}
          handleFileChange={handleFileChange}
          handleUploadClick={handleUploadClick}
          onShowGuide={() => setState(prev => ({ ...prev, showGuide: true }))}
        />
      )}

      {/* File upload progress */}
      {isUploading && (
        <ContentLoading text={`Reading file... ${fileName}`} height="border rounded-lg p-6" />
      )}

      {/* Parsed songs list */}
      {parsedSongs.length > 0 && !isProcessing && !isComplete && (
        <ParsedSongsListView
          parsedSongs={parsedSongs}
          onReset={resetUpload}
          onRemoveSong={removeSong}
          onAddSongs={addSongsToPlaylist}
        />
      )}

      {/* Processing display */}
      {isProcessing && !isComplete && displaySongs.length > 0 && (
        <ProcessingSongsView
          addedSongsCount={addedSongsCount}
          totalSongs={displaySongs.length}
          progress={progress}
          displaySongs={displaySongs}
        />
      )}

      {/* Completion summary */}
      {isComplete && (
        <ImportCompletionView
          addedSongsCount={addedSongsCount}
          totalSongs={parsedSongs.length}
          parsedSongs={parsedSongs}
          onFinish={finishAndViewPlaylist}
          onReset={resetUpload}
        />
      )}
    </div>
  );
};
