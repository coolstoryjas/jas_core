import { useState, useRef } from "react";
import { WindowFrame } from "@/components/layout/WindowFrame";
import { ControlPanelsMenuBar } from "./ControlPanelsMenuBar";
import { HelpDialog } from "@/components/dialogs/HelpDialog";
import { AboutDialog } from "@/components/dialogs/AboutDialog";
import { ConfirmDialog } from "@/components/dialogs/ConfirmDialog";
import { LoginDialog } from "@/components/dialogs/LoginDialog";
import { InputDialog } from "@/components/dialogs/InputDialog";
import { LogoutDialog } from "@/components/dialogs/LogoutDialog";
import { helpItems, appMetadata } from "..";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { WallpaperPicker } from "./WallpaperPicker";
import { AppProps, ControlPanelsInitialData } from "@/apps/base/types";
import { clearAllAppStates } from "@/stores/useAppStore";
import { ensureIndexedDBInitialized } from "@/utils/indexedDB";
import { SYNTH_PRESETS } from "@/hooks/useChatSynth";
import { useFileSystem } from "@/apps/finder/hooks/useFileSystem";
import { useAppStoreShallow } from "@/stores/helpers";
import { setNextBootMessage, clearNextBootMessage } from "@/utils/bootMessage";
import { AIModel, AI_MODEL_METADATA } from "@/types/aiModels";
import { VolumeMixer } from "./VolumeMixer";
import { v4 as uuidv4 } from "uuid";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import React from "react";
import { useThemeStore } from "@/stores/useThemeStore";
import { themes } from "@/themes";
import { OsThemeId } from "@/themes/types";
import { getTabStyles } from "@/utils/tabStyles";

interface StoreItem {
  name: string;
  content?: string;
  type?: string;
  modifiedAt?: string;
  size?: number;
  [key: string]: unknown;
}

interface StoreItemWithKey {
  key: string;
  value: StoreItem;
}

type PhotoCategory =
  | "3d_graphics"
  | "convergency"
  | "foliage"
  | "landscapes"
  | "nostalgia"
  | "objects"
  | "structures";

const PHOTO_WALLPAPERS: Record<PhotoCategory, string[]> = {
  "3d_graphics": [
    "capsule",
    "capsule_azul",
    "capsule_pistachio",
    "tub",
    "tub_azul",
    "tub_bondi",
    "ufo_1",
    "ufo_2",
    "ufo_3",
  ],
  convergency: Array.from({ length: 15 }, (_, i) => `convergence_${i + 1}`),
  foliage: [
    "blue_flowers",
    "cactus",
    "golden_poppy",
    "red_cyclamens",
    "red_tulips",
    "rose",
    "spider_lily",
    "waterdrops_on_leaf",
    "yellow_tulips",
  ],
  landscapes: [
    "beach",
    "clouds",
    "french_alps",
    "ganges_river",
    "golden_gate_at_dusk",
    "mono_lake",
    "palace_on_lake_in_jaipur",
    "rain_god_mesa",
    "refuge-col_de_la-grasse-alps",
    "zabriskie_point",
  ],
  nostalgia: [
    "acropolis",
    "beach_on_ko_samui",
    "birds_in_flight",
    "cancun_sunset",
    "cliffs_of_moher",
    "fish_eagle",
    "galway_bay",
    "glacier_national_park",
    "highway_395",
    "hong_kong_at_night",
    "islamorada_sunrise",
    "lily_pad",
    "long_island_sound",
    "mac_os_background",
    "midsummer_night",
    "moraine_lake",
    "oasis_in_baja",
    "red_clouds",
    "toronto_skyline",
    "tuolumne_meadows",
    "yosemite_valley",
    "yucatan",
  ],
  objects: [
    "alpine_granite",
    "bicycles",
    "bottles",
    "burmese_claypots",
    "burning_candle",
    "chairs",
    "faucet_handle",
    "neon",
    "salt_shaker_top",
    "shamus",
  ],
  structures: [
    "gate",
    "gate_lock",
    "glass_door_knob",
    "padlock",
    "rusty_lock",
    "shutters",
    "stone_wall",
    "wall_of_stones",
  ],
};

// Transform photo paths
Object.entries(PHOTO_WALLPAPERS).forEach(([category, photos]) => {
  PHOTO_WALLPAPERS[category as PhotoCategory] = photos.map(
    (name) => `/wallpapers/photos/${category}/${name}.jpg`
  );
});

// Use shared AI model metadata
const AI_MODELS = AI_MODEL_METADATA;

// Utility to convert Blob to base64 string for JSON serialization
const blobToBase64 = (blob: Blob): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const dataUrl = reader.result as string; // data:<mime>;base64,xxxx
      resolve(dataUrl);
    };
    reader.onerror = (error) => {
      console.error("Error converting blob to base64:", error);
      reject(error);
    };
    reader.readAsDataURL(blob);
  });

// Utility to convert base64 data URL back to Blob
const base64ToBlob = (dataUrl: string): Blob => {
  const [meta, base64] = dataUrl.split(",");
  const mimeMatch = meta.match(/data:(.*);base64/);
  const mime = mimeMatch ? mimeMatch[1] : "application/octet-stream";
  const binary = atob(base64);
  const array = Uint8Array.from(binary, (c) => c.charCodeAt(0));
  return new Blob([array], { type: mime });
};

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
  const fileToRestoreRef = useRef<File | null>(null);
  const { formatFileSystem } = useFileSystem();
  const {
    debugMode,
    setDebugMode,
    shaderEffectEnabled,
    setShaderEffectEnabled,
    aiModel,
    setAiModel,
    terminalSoundsEnabled,
    setTerminalSoundsEnabled,
    uiSoundsEnabled,
    setUiSoundsEnabled,
    uiVolume,
    setUiVolume,
    speechEnabled,
    setSpeechEnabled,
    chatSynthVolume,
    setChatSynthVolume,
    speechVolume,
    setSpeechVolume,
    ttsModel,
    setTtsModel,
    ttsVoice,
    setTtsVoice,
    synthPreset,
    setSynthPreset,
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
    terminalSoundsEnabled: s.terminalSoundsEnabled,
    setTerminalSoundsEnabled: s.setTerminalSoundsEnabled,
    uiSoundsEnabled: s.uiSoundsEnabled,
    setUiSoundsEnabled: s.setUiSoundsEnabled,
    uiVolume: s.uiVolume,
    setUiVolume: s.setUiVolume,
    speechEnabled: s.speechEnabled,
    setSpeechEnabled: s.setSpeechEnabled,
    chatSynthVolume: s.chatSynthVolume,
    setChatSynthVolume: s.setChatSynthVolume,
    speechVolume: s.speechVolume,
    setSpeechVolume: s.setSpeechVolume,
    ttsModel: s.ttsModel,
    setTtsModel: s.setTtsModel,
    ttsVoice: s.ttsVoice,
    setTtsVoice: s.setTtsVoice,
    synthPreset: s.synthPreset,
    setSynthPreset: s.setSynthPreset,
    ipodVolume: s.ipodVolume,
    setIpodVolume: s.setIpodVolume,
    masterVolume: s.masterVolume,
    setMasterVolume: s.setMasterVolume,
    setCurrentWallpaper: s.setCurrentWallpaper,
  }));

  // Theme state
  const { current: currentTheme, setTheme } = useThemeStore();

  // Use auth hook (left intact; UI removed)
  const {
      // keep (used by dialogs)
    promptSetUsername,
    isUsernameDialogOpen,
    setIsUsernameDialogOpen,
    newUsername,
    setNewUsername,
    newPassword,
    setNewPassword,
    isSettingUsername,
    usernameError,
    submitUsernameDialog,

      // login dialog
    isVerifyDialogOpen,
    setVerifyDialogOpen,
    verifyPasswordInput,
    setVerifyPasswordInput,
    verifyUsernameInput,
    setVerifyUsernameInput,
    isVerifyingToken,
    verifyError,
    handleVerifyTokenSubmit,

    // password/logout dialog
    hasPassword,
    setPassword,
    confirmLogout,
    isLogoutConfirmDialogOpen,
    setIsLogoutConfirmDialogOpen,
  } = useAuth();

  // Password dialog states
  const [isPasswordDialogOpen, setIsPasswordDialogOpen] = useState(false);
  const [passwordInput, setPasswordInput] = useState("");
  const [isSettingPassword, setIsSettingPassword] = useState(false);
  const [passwordError, setPasswordError] = useState<string | null>(null);

  React.useEffect(() => {
    console.log(
      "[ControlPanel] hasPassword value:",
      hasPassword,
      "type:",
      typeof hasPassword
    );
  }, [hasPassword]);

  const handleSetPassword = async (password: string) => {
    setIsSettingPassword(true);
    setPasswordError(null);

    if (!password || password.length < 8) {
      setPasswordError("Password must be at least 8 characters");
      setIsSettingPassword(false);
      return;
    }

    const result = await setPassword(password);

    if (result.ok) {
      toast.success("Password Set", {
        description: "You can now use your password to recover your account",
      });
      setIsPasswordDialogOpen(false);
      setPasswordInput("");
    } else {
      setPasswordError(result.error || "Failed to set password");
    }

    setIsSettingPassword(false);
  };

      const data = await response.json();

      if (response.ok) {
        toast.success("Logged Out", {
          description: data.message || "Logged out from all devices",
        });
        confirmLogout();
      } else {
        toast.error("Logout Failed", {
          description: data.error || "Failed to logout from all devices",
        });
      }
    } catch (error) {
      console.error("Error logging out all devices:", error);
      toast.error("Network Error", {
        description: "Failed to connect to server",
      });
    } finally {
      setIsLoggingOutAllDevices(false);
    }
  };

  const [prevMasterVolume, setPrevMasterVolume] = useState(
    masterVolume > 0 ? masterVolume : 1
  );
  const [prevUiVolume, setPrevUiVolume] = useState(uiVolume > 0 ? uiVolume : 1);
  const [prevSpeechVolume, setPrevSpeechVolume] = useState(
    speechVolume > 0 ? speechVolume : 1
  );
  const [prevChatSynthVolume, setPrevChatSynthVolume] = useState(
    chatSynthVolume > 0 ? chatSynthVolume : 1
  );
  const [prevIpodVolume, setPrevIpodVolume] = useState(
    ipodVolume > 0 ? ipodVolume : 1
  );

  const isIOS =
    typeof navigator !== "undefined" &&
    /iP(hone|od|ad)/.test(navigator.userAgent);

  const handleUISoundsChange = (enabled: boolean) => {
    setUiSoundsEnabled(enabled);
  };

  const handleSpeechChange = (enabled: boolean) => {
    setSpeechEnabled(enabled);
  };

  const handleSynthPresetChange = (value: string) => {
    setSynthPreset(value);
  };

  const handleMasterMuteToggle = () => {
    if (masterVolume > 0) {
      setPrevMasterVolume(masterVolume);
      setMasterVolume(0);
    } else {
      setMasterVolume(prevMasterVolume);
    }
  };

  const handleUiMuteToggle = () => {
    if (uiVolume > 0) {
      setPrevUiVolume(uiVolume);
      setUiVolume(0);
    } else {
      setUiVolume(prevUiVolume);
    }
  };

  const handleSpeechMuteToggle = () => {
    if (speechVolume > 0) {
      setPrevSpeechVolume(speechVolume);
      setSpeechVolume(0);
    } else {
      setSpeechVolume(prevSpeechVolume);
    }
  };

  const handleChatSynthMuteToggle = () => {
    if (chatSynthVolume > 0) {
      setPrevChatSynthVolume(chatSynthVolume);
      setChatSynthVolume(0);
    } else {
      setChatSynthVolume(prevChatSynthVolume);
    }
  };

  const handleIpodMuteToggle = () => {
    if (isIOS) return;
    if (ipodVolume > 0) {
      setPrevIpodVolume(ipodVolume);
      setIpodVolume(0);
    } else {
      setIpodVolume(prevIpodVolume);
    }
  };

  const handleResetAll = () => {
    setIsConfirmResetOpen(true);
  };

  const handleConfirmReset = () => {
    setIsConfirmResetOpen(false);
    setNextBootMessage("Resetting System...");
    performReset();
  };

  const performReset = () => {
    const fileMetadataStore = localStorage.getItem("ryos:files");
    const usernameRecovery = localStorage.getItem("_usr_recovery_key_");
    const authTokenRecovery = localStorage.getItem("_auth_recovery_key_");

    clearAllAppStates();

    if (fileMetadataStore) {
      localStorage.setItem("ryos:files", fileMetadataStore);
    }
    if (usernameRecovery) {
      localStorage.setItem("_usr_recovery_key_", usernameRecovery);
    }
    if (authTokenRecovery) {
      localStorage.setItem("_auth_recovery_key_", authTokenRecovery);
    }

    window.location.reload();
  };

  const handleBackup = async () => {
    const backup: {
      localStorage: Record<string, string | null>;
      indexedDB: {
        documents: StoreItemWithKey[];
        images: StoreItemWithKey[];
        trash: StoreItemWithKey[];
        custom_wallpapers: StoreItemWithKey[];
      };
      timestamp: string;
      version: number;
    } = {
      localStorage: {},
      indexedDB: { documents: [], images: [], trash: [], custom_wallpapers: [] },
      timestamp: new Date().toISOString(),
      version: 2,
    };

    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key) {
        backup.localStorage[key] = localStorage.getItem(key);
      }
    }

    try {
      const db = await ensureIndexedDBInitialized();
      const getStoreData = async (
        storeName: string
      ): Promise<StoreItemWithKey[]> => {
        return new Promise((resolve, reject) => {
          try {
            const transaction = db.transaction(storeName, "readonly");
            const store = transaction.objectStore(storeName);
            const items: StoreItemWithKey[] = [];
            const request = store.openCursor();
            request.onsuccess = (event) => {
              const cursor = (event.target as IDBRequest<IDBCursorWithValue>)
                .result;
              if (cursor) {
                items.push({ key: cursor.key as string, value: cursor.value });
                cursor.continue();
              } else {
                resolve(items);
              }
            };
            request.onerror = () => reject(request.error);
          } catch (error) {
            console.error(`Error accessing store ${storeName}:`, error);
            resolve([]);
          }
        });
      };

      const [docs, imgs, trash, walls] = await Promise.all([
        getStoreData("documents"),
        getStoreData("images"),
        getStoreData("trash"),
        getStoreData("custom_wallpapers"),
      ]);

      const serializeStore = async (items: StoreItemWithKey[]) =>
        Promise.all(
          items.map(async (item) => {
            const serializedValue: Record<string, unknown> = { ...item.value };
            for (const key of Object.keys(item.value)) {
              if (item.value[key] instanceof Blob) {
                const base64 = await blobToBase64(item.value[key] as Blob);
                serializedValue[key] = base64;
                serializedValue[`_isBlob_${key}`] = true;
              }
            }
            return { key: item.key, value: serializedValue as StoreItem };
          })
        );

      backup.indexedDB.documents = await serializeStore(docs);
      backup.indexedDB.images = await serializeStore(imgs);
      backup.indexedDB.trash = await serializeStore(trash);
      backup.indexedDB.custom_wallpapers = await serializeStore(walls);
      db.close();
    } catch (error) {
      console.error("Error backing up IndexedDB:", error);
      alert("Failed to backup file system data. Only settings will be backed up.");
    }

    const jsonString = JSON.stringify(backup);

    try {
      if (typeof CompressionStream === "undefined") {
        throw new Error("CompressionStream API not available in this browser");
      }

      const encoder = new TextEncoder();
      const inputData = encoder.encode(jsonString);

      const readableStream = new ReadableStream({
        start(controller) {
          controller.enqueue(inputData);
          controller.close();
        },
      });

      const compressionStream = new CompressionStream("gzip");
      const compressedStream = readableStream.pipeThrough(compressionStream);

      const chunks: Uint8Array[] = [];
      const reader = compressedStream.getReader();

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        chunks.push(value);
      }

      const compressedBlob = new Blob(chunks, { type: "application/gzip" });

      const url = URL.createObjectURL(compressedBlob);
      const a = document.createElement("a");
      a.href = url;
      const timestamp = new Date()
        .toISOString()
        .replace(/[:.]/g, "-")
        .split("T")
        .join("-")
        .slice(0, -5);
      a.download = `ryOS-backup-${timestamp}.gz`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (compressionError) {
      console.error("Compression failed:", compressionError);
      alert(
        `Failed to create compressed backup: ${
          compressionError instanceof Error
            ? compressionError.message
            : "Unknown error"
        }`
      );
    }
  };

  const handleRestore = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    fileToRestoreRef.current = file;
    performRestore();
  };

  const performRestore = async () => {
    const file = fileToRestoreRef.current;
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        let data: string;

        if (file.name.endsWith(".gz")) {
          try {
            const arrayBuffer = e.target?.result as ArrayBuffer;
            const compressedResponse = new Response(arrayBuffer);
            const compressedStream = compressedResponse.body;
            if (!compressedStream) {
              throw new Error("Failed to create stream from compressed data");
            }
            const decompressionStream = new DecompressionStream("gzip");
            const decompressedStream =
              compressedStream.pipeThrough(decompressionStream);
            const decompressedResponse = new Response(decompressedStream);
            data = await decompressedResponse.text();
          } catch (decompressionError) {
            console.error("Decompression failed:", decompressionError);
            throw new Error(
              `Failed to decompress backup file: ${
                decompressionError instanceof Error
                  ? decompressionError.message
                  : "Unknown error"
              }`
            );
          }
        } else {
          data = e.target?.result as string;
        }

        let backup;
        try {
          backup = JSON.parse(data);
        } catch (parseError) {
          console.error("JSON parse error:", parseError);
          console.error("Data preview:", data.substring(0, 200));
          throw new Error("Invalid backup file format - not valid JSON");
        }

        if (!backup || typeof backup !== "object") {
          throw new Error("Invalid backup structure - expected an object");
        }

        let isOldBackupFormat = false;
        if (!backup.version || backup.version < 2) {
          isOldBackupFormat = true;
          console.log(
            "[Restore] Detected old backup format (no version or version < 2)"
          );
        } else if (backup.localStorage && backup.localStorage["ryos:files"]) {
          try {
            const filesDataStr = backup.localStorage["ryos:files"];
            const filesData = filesDataStr ? JSON.parse(filesDataStr) : {};
            if (filesData.state && filesData.state.items) {
              const fileItems = (
                Object.values(filesData.state.items) as Array<
                  Record<string, unknown>
                >
              ).filter(
                (item) => !(item as { isDirectory?: boolean }).isDirectory
              );
              isOldBackupFormat =
                fileItems.length > 0 &&
                fileItems.every((item) => !(item as { uuid?: string }).uuid);
              if (isOldBackupFormat) {
                console.log(
                  "[Restore] Detected old backup format (files lack UUIDs)"
                );
              }
            }
          } catch (err) {
            console.error("[Restore] Error checking backup format:", err);
          }
        }

        if (backup.localStorage) {
          console.log("Restoring localStorage items...");
          let restoredCount = 0;
          Object.entries(backup.localStorage).forEach(([key, value]) => {
            if (value !== null) {
              try {
                localStorage.setItem(key, value as string);
                restoredCount++;
              } catch (err) {
                console.error(
                  `Failed to restore localStorage item ${key}:`,
                  err
                );
              }
            }
          });
          console.log(`Restored ${restoredCount} localStorage items`);
        }

        const fileUUIDMap = new Map<string, string>();

        if (backup.indexedDB) {
          console.log("Restoring IndexedDB data...");
          try {
            const db = await ensureIndexedDBInitialized();
            const restoreStoreData = async (
              storeName: string,
              dataToRestore: Array<StoreItem | StoreItemWithKey>
            ): Promise<void> => {
              console.log(
                `Restoring ${dataToRestore.length} items to ${storeName}...`
              );
              return new Promise((resolve, reject) => {
                try {
                  const transaction = db.transaction(storeName, "readwrite");
                  const store = transaction.objectStore(storeName);
                  const clearRequest = store.clear();
                  clearRequest.onsuccess = async () => {
                    try {
                      for (const itemOrPair of dataToRestore) {
                        let restoredItem: Record<string, unknown>;
                        let itemKey: string | undefined;

                        if ("value" in itemOrPair) {
                          const pair = itemOrPair as StoreItemWithKey;
                          itemKey = pair.key;
                          restoredItem = { ...pair.value };
                        } else {
                          const oldItem = itemOrPair as StoreItem;
                          restoredItem = { ...oldItem };
                          if (
                            oldItem.name &&
                            typeof oldItem.name === "string"
                          ) {
                            itemKey = oldItem.name;
                          }
                        }

                        for (const key of Object.keys(restoredItem)) {
                          if (key.startsWith("_isBlob_")) {
                            const fieldName = key.substring(8);
                            if (
                              restoredItem[fieldName] &&
                              typeof restoredItem[fieldName] === "string"
                            ) {
                              restoredItem[fieldName] = base64ToBlob(
                                restoredItem[fieldName] as string
                              );
                            }
                            delete restoredItem[key];
                          }
                        }

                        if (!itemKey) {
                          console.warn(
                            `[Restore] Skipping item without a valid key in ${storeName}:`,
                            restoredItem
                          );
                          continue;
                        }

                        await new Promise<void>((resolveItem, rejectItem) => {
                          const addRequest = store.put(restoredItem, itemKey);
                          addRequest.onsuccess = () => resolveItem();
                          addRequest.onerror = () => {
                            console.error(
                              `Error adding item to ${storeName} with key ${itemKey}:`,
                              addRequest.error
                            );
                            rejectItem(addRequest.error);
                          };
                        });
                      }
                      resolve();
                    } catch (err) {
                      reject(err);
                    }
                  };
                  clearRequest.onerror = () => reject(clearRequest.error);
                } catch (error) {
                  console.error(`Error accessing store ${storeName}:`, error);
                  resolve();
                }
              });
            };

            if (backup.indexedDB.documents)
              await restoreStoreData("documents", backup.indexedDB.documents);
            if (backup.indexedDB.images)
              await restoreStoreData("images", backup.indexedDB.images);
            if (backup.indexedDB.trash)
              await restoreStoreData("trash", backup.indexedDB.trash);
            if (backup.indexedDB.custom_wallpapers)
              await restoreStoreData(
                "custom_wallpapers",
                backup.indexedDB.custom_wallpapers
              );

            db.close();
          } catch (error) {
            console.error("Error restoring IndexedDB:", error);
            alert(
              "Failed to restore file system data. Only settings were restored."
            );
          }

          try {
            const db = await ensureIndexedDBInitialized();
            const persistedKey = "ryos:files";
            let raw = localStorage.getItem(persistedKey);

            if (!raw) {
              const docsTransaction = db.transaction("documents", "readonly");
              const docsStore = docsTransaction.objectStore("documents");
              const docsCountRequest = docsStore.count();

              const imagesTransaction = db.transaction("images", "readonly");
              const imagesStore = imagesTransaction.objectStore("images");
              const imagesCountRequest = imagesStore.count();

              const [docsCount, imagesCount] = await Promise.all([
                new Promise<number>((resolve) => {
                  docsCountRequest.onsuccess = () =>
                    resolve(docsCountRequest.result);
                  docsCountRequest.onerror = () => resolve(0);
                }),
                new Promise<number>((resolve) => {
                  imagesCountRequest.onsuccess = () =>
                    resolve(imagesCountRequest.result);
                  imagesCountRequest.onerror = () => resolve(0);
                }),
              ]);

              const hasContent = docsCount > 0 || imagesCount > 0;

              const defaultStore = {
                state: {
                  items: {},
                  libraryState: hasContent ? "loaded" : "uninitialized",
                },
                version: 5,
              };
              localStorage.setItem(persistedKey, JSON.stringify(defaultStore));
              raw = localStorage.getItem(persistedKey);
              console.log(
                `[Restore] Created files store with libraryState: ${defaultStore.state.libraryState}, docs: ${docsCount}, images: ${imagesCount}`
              );
            }

            if (raw) {
              const parsed = JSON.parse(raw);
              if (parsed && parsed.state) {
                const items = parsed.state.items || {};
                let hasChanges = false;

                const ensureFileMetadata = (
                  path: string,
                  name: string,
                  type: string,
                  icon: string,
                  existingUuid?: string
                ) => {
                  let uuidToUse: string | undefined = existingUuid;

                  if (items[path]) {
                    uuidToUse = uuidToUse || items[path].uuid;
                  }

                  if (!uuidToUse) {
                    uuidToUse = uuidv4();
                  }

                  if (!items[path]) {
                    items[path] = {
                      path,
                      name,
                      isDirectory: false,
                      type,
                      icon,
                      status: "active",
                      uuid: uuidToUse,
                    };
                    hasChanges = true;
                    console.log(
                      `[Restore] Created metadata for ${path} with UUID ${uuidToUse}`
                    );
                  } else if (!items[path].uuid) {
                    items[path].uuid = uuidToUse;
                    hasChanges = true;
                    console.log(
                      `[Restore] Added UUID ${uuidToUse} to existing metadata for ${path}`
                    );
                  }

                  if (uuidToUse) {
                    fileUUIDMap.set(name, uuidToUse);
                  }
                };

                const defaultDirs = [
                  { path: "/", name: "/", type: "directory", icon: undefined },
                  {
                    path: "/Documents",
                    name: "Documents",
                    type: "directory",
                    icon: "/icons/documents.png",
                  },
                  {
                    path: "/Images",
                    name: "Images",
                    type: "directory",
                    icon: "/icons/images.png",
                  },
                  {
                    path: "/Applications",
                    name: "Applications",
                    type: "directory-virtual",
                    icon: "/icons/applications.png",
                  },
                  {
                    path: "/Music",
                    name: "Music",
                    type: "directory-virtual",
                    icon: "/icons/sounds.png",
                  },
                  {
                    path: "/Videos",
                    name: "Videos",
                    type: "directory-virtual",
                    icon: "/icons/movies.png",
                  },
                  {
                    path: "/Sites",
                    name: "Sites",
                    type: "directory-virtual",
                    icon: "/icons/sites.png",
                  },
                  {
                    path: "/Trash",
                    name: "Trash",
                    type: "directory",
                    icon: "/icons/trash-empty.png",
                  },
                ];

                for (const dir of defaultDirs) {
                  if (!items[dir.path]) {
                    items[dir.path] = {
                      path: dir.path,
                      name: dir.name,
                      isDirectory: true,
                      type: dir.type,
                      icon: dir.icon,
                      status: "active",
                    };
                    hasChanges = true;
                    console.log(
                      `[Restore] Created missing directory: ${dir.path}`
                    );
                  }
                }

                await new Promise<void>((resolve) => {
                  const transaction = db.transaction("documents", "readonly");
                  const store = transaction.objectStore("documents");
                  const request = store.openCursor();

                  let count = 0;
                  request.onsuccess = (event) => {
                    const cursor = (
                      event.target as IDBRequest<IDBCursorWithValue>
                    ).result;
                    if (cursor) {
                      const key = cursor.key as string;
                      const value = cursor.value as { name?: string };
                      if (value.name) {
                        const path = `/Documents/${value.name}`;
                        const type = value.name.endsWith(".md")
                          ? "markdown"
                          : "text";
                        ensureFileMetadata(
                          path,
                          value.name,
                          type,
                          "/icons/file-text.png",
                          key
                        );
                        count++;
                      }
                      cursor.continue();
                    } else {
                      console.log(
                        `[Restore] Found ${count} documents in IndexedDB`
                      );
                      resolve();
                    }
                  };
                  request.onerror = () => {
                    console.warn("[Restore] Failed to scan documents store");
                    resolve();
                  };
                });

                await new Promise<void>((resolve) => {
                  const transaction = db.transaction("images", "readonly");
                  const store = transaction.objectStore("images");
                  const request = store.openCursor();

                  let count = 0;
                  request.onsuccess = (event) => {
                    const cursor = (
                      event.target as IDBRequest<IDBCursorWithValue>
                    ).result;
                    if (cursor) {
                      const key = cursor.key as string;
                      const value = cursor.value as { name?: string };
                      if (value.name) {
                        const path = `/Images/${value.name}`;
                        const ext =
                          value.name.split(".").pop()?.toLowerCase() || "png";
                        ensureFileMetadata(
                          path,
                          value.name,
                          ext,
                          "/icons/image.png",
                          key
                        );
                        count++;
                      }
                      cursor.continue();
                    } else {
                      console.log(
                        `[Restore] Found ${count} images in IndexedDB`
                      );
                      resolve();
                    }
                  };
                  request.onerror = () => {
                    console.warn("[Restore] Failed to scan images store");
                    resolve();
                  };
                });

                const hasFiles = Object.keys(items).some(
                  (path) => !items[path].isDirectory
                );
                const currentLibraryState = parsed.state.libraryState;

                if (
                  !currentLibraryState ||
                  (currentLibraryState === "uninitialized" && hasFiles)
                ) {
                  parsed.state.libraryState = "loaded";
                  hasChanges = true;
                  console.log(
                    `[Restore] Setting libraryState to "loaded" (was: ${currentLibraryState}, hasFiles: ${hasFiles})`
                  );
                }

                if (!parsed.version || parsed.version < 5) {
                  parsed.version = 5;
                  hasChanges = true;
                }

                if (hasChanges || !currentLibraryState) {
                  parsed.state.items = items;
                  localStorage.setItem(persistedKey, JSON.stringify(parsed));
                  console.log(
                    `[Restore] Updated files store with ${
                      Object.keys(items).length
                    } items, libraryState: ${parsed.state.libraryState}`
                  );
                }

                const fileCount = Object.keys(items).filter(
                  (path) => !items[path].isDirectory
                ).length;
                console.log(
                  `[ControlPanels] Synchronized files store: ${fileCount} files, libraryState: ${parsed.state.libraryState}`
                );
              }
            }

            if (isOldBackupFormat && fileUUIDMap.size > 0) {
              console.log(
                `[Restore] Migrating ${fileUUIDMap.size} files from filename to UUID keys...`
              );

              const docsTransaction = db.transaction("documents", "readwrite");
              const docsStore = docsTransaction.objectStore("documents");

              for (const [filename, uuid] of fileUUIDMap) {
                try {
                  const getRequest = docsStore.get(filename);
                  await new Promise<void>((resolve) => {
                    getRequest.onsuccess = async () => {
                      const content = getRequest.result;
                      if (content) {
                        await new Promise<void>((res, rej) => {
                          const putRequest = docsStore.put(content, uuid);
                          putRequest.onsuccess = () => res();
                          putRequest.onerror = () => rej(putRequest.error);
                        });
                        await new Promise<void>((res, rej) => {
                          const deleteRequest = docsStore.delete(filename);
                          deleteRequest.onsuccess = () => res();
                          deleteRequest.onerror = () =>
                            rej(deleteRequest.error);
                        });
                        console.log(
                          `[Restore] Migrated document ${filename} to UUID ${uuid}`
                        );
                      }
                      resolve();
                    };
                    getRequest.onerror = () => resolve();
                  });
                } catch (err) {
                  console.error(
                    `[Restore] Failed to migrate document ${filename}:`,
                    err
                  );
                }
              }

              const imagesTransaction = db.transaction("images", "readwrite");
              const imagesStore = imagesTransaction.objectStore("images");

              for (const [filename, uuid] of fileUUIDMap) {
                try {
                  const getRequest = imagesStore.get(filename);
                  await new Promise<void>((resolve) => {
                    getRequest.onsuccess = async () => {
                      const content = getRequest.result;
                      if (content) {
                        await new Promise<void>((res, rej) => {
                          const putRequest = imagesStore.put(content, uuid);
                          putRequest.onsuccess = () => res();
                          putRequest.onerror = () => rej(putRequest.error);
                        });
                        await new Promise<void>((res, rej) => {
                          const deleteRequest = imagesStore.delete(filename);
                          deleteRequest.onsuccess = () => res();
                          deleteRequest.onerror = () =>
                            rej(deleteRequest.error);
                        });
                        console.log(
                          `[Restore] Migrated image ${filename} to UUID ${uuid}`
                        );
                      }
                      resolve();
                    };
                    getRequest.onerror = () => resolve();
                  });
                } catch (err) {
                  console.error(
                    `[Restore] Failed to migrate image ${filename}:`,
                    err
                  );
                }
              }

              localStorage.setItem(
                "ryos:indexeddb-uuid-migration-v1",
                "completed"
              );
              console.log("[Restore] UUID migration completed during restore");
            }

            db.close();
          } catch (err) {
            console.error(
              "[ControlPanels] Failed to synchronize files store with IndexedDB after restore:",
              err
            );

            try {
              const persistedKey = "ryos:files";
              const raw = localStorage.getItem(persistedKey);
              if (raw) {
                const parsed = JSON.parse(raw);
                if (parsed && parsed.state) {
                  const hasItems =
                    parsed.state.items &&
                    Object.keys(parsed.state.items).length > 0;
                  parsed.state.libraryState = hasItems
                    ? "loaded"
                    : "uninitialized";
                  parsed.version = 5;
                  localStorage.setItem(persistedKey, JSON.stringify(parsed));
                  console.log(
                    `[ControlPanels] Emergency: Set libraryState to ${parsed.state.libraryState} to handle restore properly`
                  );
                }
              } else {
                const defaultStore = {
                  state: { items: {}, libraryState: "loaded" },
                  version: 5,
                };
                localStorage.setItem(
                  persistedKey,
                  JSON.stringify(defaultStore)
                );
                console.log(
                  "[ControlPanels] Emergency: Created files store with libraryState: loaded"
                );
              }
            } catch (fallbackErr) {
              console.error(
                "[ControlPanels] Emergency fallback failed:",
                fallbackErr
              );
            }
          }
        }
        setNextBootMessage("Restoring System...");
        window.location.reload();
      } catch (err) {
        console.error("Backup restore failed:", err);
        let errorMessage = "Failed to restore backup: ";
        if (err instanceof Error) {
          errorMessage += err.message;
        } else if (typeof err === "string") {
          errorMessage += err;
        } else {
          errorMessage += "Unknown error occurred";
        }

        alert(errorMessage);
        clearNextBootMessage();
      }
    };

    if (file.name.endsWith(".gz")) {
      reader.readAsArrayBuffer(file);
    } else {
      reader.readAsText(file);
    }
    fileToRestoreRef.current = null;
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

  const isXpTheme = currentTheme === "xp" || currentTheme === "win98";
  const isMacOSXTheme = currentTheme === "macosx";
  const isSystem7Theme = currentTheme === "system7";
  const isClassicMacTheme = isMacOSXTheme || isSystem7Theme;
  const isWindowsLegacyTheme = isXpTheme;

  const tabStyles = getTabStyles(currentTheme);

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
      {!isXpTheme && isForeground && menuBar}
      <WindowFrame
        title="Control Panels"
        onClose={onClose}
        isForeground={isForeground}
        appId="control-panels"
        skipInitialSound={skipInitialSound}
        instanceId={instanceId}
        onNavigateNext={onNavigateNext}
        onNavigatePrevious={onNavigatePrevious}
        menuBar={isXpTheme ? menuBar : undefined}
      >
        <div
          className={`flex flex-col h-full w-full ${
            isWindowsLegacyTheme ? "pt-0 pb-2 px-2" : ""
          } ${
            isClassicMacTheme
              ? isMacOSXTheme
                ? "p-4 pt-2"
                : "p-4 bg-[#E3E3E3]"
              : ""
          }`}
        >
          <Tabs
            defaultValue={initialData?.defaultTab || "appearance"}
            className="w-full h-full"
          >
            {isWindowsLegacyTheme ? (
              <TabsList asChild>
                <menu
                  role="tablist"
                  className="h-7! flex justify-start! p-0 -mt-1 -mb-[2px] bg-transparent shadow-none /* Windows XP/98 tab strip */"
                >
                  <TabsTrigger value="appearance">Appearance</TabsTrigger>
                  <TabsTrigger value="sound">Sound</TabsTrigger>
                  <TabsTrigger value="system">System</TabsTrigger>
                </menu>
              </TabsList>
            ) : (
              <TabsList className={tabStyles.tabListClasses}>
                <TabsTrigger
                  value="appearance"
                  className={tabStyles.tabTriggerClasses}
                >
                  Appearance
                </TabsTrigger>
                <TabsTrigger
                  value="sound"
                  className={tabStyles.tabTriggerClasses}
                >
                  Sound
                </TabsTrigger>
                <TabsTrigger
                  value="system"
                  className={tabStyles.tabTriggerClasses}
                >
                  System
                </TabsTrigger>
              </TabsList>
            )}

            <TabsContent
              value="appearance"
              className={tabStyles.tabContentClasses}
            >
              <div className="space-y-4 h-full overflow-y-auto p-4 pt-6">
                {/* Theme Selector */}
                <div className="flex items-center justify-between">
                  <div className="flex flex-col gap-1">
                    <Label>Theme</Label>
                    <Label className="text-[11px] text-gray-600 font-geneva-12">
                      Changes the appearance of windows, menus, and controls
                    </Label>
                  </div>
                  <Select
                    value={currentTheme}
                    onValueChange={(value) => setTheme(value as OsThemeId)}
                  >
                    <SelectTrigger className="w-[160px]">
                      <SelectValue placeholder="Select">
                        {themes[currentTheme]?.name || "Select"}
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(themes).map(([id, theme]) => (
                        <SelectItem key={id} value={id}>
                          {theme.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div
                  className="border-t my-4"
                  style={tabStyles.separatorStyle}
                />

                <WallpaperPicker />
              </div>
            </TabsContent>

            <TabsContent value="sound" className={tabStyles.tabContentClasses}>
              <div className="space-y-4 h-full overflow-y-auto p-4 pt-6">
                {/* UI Sounds toggle + volume */}
                <div className="flex flex-col gap-1">
                  <div className="flex items-center justify-between">
                    <Label>UI Sounds</Label>
                    <Switch
                      checked={uiSoundsEnabled}
                      onCheckedChange={handleUISoundsChange}
                      className="data-[state=checked]:bg-[#000000]"
                    />
                  </div>
                </div>

                <div className="flex flex-col gap-1">
                  <div className="flex items-center justify-between">
                    <Label>Speech</Label>
                    <Switch
                      checked={speechEnabled}
                      onCheckedChange={handleSpeechChange}
                      className="data-[state=checked]:bg-[#000000]"
                    />
                  </div>
                </div>

                <div className="flex items-center justify-between">
                  <div className="flex flex-col gap-1">
                    <Label>Terminal & IE Ambient Synth</Label>
                  </div>
                  <Switch
                    checked={terminalSoundsEnabled}
                    onCheckedChange={setTerminalSoundsEnabled}
                    className="data-[state=checked]:bg-[#000000]"
                  />
                </div>

                {/* Chat Synth preset */}
                <div className="flex flex-col gap-1">
                  <div className="flex items-center justify-between">
                    <Label>Chat Synth</Label>
                    <Select
                      value={synthPreset}
                      onValueChange={handleSynthPresetChange}
                    >
                      <SelectTrigger className="w-[120px]">
                        <SelectValue placeholder="Select a preset" />
                      </SelectTrigger>
                      <SelectContent>
                        {Object.entries(SYNTH_PRESETS).map(([key, preset]) => (
                          <SelectItem key={key} value={key}>
                            {preset.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <hr
                  className="my-3 border-t"
                  style={tabStyles.separatorStyle}
                />

                <VolumeMixer
                  masterVolume={masterVolume}
                  setMasterVolume={setMasterVolume}
                  setPrevMasterVolume={setPrevMasterVolume}
                  handleMasterMuteToggle={handleMasterMuteToggle}
                  uiVolume={uiVolume}
                  setUiVolume={setUiVolume}
                  setPrevUiVolume={setPrevUiVolume}
                  handleUiMuteToggle={handleUiMuteToggle}
                  speechVolume={speechVolume}
                  setSpeechVolume={setSpeechVolume}
                  setPrevSpeechVolume={setPrevSpeechVolume}
                  handleSpeechMuteToggle={handleSpeechMuteToggle}
                  chatSynthVolume={chatSynthVolume}
                  setChatSynthVolume={setChatSynthVolume}
                  setPrevChatSynthVolume={setPrevChatSynthVolume}
                  handleChatSynthMuteToggle={handleChatSynthMuteToggle}
                  ipodVolume={ipodVolume}
                  setIpodVolume={setIpodVolume}
                  setPrevIpodVolume={setPrevIpodVolume}
                  handleIpodMuteToggle={handleIpodMuteToggle}
                  isIOS={isIOS}
                />
              </div>
            </TabsContent>

            <TabsContent value="system" className={tabStyles.tabContentClasses}>
              <div className="space-y-4 h-full overflow-y-auto p-4">
                {/* (User Account/Login section removed) */}

                <div className="space-y-2">
                  <div className="flex gap-2">
                    <Button
                      variant="retro"
                      onClick={handleBackup}
                      className="flex-1"
                    >
                      Backup
                    </Button>
                    <Button
                      variant="retro"
                      onClick={() => fileInputRef.current?.click()}
                      className="flex-1"
                    >
                      Restore
                    </Button>
                    <input
                      type="file"
                      ref={fileInputRef}
                      onChange={handleRestore}
                      accept=".json,.gz"
                      className="hidden"
                    />
                  </div>
                  <p className="text-[11px] text-gray-600 font-geneva-12">
                    Backup or restore all app settings and files
                  </p>
                </div>

                <div className="space-y-2">
                  <Button
                    variant="retro"
                    onClick={handleResetAll}
                    className="w-full"
                  >
                    Reset All Settings
                  </Button>
                  <p className="text-[11px] text-gray-600 font-geneva-12">
                    This will clear all saved settings and restore default
                    states.
                  </p>
                </div>

                <div className="space-y-2">
                  <Button
                    variant="retro"
                    onClick={() => {
                      setIsConfirmFormatOpen(true);
                    }}
                    className="w-full"
                  >
                    Format File System
                  </Button>
                  <p className="text-[11px] text-gray-600 font-geneva-12">
                    This will clear all files (except sample docs), images, and
                    custom wallpapers. ryOS will restart after format.
                  </p>
                </div>

                <hr
                  className="my-4 border-t"
                  style={tabStyles.separatorStyle}
                />

                <div className="flex items-center justify-between">
                  <div className="flex flex-col gap-1">
                    <Label>Debug Mode</Label>
                    <Label className="text-[11px] text-gray-600 font-geneva-12">
                      Enable debugging settings
                    </Label>
                  </div>
                  <Switch
                    checked={debugMode}
                    onCheckedChange={setDebugMode}
                    className="data-[state=checked]:bg-[#000000]"
                  />
                </div>

                {debugMode && (
                  <div className="flex items-center justify-between">
                    <div className="flex flex-col gap-1">
                      <Label>Shader Effect</Label>
                      <Label className="text-[11px] text-gray-600 font-geneva-12">
                        Performance intensive background effect
                      </Label>
                    </div>
                    <Switch
                      checked={shaderEffectEnabled}
                      onCheckedChange={setShaderEffectEnabled}
                      className="data-[state=checked]:bg-[#000000]"
                    />
                  </div>
                )}

                {debugMode && (
                  <div className="flex items-center justify-between">
                    <div className="flex flex-col gap-1">
                      <Label>AI Model</Label>
                      <Label className="text-[11px] text-gray-600 font-geneva-12">
                        Used in Chats, IE, and more
                      </Label>
                    </div>
                    <Select
                      value={aiModel || "__null__"}
                      onValueChange={(value) =>
                        setAiModel(
                          value === "__null__" ? null : (value as AIModel)
                        )
                      }
                    >
                      <SelectTrigger className="w-[120px]">
                        <SelectValue placeholder="Select">
                          {aiModel || "Select"}
                        </SelectValue>
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__null__">Default</SelectItem>
                        {AI_MODELS.map((model) => (
                          <SelectItem key={model.id} value={model.id as string}>
                            {model.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}

                {debugMode && (
                  <div className="flex items-center justify-between">
                    <div className="flex flex-col gap-1">
                      <Label>TTS Model</Label>
                      <Label className="text-[11px] text-gray-600 font-geneva-12">
                        Text-to-speech provider
                      </Label>
                    </div>
                    <Select
                      value={ttsModel || "__null__"}
                      onValueChange={(value) =>
                        setTtsModel(
                          value === "__null__"
                            ? null
                            : (value as "openai" | "elevenlabs")
                        )
                      }
                    >
                      <SelectTrigger className="w-[120px]">
                        <SelectValue placeholder="Select"/>
                        </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__null__">Default</SelectItem>
                        <SelectItem value="openai">OpenAI</SelectItem>
                        <SelectItem value="elevenlabs">ElevenLabs</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                )}

                {debugMode && ttsModel && (
                  <div className="flex items-center justify-between">
                    <div className="flex flex-col gap-1">
                      <Label>TTS Voice</Label>
                      <Label className="text-[11px] text-gray-600 font-geneva-12">
                        {ttsModel === "elevenlabs"
                          ? "ElevenLabs Voice ID"
                          : "OpenAI Voice"}
                      </Label>
                    </div>
                    {ttsModel === "elevenlabs" ? (
                      <Select
                        value={ttsVoice || "__null__"}
                        onValueChange={(value) =>
                          setTtsVoice(value === "__null__" ? null : value)
                        }
                      >
                        <SelectTrigger className="w-[120px]">
                          <SelectValue placeholder="Select">
                            {ttsVoice === "YC3iw27qriLq7UUaqAyi"
                              ? "Ryo v3"
                              : ttsVoice === "kAyjEabBEu68HYYYRAHR"
                              ? "Ryo v2"
                              : ttsVoice === "G0mlS0y8ByHjGAOxBgvV"
                              ? "Ryo"
                              : "Select"}
                          </SelectValue>
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="__null__">Select</SelectItem>
                          <SelectItem value="YC3iw27qriLq7UUaqAyi">
                            Ryo v3
                          </SelectItem>
                          <SelectItem value="kAyjEabBEu68HYYYRAHR">
                            Ryo v2
                          </SelectItem>
                          <SelectItem value="G0mlS0y8ByHjGAOxBgvV">
                            Ryo
                          </SelectItem>
                        </SelectContent>
                      </Select>
                    ) : (
                      <Select
                        value={ttsVoice || "__null__"}
                        onValueChange={(value) =>
                          setTtsVoice(value === "__null__" ? null : value)
                        }
                      >
                        <SelectTrigger className="w-[120px]">
                          <SelectValue placeholder="Select">
                            {ttsVoice || "Select"}
                          </SelectValue>
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="__null__">Select</SelectItem>
                          <SelectItem value="alloy">Alloy</SelectItem>
                          <SelectItem value="echo">Echo</SelectItem>
                          <SelectItem value="fable">Fable</SelectItem>
                          <SelectItem value="onyx">Onyx</SelectItem>
                          <SelectItem value="nova">Nova</SelectItem>
                          <SelectItem value="shimmer">Shimmer</SelectItem>
                        </SelectContent>
                      </Select>
                    )}
                  </div>
                )}

                {debugMode && (
                  <div className="flex items-center justify-between">
                    <div className="flex flex-col gap-1">
                      <Label>Boot Screen</Label>
                      <Label className="text-[11px] text-gray-600 font-geneva-12">
                        Test the boot screen animation
                      </Label>
                    </div>
                    <Button
                      variant="retro"
                      onClick={() => {
                        setNextBootMessage("Debug Boot Screen Test...");
                        window.location.reload();
                      }}
                      className="w-fit"
                    >
                      Show
                    </Button>
                  </div>
                )}
              </div>
            </TabsContent>
          </Tabs>
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
        {/* The auth/login dialogs remain intact; UI section was removed */}
        <LoginDialog
          initialTab="signup"
          isOpen={isUsernameDialogOpen}
          onOpenChange={setIsUsernameDialogOpen}
          usernameInput={verifyUsernameInput}
          onUsernameInputChange={setVerifyUsernameInput}
          passwordInput={verifyPasswordInput}
          onPasswordInputChange={setVerifyPasswordInput}
          onLoginSubmit={async () => {
            await handleVerifyTokenSubmit(verifyPasswordInput, true);
          }}
          isLoginLoading={isVerifyingToken}
          loginError={verifyError}
          newUsername={newUsername}
          onNewUsernameChange={setNewUsername}
          newPassword={newPassword}
          onNewPasswordChange={setNewPassword}
          onSignUpSubmit={submitUsernameDialog}
          isSignUpLoading={isSettingUsername}
          signUpError={usernameError}
        />

        <LoginDialog
          isOpen={isVerifyDialogOpen}
          onOpenChange={setVerifyDialogOpen}
          usernameInput={verifyUsernameInput}
          onUsernameInputChange={setVerifyUsernameInput}
          passwordInput={verifyPasswordInput}
          onPasswordInputChange={setVerifyPasswordInput}
          onLoginSubmit={async () => {
            await handleVerifyTokenSubmit(verifyPasswordInput, true);
          }}
          isLoginLoading={isVerifyingToken}
          loginError={verifyError}
          newUsername={verifyUsernameInput}
          onNewUsernameChange={setVerifyUsernameInput}
          newPassword={verifyPasswordInput}
          onNewPasswordChange={setVerifyPasswordInput}
          onSignUpSubmit={async () => {
            setVerifyDialogOpen(false);
            promptSetUsername();
          }}
          isSignUpLoading={false}
          signUpError={null}
        />
        <InputDialog
          isOpen={isPasswordDialogOpen}
          onOpenChange={setIsPasswordDialogOpen}
          onSubmit={handleSetPassword}
          title="Set Password"
          description="Set a password to enable account recovery. You can use this password to get a new token if you lose access."
          value={passwordInput}
          onChange={(value) => {
            setPasswordInput(value);
            setPasswordError(null);
          }}
          isLoading={isSettingPassword}
          errorMessage={passwordError}
          submitLabel="Set Password"
        />
        <LogoutDialog
          isOpen={isLogoutConfirmDialogOpen}
          onOpenChange={setIsLogoutConfirmDialogOpen}
          onConfirm={confirmLogout}
          hasPassword={hasPassword}
          onSetPassword={() => {
            setPasswordInput("");
            setPasswordError(null);
            setIsPasswordDialogOpen(true);
          }}
        />
      </WindowFrame>
    </>
  );
}
