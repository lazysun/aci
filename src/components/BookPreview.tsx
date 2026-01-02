import React from 'react';
import { BookOpen, Loader2, Image as ImageIcon, ChevronLeft, ChevronRight, Download, Share2, Volume2, Play, Pause, RotateCcw } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { BookPage } from '../hooks/useWeaver';
import { jsPDF } from 'jspdf';
import { useState, useRef, useEffect } from 'react';
import { generateSpeech } from '../services/gemini';

interface BookPreviewProps {
  pages: BookPage[];
  currentPageIndex: number;
  onPageChange: (index: number) => void;
  isGenerating: boolean;
  isStoryFinished: boolean;
  readOnly?: boolean;
}

export const BookPreview: React.FC<BookPreviewProps> = ({ pages, currentPageIndex, onPageChange, isGenerating, isStoryFinished, readOnly = false }) => {
  const currentPage = pages[currentPageIndex] || { image: null, text: null };
  const hasPrev = currentPageIndex > 0;
  const hasNext = currentPageIndex < pages.length - 1;
  const [shareUrl, setShareUrl] = useState<string | null>(null);
  
  // TTS State
  const [isPlayingTTS, setIsPlayingTTS] = useState(false);
  const [isAudioLoading, setIsAudioLoading] = useState(false);
  const [audioCache, setAudioCache] = useState<Record<number, string>>({});
  const currentAudio = useRef<HTMLAudioElement | null>(null);
  
  // Auto-play State
  const [isAutoPlaying, setIsAutoPlaying] = useState(false);
  const autoPlayTimer = useRef<NodeJS.Timeout | null>(null);

  // Track direction for animation
  const [direction, setDirection] = useState(0);
  const prevIndexRef = useRef(currentPageIndex);

  useEffect(() => {
    setDirection(currentPageIndex > prevIndexRef.current ? 1 : -1);
    prevIndexRef.current = currentPageIndex;
  }, [currentPageIndex]);

  // Handle TTS
  const stopAudio = () => {
    if (currentAudio.current) {
        currentAudio.current.pause();
        currentAudio.current = null;
    }
    setIsPlayingTTS(false);
  };

  // Use a ref for auto-play state to access it inside event listeners/timeouts
  const isAutoPlayingRef = useRef(isAutoPlaying);
  useEffect(() => {
      isAutoPlayingRef.current = isAutoPlaying;
  }, [isAutoPlaying]);

  const speakText = async (text: string, pageIndex: number) => {
    stopAudio();
    if (!text) {
        // If no text (e.g. cover), and auto-playing, wait a bit then flip
        if (isAutoPlaying && hasNext) {
             autoPlayTimer.current = setTimeout(() => {
                 onPageChange(currentPageIndex + 1);
             }, 3000);
        }
        return;
    }

    // Check cache
    let audioSrc = audioCache[pageIndex];

    if (!audioSrc) {
        setIsAudioLoading(true);
        const generatedSrc = await generateSpeech(text);
        setIsAudioLoading(false);
        
        if (generatedSrc) {
            audioSrc = generatedSrc;
            setAudioCache(prev => ({ ...prev, [pageIndex]: generatedSrc }));
        } else {
            // Fallback or error
            console.error("Failed to generate speech");
            // If failed, still continue auto-play after delay
            if (isAutoPlaying && hasNext) {
                 autoPlayTimer.current = setTimeout(() => {
                     onPageChange(currentPageIndex + 1);
                 }, 3000);
            }
            return;
        }
    }

    const audio = new Audio(audioSrc);
    currentAudio.current = audio;
    setIsPlayingTTS(true);
    
    audio.onended = () => {
      setIsPlayingTTS(false);
      currentAudio.current = null;
      
      if (isAutoPlayingRef.current) {
          if (hasNext) {
             // Add a small delay for pacing
             autoPlayTimer.current = setTimeout(() => {
                 onPageChange(currentPageIndex + 1);
             }, 1000);
          } else {
             setIsAutoPlaying(false);
          }
      }
    };

    audio.play().catch(e => {
        console.error("Playback failed", e);
        setIsPlayingTTS(false);
    });
  };

  const toggleTTS = () => {
    if (isPlayingTTS || isAudioLoading) {
      stopAudio();
      setIsAutoPlaying(false); // Stop auto-play if manually stopping speech
      if (autoPlayTimer.current) clearTimeout(autoPlayTimer.current);
    } else if (currentPage.text) {
      speakText(currentPage.text, currentPageIndex);
    }
  };

  // Handle Auto-play
  const toggleAutoPlay = () => {
    if (isAutoPlaying) {
      setIsAutoPlaying(false);
      stopAudio();
      if (autoPlayTimer.current) clearTimeout(autoPlayTimer.current);
    } else {
      setIsAutoPlaying(true);
      // Start speaking current page
      if (currentPage.text) {
          speakText(currentPage.text, currentPageIndex);
      } else if (hasNext) {
          // If no text (e.g. cover), just wait and flip
           autoPlayTimer.current = setTimeout(() => {
             onPageChange(currentPageIndex + 1);
         }, 3000);
      }
    }
  };
  
  // Effect to handle page changes during auto-play
  useEffect(() => {
      if (isAutoPlaying && !isPlayingTTS && !isAudioLoading) {
          // If we changed page and are auto-playing, but not speaking yet (e.g. just flipped)
          // Start speaking the new page text
          if (currentPage.text) {
              speakText(currentPage.text, currentPageIndex);
          } else if (hasNext) {
               // No text, wait and flip
               autoPlayTimer.current = setTimeout(() => {
                   onPageChange(currentPageIndex + 1);
               }, 3000);
          } else {
              // End of book
              setIsAutoPlaying(false);
          }
      }
      return () => {
          if (autoPlayTimer.current) clearTimeout(autoPlayTimer.current);
      }
  }, [currentPageIndex, isAutoPlaying]);

  // Cleanup on unmount
  useEffect(() => {
      return () => {
          stopAudio();
          if (autoPlayTimer.current) clearTimeout(autoPlayTimer.current);
      }
  }, []);

  const variants = {
    enter: (direction: number) => ({
      rotateY: direction > 0 ? 180 : -180,
      opacity: 0,
      zIndex: 0,
      transformOrigin: direction > 0 ? 'left' : 'right',
    }),
    center: {
      rotateY: 0,
      opacity: 1,
      zIndex: 1,
      transition: {
        duration: 1.2,
        ease: "easeInOut"
      }
    },
    exit: (direction: number) => ({
      rotateY: direction < 0 ? 180 : -180,
      opacity: 0,
      zIndex: 0,
      transformOrigin: direction < 0 ? 'left' : 'right',
      transition: {
        duration: 1.2,
        ease: "easeInOut"
      }
    })
  };

  const handleShare = async () => {
    try {
      // 1. Create Story Container
      const initRes = await fetch('/api/stories', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: 'My Story' })
      });
      
      if (!initRes.ok) {
         const text = await initRes.text();
         throw new Error(`Failed to create story container: ${text}`);
      }
      const { id } = await initRes.json();

      // 2. Upload Pages Sequentially
      for (let i = 0; i < pages.length; i++) {
        const page = pages[i];
        const pageRes = await fetch(`/api/stories/${id}/pages`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            page_index: i,
            image: page.image,
            text: page.text
          })
        });
        
        if (!pageRes.ok) {
            const text = await pageRes.text();
            throw new Error(`Failed to upload page ${i}: ${text}`);
        }
      }

      // 3. Success
      const url = `${window.location.origin}/share/${id}`;
      setShareUrl(url);
      
      try {
          await navigator.clipboard.writeText(url);
          alert('Link copied to clipboard!');
      } catch (err) {
          prompt("Copy this link to share:", url);
      }

    } catch (e) {
      console.error('Failed to share', e);
      alert(`Failed to share story: ${e instanceof Error ? e.message : 'Unknown error'}`);
    }
  };

  const handleDownloadPDF = async () => {
    const doc = new jsPDF({
      orientation: 'landscape',
      unit: 'mm',
      format: 'a4'
    });

    for (let i = 0; i < pages.length; i++) {
      const page = pages[i];
      if (i > 0) doc.addPage();

      // Set background color
      doc.setFillColor(255, 251, 240); // #fffbf0
      doc.rect(0, 0, 297, 210, 'F');

      // Add Image (Left side)
      if (page.image) {
        try {
          doc.addImage(page.image, 'PNG', 10, 10, 133.5, 133.5); // Square image
        } catch (e) {
          console.error("Error adding image to PDF", e);
        }
      }

      // Add Text (Right side)
      if (page.text) {
        doc.setFont("times", "normal");
        doc.setFontSize(16);
        const splitText = doc.splitTextToSize(page.text, 120);
        doc.text(splitText, 153.5, 50);
      }

      // Add Page Number
      doc.setFontSize(10);
      doc.text(`${i === 0 ? 'Cover' : 'Page ' + i}`, 148.5, 200, { align: 'center' });
    }

    doc.save('my-picture-book.pdf');
  };

  return (
    <div className="h-full flex flex-col bg-white rounded-3xl shadow-xl overflow-hidden border border-slate-200 relative">
      <div className="bg-slate-800 p-4 text-white flex items-center justify-between z-10 relative">
        <div className="flex items-center gap-2">
          <BookOpen className="w-5 h-5" />
          <h2 className="font-bold text-lg">Book Preview</h2>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 bg-slate-700/50 rounded-full px-2 py-1">
             <button
                onClick={toggleTTS}
                className={`p-2 rounded-full transition-colors ${isPlayingTTS ? 'text-amber-300 bg-white/10' : 'text-white hover:bg-white/10'}`}
                title={isPlayingTTS ? "Stop Reading" : "Read Aloud"}
                disabled={isAudioLoading}
             >
                {isAudioLoading ? <Loader2 size={18} className="animate-spin" /> : <Volume2 size={18} />}
             </button>
             {isStoryFinished && (
                 <>
                    <div className="w-px h-4 bg-white/20" />
                    <button
                        onClick={toggleAutoPlay}
                        className={`p-2 rounded-full transition-colors ${isAutoPlaying ? 'text-amber-300 bg-white/10' : 'text-white hover:bg-white/10'}`}
                        title={isAutoPlaying ? "Pause Auto-play" : "Start Auto-play"}
                    >
                        {isAutoPlaying ? <Pause size={18} /> : <Play size={18} />}
                    </button>
                    <button
                        onClick={() => {
                            setIsAutoPlaying(true);
                            onPageChange(0);
                        }}
                        className="p-2 text-white hover:bg-white/10 rounded-full transition-colors"
                        title="Restart Auto-play"
                    >
                        <RotateCcw size={18} />
                    </button>
                 </>
             )}
          </div>

          <div className="text-sm opacity-80 font-medium">
            {pages.length > 0 ? `Page ${currentPageIndex === 0 ? 'Cover' : currentPageIndex} / ${pages.length - 1}` : 'New Book'}
          </div>
          {isStoryFinished && (
            <div className="flex gap-2">
              {!readOnly && (
                <button 
                  onClick={handleShare}
                  className="flex items-center gap-2 bg-white/20 hover:bg-white/30 px-3 py-1 rounded-full text-sm transition-colors"
                  title="Share Story"
                >
                  <Share2 size={14} />
                  <span>Share</span>
                </button>
              )}
              <button 
                onClick={handleDownloadPDF}
                className="flex items-center gap-2 bg-white/20 hover:bg-white/30 px-3 py-1 rounded-full text-sm transition-colors"
                title="Download PDF"
              >
                <Download size={14} />
                <span>PDF</span>
              </button>
            </div>
          )}
        </div>
      </div>

      <div className="flex-1 p-6 flex flex-col items-center justify-center overflow-y-auto bg-slate-50 perspective-[1500px]">
        <div className={`w-full max-w-4xl bg-white rounded-2xl shadow-2xl border border-slate-200 flex overflow-hidden relative ${currentPageIndex === 0 ? 'aspect-[1/1.4] max-w-md' : 'aspect-[2/1]'} transform-style-3d`}>
          <AnimatePresence initial={false} custom={direction} mode="popLayout">
            <motion.div
              key={currentPageIndex}
              custom={direction}
              variants={variants}
              initial="enter"
              animate="center"
              exit="exit"
              transition={{
                x: { type: "spring", stiffness: 300, damping: 30 },
                opacity: { duration: 0.2 }
              }}
              className="absolute inset-0 flex w-full h-full"
            >
              {currentPageIndex === 0 ? (
                // Cover View (Full Image)
                <div className="w-full h-full bg-slate-100 flex items-center justify-center relative overflow-hidden">
                  <AnimatePresence mode="wait">
                    {isGenerating && currentPageIndex === pages.length - 1 ? (
                      <motion.div
                        key="loading"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="flex flex-col items-center gap-2 text-slate-400"
                      >
                        <Loader2 className="w-8 h-8 animate-spin" />
                        <span className="text-sm font-medium">Weaving cover...</span>
                      </motion.div>
                    ) : currentPage.image ? (
                      <motion.img
                        key="cover-image"
                        src={currentPage.image}
                        alt="Book Cover"
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <motion.div
                        key="empty-cover"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        className="flex flex-col items-center gap-2 text-slate-300"
                      >
                        <ImageIcon className="w-16 h-16" />
                        <span className="text-lg font-medium">Cover Art</span>
                      </motion.div>
                    )}
                  </AnimatePresence>
                  {/* Glossy overlay effect */}
                  <div className="absolute inset-0 bg-gradient-to-tr from-white/10 to-transparent pointer-events-none" />
                </div>
              ) : (
                // Standard Page View (Split)
                <>
                  {/* Left Page: Image */}
                  <div className="w-1/2 h-full border-r border-slate-200 bg-slate-100 flex items-center justify-center relative overflow-hidden">
                    <AnimatePresence mode="wait">
                      {isGenerating && currentPageIndex === pages.length - 1 ? ( 
                        <motion.div
                          key="loading"
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          exit={{ opacity: 0 }}
                          className="flex flex-col items-center gap-2 text-slate-400"
                        >
                          <Loader2 className="w-8 h-8 animate-spin" />
                          <span className="text-sm font-medium">Weaving image...</span>
                        </motion.div>
                      ) : currentPage.image ? (
                        <motion.img
                          key={`image-${currentPageIndex}`}
                          src={currentPage.image}
                          alt="Story scene"
                          initial={{ opacity: 0, scale: 0.95 }}
                          animate={{ opacity: 1, scale: 1 }}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <motion.div
                          key="empty"
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          className="flex flex-col items-center gap-2 text-slate-300"
                        >
                          <ImageIcon className="w-12 h-12" />
                          <span className="text-sm">Image will appear here</span>
                        </motion.div>
                      )}
                    </AnimatePresence>
                    <div className="absolute right-0 top-0 bottom-0 w-8 bg-gradient-to-l from-black/5 to-transparent pointer-events-none z-10" />
                  </div>

                  {/* Right Page: Text */}
                  <div className="w-1/2 h-full bg-white p-6 flex items-center justify-center relative">
                     <div className="absolute left-0 top-0 bottom-0 w-8 bg-gradient-to-r from-black/5 to-transparent pointer-events-none z-10" />
                     <AnimatePresence mode="wait">
                       {currentPage.text ? (
                         <motion.div
                           key={`text-${currentPageIndex}`}
                           initial={{ opacity: 0, y: 10 }}
                           animate={{ opacity: 1, y: 0 }}
                           className="text-slate-800 font-serif text-lg leading-relaxed text-center"
                         >
                           {currentPage.text}
                         </motion.div>
                       ) : (
                         <motion.div
                           key="empty-text"
                           initial={{ opacity: 0 }}
                           animate={{ opacity: 1 }}
                           className="text-slate-300 text-sm italic"
                         >
                           Story text will appear here...
                         </motion.div>
                       )}
                     </AnimatePresence>
                  </div>
                </>
              )}
            </motion.div>
          </AnimatePresence>
        </div>
        
        {/* Navigation Controls */}
        <div className="mt-8 flex items-center gap-4 z-10 relative">
          <button
            onClick={() => onPageChange(currentPageIndex - 1)}
            disabled={!hasPrev}
            className={`p-2 rounded-full transition-all ${
              hasPrev 
                ? 'bg-slate-100 text-slate-700 hover:bg-slate-200 shadow-sm' 
                : 'bg-slate-50 text-slate-300 cursor-not-allowed'
            }`}
          >
            <ChevronLeft size={24} />
          </button>
          
          <span className="text-slate-500 text-sm font-medium min-w-[100px] text-center">
            {pages.length > 0 
              ? (currentPageIndex === 0 ? 'Cover' : `Scene ${currentPageIndex}`)
              : 'Start'}
          </span>

          <button
            onClick={() => onPageChange(currentPageIndex + 1)}
            disabled={!hasNext}
            className={`p-2 rounded-full transition-all ${
              hasNext 
                ? 'bg-slate-100 text-slate-700 hover:bg-slate-200 shadow-sm' 
                : 'bg-slate-50 text-slate-300 cursor-not-allowed'
            }`}
          >
            <ChevronRight size={24} />
          </button>
        </div>
      </div>
    </div>
  );
};
