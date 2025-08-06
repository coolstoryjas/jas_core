import { Button } from "@/components/ui/button";
import { MenuBar } from "@/components/layout/MenuBar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuSub,
  DropdownMenuSubTrigger,
  DropdownMenuSubContent,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { useIpodStoreShallow } from "@/stores/helpers";
import { toast } from "sonner";
import { generateAppShareUrl } from "@/utils/sharedUrl";
import { useThemeStore } from "@/stores/useThemeStore";

interface IpodMenuBarProps {
  onClose: () => void;
  onShowHelp: () => void;
  onShowAbout: () => void;
  onClearLibrary: () => void;
  onSyncLibrary: () => void;
  onAddTrack: () => void;
  onShareSong: () => void;
}

export function IpodMenuBar({
  onClose,
  onShowHelp,
  onShowAbout,
  onClearLibrary,
  onSyncLibrary,
  onAddTrack,
  onShareSong,
}: IpodMenuBarProps) {
  const {
    tracks,
    currentIndex,
    isLoopAll,
    isLoopCurrent,
    isPlaying,
    isShuffled,
    isBacklightOn,
    isVideoOn,
    isLcdFilterOn,
    currentTheme,
    isFullScreen,
    // Actions
    setCurrentIndex,
    setIsPlaying,
    toggleLoopAll,
    toggleLoopCurrent,
    toggleShuffle,
    togglePlay,
    nextTrack,
    previousTrack,
    toggleBacklight,
    toggleVideo,
    toggleLcdFilter,
    toggleFullScreen,
    setTheme,
    importLibrary,
    exportLibrary,
  } = useIpodStoreShallow((s) => ({
    tracks: s.tracks,
    currentIndex: s.currentIndex,
    isLoopAll: s.loopAll,
    isLoopCurrent: s.loopCurrent,
    isPlaying: s.isPlaying,
    isShuffled: s.isShuffled,
    isBacklightOn: s.backlightOn,
    isVideoOn: s.showVideo,
    isLcdFilterOn: s.lcdFilterOn,
    currentTheme: s.theme,
    isFullScreen: s.isFullScreen,
    setCurrentIndex: s.setCurrentIndex,
    setIsPlaying: s.setIsPlaying,
    toggleLoopAll: s.toggleLoopAll,
    toggleLoopCurrent: s.toggleLoopCurrent,
    toggleShuffle: s.toggleShuffle,
    togglePlay: s.togglePlay,
    nextTrack: s.nextTrack,
    previousTrack: s.previousTrack,
    toggleBacklight: s.toggleBacklight,
    toggleVideo: s.toggleVideo,
    toggleLcdFilter: s.toggleLcdFilter,
    toggleFullScreen: s.toggleFullScreen,
    setTheme: s.setTheme,
    importLibrary: s.importLibrary,
    exportLibrary: s.exportLibrary,
  }));

  const appTheme = useThemeStore((state) => state.current);
  const isXpTheme = appTheme === "xp" || appTheme === "win98";

  const handlePlayTrack = (index: number) => {
    setCurrentIndex(index);
    setIsPlaying(true);
  };

  // Group tracks by artist
  const tracksByArtist = tracks.reduce<
    Record<string, { track: (typeof tracks)[0]; index: number }[]>
  >((acc, track, index) => {
    const artist = track.artist || "Unknown Artist";
    if (!acc[artist]) acc[artist] = [];
    acc[artist].push({ track, index });
    return acc;
  }, {});

  const artists = Object.keys(tracksByArtist).sort((a, b) =>
    a.localeCompare(b, undefined, { sensitivity: "base" })
  );

  const handleExportLibrary = () => {
    try {
      const json = exportLibrary();
      const blob = new Blob([json], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "ipod-library.json";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast.success("Library exported successfully");
    } catch (error) {
      console.error("Failed to export library:", error);
      toast.error("Failed to export library");
    }
  };

  const handleImportLibrary = () => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".json";
    input.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;

      const reader = new FileReader();
      reader.onload = (event) => {
        try {
          const json = event.target?.result as string;
          importLibrary(json);
          toast.success("Library imported successfully");
        } catch (error) {
          console.error("Failed to import library:", error);
          toast.error("Invalid library format");
        }
      };
      reader.readAsText(file);
    };
    input.click();
  };

  return (
    <MenuBar inWindowFrame={isXpTheme}>
      {/* File Menu */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="default" className="h-6 text-md px-2 py-1">
            File
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" sideOffset={1} className="px-0">
          <DropdownMenuItem onClick={onAddTrack}>Add Song...</DropdownMenuItem>
          <DropdownMenuItem
            onClick={onShareSong}
            disabled={tracks.length === 0 || currentIndex === -1}
          >
            Share Song...
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            onClick={handleExportLibrary}
            disabled={tracks.length === 0}
          >
            Export Library...
          </DropdownMenuItem>
          <DropdownMenuItem onClick={handleImportLibrary}>
            Import Library...
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={onClose}>Close</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Controls Menu */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="default" className="h-6 px-2 py-1 text-md">
            Controls
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" sideOffset={1} className="px-0">
          <DropdownMenuItem onClick={togglePlay} disabled={tracks.length === 0}>
            {isPlaying ? "Pause" : "Play"}
          </DropdownMenuItem>
          <DropdownMenuItem onClick={previousTrack} disabled={tracks.length === 0}>
            Previous
          </DropdownMenuItem>
          <DropdownMenuItem onClick={nextTrack} disabled={tracks.length === 0}>
            Next
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={toggleShuffle}>
            {isShuffled ? "✓ Shuffle" : "Shuffle"}
          </DropdownMenuItem>
          <DropdownMenuItem onClick={toggleLoopAll}>
            {isLoopAll ? "✓ Repeat All" : "Repeat All"}
          </DropdownMenuItem>
          <DropdownMenuItem onClick={toggleLoopCurrent}>
            {isLoopCurrent ? "✓ Repeat One" : "Repeat One"}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {/* View Menu */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="default" className="h-6 px-2 py-1 text-md">
            View
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" sideOffset={1} className="px-0">
          <DropdownMenuItem onClick={toggleBacklight}>
            {isBacklightOn ? "✓ Backlight" : "Backlight"}
          </DropdownMenuItem>
          <DropdownMenuItem onClick={toggleLcdFilter}>
            {isLcdFilterOn ? "✓ LCD Filter" : "LCD Filter"}
          </DropdownMenuItem>
          <DropdownMenuItem onClick={toggleVideo} disabled={!isPlaying}>
            {isVideoOn ? "✓ Video" : "Video"}
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={() => setTheme("classic")}>
            {currentTheme === "classic" ? "✓ Classic" : "Classic"}
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => setTheme("black")}>
            {currentTheme === "black" ? "✓ Black" : "Black"}
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => setTheme("u2")}>
            {currentTheme === "u2" ? "✓ U2" : "U2"}
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={toggleFullScreen}>
            {isFullScreen ? "✓ Full Screen" : "Full Screen"}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Library Menu */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="default" className="h-6 px-2 py-1 text-md">
            Library
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" sideOffset={1} className="px-0 max-w-[220px]">
          <DropdownMenuItem onClick={onAddTrack}>Add to Library...</DropdownMenuItem>

          {tracks.length > 0 && (
            <>
              <DropdownMenuSeparator />
              {/* All Tracks */}
              <DropdownMenuSub>
                <DropdownMenuSubTrigger>All Songs</DropdownMenuSubTrigger>
                <DropdownMenuSubContent className="px-0 max-h-[400px] overflow-y-auto">
                  {tracks.map((track, index) => (
                    <DropdownMenuItem
                      key={`all-${track.id}`}
                      onClick={() => handlePlayTrack(index)}
                      className={cn(index === currentIndex && "bg-gray-200")}
                    >
                      {index === currentIndex ? "♪ " : ""}
                      {track.title}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuSubContent>
              </DropdownMenuSub>

              {/* By Artist */}
              <div className="max-h-[300px] overflow-y-auto">
                {artists.map((artist) => (
                  <DropdownMenuSub key={artist}>
                    <DropdownMenuSubTrigger>{artist}</DropdownMenuSubTrigger>
                    <DropdownMenuSubContent className="px-0 max-h-[200px] overflow-y-auto">
                      {tracksByArtist[artist].map(({ track, index }) => (
                        <DropdownMenuItem
                          key={`${artist}-${track.id}`}
                          onClick={() => handlePlayTrack(index)}
                          className={cn(index === currentIndex && "bg-gray-200")}
                        >
                          {index === currentIndex ? "♪ " : ""}
                          {track.title}
                        </DropdownMenuItem>
                      ))}
                    </DropdownMenuSubContent>
                  </DropdownMenuSub>
                ))}
              </div>

              <DropdownMenuSeparator />
            </>
          )}

          <DropdownMenuItem onClick={onClearLibrary}>Clear Library...</DropdownMenuItem>
          <DropdownMenuItem onClick={onSyncLibrary}>Sync Library...</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Help Menu */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="default" className="h-6 px-2 py-1 text-md">
            Help
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" sideOffset={1} className="px-0">
          <DropdownMenuItem onClick={onShowHelp}>iPod Help</DropdownMenuItem>
          <DropdownMenuItem
            onSelect={async () => {
              const appId = "ipod";
              const shareUrl = generateAppShareUrl(appId);
              if (!shareUrl) return;
              try {
                await navigator.clipboard.writeText(shareUrl);
                toast.success("App link copied!", {
                  description: `Link to ${appId} copied to clipboard.`,
                });
              } catch (err) {
                toast.error("Failed to copy link");
              }
            }}
          >
            Share App...
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={onShowAbout}>About iPod</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </MenuBar>
  );
}
