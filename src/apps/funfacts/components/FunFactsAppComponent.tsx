import { useState, useEffect } from "react";
import { AppProps } from "@/apps/base/types";
import { WindowFrame } from "@/components/layout/WindowFrame";
import { FunFactsMenuBar } from "./FunFactsMenuBar";
import { HelpDialog } from "@/components/dialogs/HelpDialog";
import { AboutDialog } from "@/components/dialogs/AboutDialog";
import { helpItems, appMetadata } from "../index";
import { Button } from "@/components/ui/button";
import { Dice3 } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";

// Fun Fact data type
interface FunFact {
  id: string;
  title: string;
  content: string;
  category: string;
  icon: string;
}

// Fun Facts data structure
interface FunFactsData {
  version: number;
  facts: FunFact[];
}

export function FunFactsAppComponent({
  isWindowOpen,
  onClose,
  isForeground,
  skipInitialSound,
  instanceId,
  onNavigateNext,
  onNavigatePrevious,
}: AppProps) {
  const [isHelpDialogOpen, setIsHelpDialogOpen] = useState(false);
  const [isAboutDialogOpen, setIsAboutDialogOpen] = useState(false);
  const [facts, setFacts] = useState<FunFact[]>([]);
  const [currentFact, setCurrentFact] = useState<FunFact | null>(null);
  const [animationKey, setAnimationKey] = useState(0);
  const [shuffledFacts, setShuffledFacts] = useState<FunFact[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);

  // Shuffle array function
  const shuffleArray = (array: FunFact[]) => {
    const shuffled = [...array];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
  };

  // Load fun facts data
  useEffect(() => {
    const loadFacts = async () => {
      try {
        const response = await fetch("/data/fun-facts.json");
        const data: FunFactsData = await response.json();
        setFacts(data.facts);
        
        // Create shuffled version and set initial fact
        if (data.facts.length > 0) {
          const shuffled = shuffleArray(data.facts);
          setShuffledFacts(shuffled);
          setCurrentFact(shuffled[0]);
          setCurrentIndex(0);
        }
      } catch (error) {
        console.error("Failed to load fun facts:", error);
      }
    };

    loadFacts();
  }, []);

  // Get next fact from shuffled array
  const getNextFact = () => {
    if (shuffledFacts.length === 0) return;
    
    // Move to next fact in shuffled array
    const nextIndex = (currentIndex + 1) % shuffledFacts.length;
    
    // If we've gone through all facts, reshuffle
    if (nextIndex === 0) {
      const newShuffled = shuffleArray(facts);
      setShuffledFacts(newShuffled);
      setCurrentFact(newShuffled[0]);
      setCurrentIndex(0);
    } else {
      setCurrentFact(shuffledFacts[nextIndex]);
      setCurrentIndex(nextIndex);
    }
    
    setAnimationKey(prev => prev + 1);
  };

  // Category color mapping
  const getCategoryColor = (category: string) => {
    const colors = {
      technology: "bg-blue-50",
      reading: "bg-green-50",
      hobbies: "bg-purple-50",
      travel: "bg-orange-50",
      lifestyle: "bg-pink-50",
      philosophy: "bg-yellow-50",
    };
    return colors[category as keyof typeof colors] || "bg-gray-50";
  };

  if (!isWindowOpen) return null;

  return (
    <>
      <FunFactsMenuBar
        onClose={onClose}
        onShowHelp={() => setIsHelpDialogOpen(true)}
        onShowAbout={() => setIsAboutDialogOpen(true)}
      />
      <WindowFrame
        title="Fun Facts"
        onClose={onClose}
        isForeground={isForeground}
        appId="fun-facts"
        skipInitialSound={skipInitialSound}
        instanceId={instanceId}
        onNavigateNext={onNavigateNext}
        onNavigatePrevious={onNavigatePrevious}
      >
        <div className="w-full h-full bg-system7-window-bg overflow-auto">
          <div className="py-6 px-4 md:px-8 md:py-8 h-full flex items-center justify-center">
            <div className="max-w-2xl mx-auto flex flex-col items-center">
              <AnimatePresence mode="wait">
                {currentFact && (
                  <motion.div
                    key={animationKey}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -20 }}
                    transition={{ duration: 0.3 }}
                    className="w-full"
                  >
                    <div className={cn(
                      "w-full max-w-md md:max-w-lg mx-auto p-4 md:p-6 text-center font-geneva-12",
                      "border-[5px] border-solid border-transparent",
                      "[border-image:url('/button.svg')_30_stretch]",
                      "min-h-[280px] md:min-h-[320px] flex flex-col justify-center",
                      getCategoryColor(currentFact.category)
                    )}>
                      <div className="text-3xl md:text-4xl mb-3 md:mb-4">{currentFact.icon}</div>
                      <h3 className="text-base md:text-lg text-black mb-3 md:mb-4 font-bold">
                        {currentFact.title}
                      </h3>
                      <p className="text-black text-[13px] md:text-[14px] leading-relaxed">
                        {currentFact.content}
                      </p>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
              
              <div className="mt-4 md:mt-6">
                <Button
                  onClick={getNextFact}
                  disabled={shuffledFacts.length === 0}
                  className={cn(
                    "flex items-center space-x-2 px-3 md:px-4 py-2 font-geneva-12 text-black",
                    "bg-system7-button-bg hover:bg-system7-button-hover",
                    "border-[5px] border-solid border-transparent",
                    "[border-image:url('/button.svg')_30_stretch]",
                    "active:translate-y-0.5"
                  )}
                >
                  <Dice3 className="w-4 h-4" />
                  <span>Roll the Dice</span>
                </Button>
              </div>
            </div>
          </div>
        </div>
      </WindowFrame>

      {/* Dialogs */}
      <HelpDialog
        isOpen={isHelpDialogOpen}
        onOpenChange={setIsHelpDialogOpen}
        helpItems={helpItems}
        appName="Fun Facts"
      />
      <AboutDialog
        isOpen={isAboutDialogOpen}
        onOpenChange={setIsAboutDialogOpen}
        metadata={appMetadata}
      />
    </>
  );
}
