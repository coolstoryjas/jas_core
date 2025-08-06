import { useState, useRef } from "react";
import { WindowFrame } from "@/components/layout/WindowFrame";
import { ControlPanelsMenuBar } from "./ControlPanelsMenuBar";
import { HelpDialog } from "@/components/dialogs/HelpDialog";
import { AboutDialog } from "@/components/dialogs/AboutDialog";
import { ConfirmDialog } from "@/components/dialogs/ConfirmDialog";
import { helpItems, appMetadata } from "..";
import { Button } from "@/components/ui/button";
import { AppProps, ControlPanelsInitialData } from "@/apps/base/types";
import { clearAllAppStates } from "@/stores/useAppStore";
import { useFileSystem } from "@/apps/finder/hooks/useFileSystem";
import { useAppStoreShallow } from "@/stores/helpers";
import { setNextBootMessage } from "@/utils/bootMessage";
import React from "react";
import { useThemeStore } from "@/stores/useThemeStore";

export function ControlPanelsAppComponent({
  isWindowOpen,
  onClose,
  isForeground,
  skipInitialSound,
  initialData,
  instanceId,
  onNavigateNext,
  onNavigatePrevious,
}: AppProps<ControlPanelsInitialData>) {
  const [isHelpDialogOpen, setIsHelpDialogOpen] = useState(false);
  const [isAboutDialogOpen, setIsAboutDialogOpen] = useState(false);
  const [isConfirmResetOpen, setIsConfirmResetOpen] = useState(false);
  const [isConfirmFormatOpen, setIsConfirmFormatOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { formatFileSystem } = useFileSystem();

  const {
    debugMode,
    setDebugMode,
    shaderEffectEnabled,
    setShaderEffectEnabled,
    aiModel,
    setAiModel,
    uiVolume,
    setUiVolume,
    chatSynthVolume,
    setChatSynthVolume,
    speechVolume,
    setSpeechVolume,
    ipodVolume,
    setIpodVolume,
    masterVolume,
    setMasterVolume,
    setCurrentWallpaper,
  } = useAppStoreShallow((s) => ({
    debugMode: s.debugMode,
    setDebugMode: s.setDebugMode,
    shaderEffectEnabled: s.shaderEffectEnabled,
    setShaderEffectEnabled: s.setShaderEffectEnabled,
    aiModel: s.aiModel,
    setAiModel: s.setAiModel,
    uiVolume: s.uiVolume,
    setUiVolume: s.setUiVolume,
    chatSynthVolume: s.chatSynthVolume,
    setChatSynthVolume: s.setChatSynthVolume,
    speechVolume: s.speechVolume,
    setSpeechVolume: s.setSpeechVolume,
    ipodVolume: s.ipodVolume,
    setIpodVolume: s.setIpodVolume,
    masterVolume: s.masterVolume,
    setMasterVolume: s.setMasterVolume,
    setCurrentWallpaper: s.setCurrentWallpaper,
  }));

  const { current: currentTheme } = useThemeStore();

  const handleConfirmReset = () => {
    setIsConfirmResetOpen(false);
    setNextBootMessage("Resetting System...");
    performReset();
  };

  const performReset = () => {
    const fileMetadataStore = localStorage.getItem("ryos:files");
    clearAllAppStates();
    if (fileMetadataStore) {
      localStorage.setItem("ryos:files", fileMetadataStore);
    }
    window.location.reload();
  };

  const performFormat = async () => {
    setCurrentWallpaper("/wallpapers/videos/blue_flowers_loop.mp4");
    await formatFileSystem();
    setNextBootMessage("Formatting File System...");
    window.location.reload();
  };

  const handleConfirmFormat = () => {
    setIsConfirmFormatOpen(false);
    setNextBootMessage("Formatting File System...");
    performFormat();
  };

  const menuBar = (
    <ControlPanelsMenuBar
      onClose={onClose}
      onShowHelp={() => setIsHelpDialogOpen(true)}
      onShowAbout={() => setIsAboutDialogOpen(true)}
    />
  );

  if (!isWindowOpen) return null;

  return (
    <>
      {isForeground && menuBar}
      <WindowFrame
        title="Control Panels"
        onClose={onClose}
        isForeground={isForeground}
        appId="control-panels"
        skipInitialSound={skipInitialSound}
        instanceId={instanceId}
        onNavigateNext={onNavigateNext}
        onNavigatePrevious={onNavigatePrevious}
        menuBar={menuBar}
      >
        <div className="flex flex-col h-full w-full p-4">
          <p className="text-sm text-gray-700">
            Control Panels simplified – login functionality removed.
          </p>
        </div>

        <HelpDialog
          isOpen={isHelpDialogOpen}
          onOpenChange={setIsHelpDialogOpen}
          helpItems={helpItems}
          appName="Control Panels"
        />
        <AboutDialog
          isOpen={isAboutDialogOpen}
          onOpenChange={setIsAboutDialogOpen}
          metadata={appMetadata}
        />
        <ConfirmDialog
          isOpen={isConfirmResetOpen}
          onOpenChange={setIsConfirmResetOpen}
          onConfirm={handleConfirmReset}
          title="Reset All Settings"
          description="Are you sure you want to reset all settings? This will clear all saved settings and restore default states. ryOS will restart after reset."
        />
        <ConfirmDialog
          isOpen={isConfirmFormatOpen}
          onOpenChange={setIsConfirmFormatOpen}
          onConfirm={handleConfirmFormat}
          title="Format File System"
          description="Are you sure you want to format the file system? This will permanently delete all documents (except sample documents), images, and custom wallpapers. ryOS will restart after format."
        />
      </WindowFrame>
    </>
  );
}
