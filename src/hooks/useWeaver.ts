import { useState, useEffect, useRef } from 'react';
import { createChatSession, generateImage, ChatMessage } from '../services/gemini';
import { WEAVER_SYSTEM_INSTRUCTION } from '../constants';

import { useState, useEffect, useRef } from 'react';
import { createChatSession, generateImage, ChatMessage } from '../services/gemini';
import { WEAVER_SYSTEM_INSTRUCTION } from '../constants';

export interface BookPage {
  image: string | null;
  text: string | null;
}

export const useWeaver = () => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isTyping, setIsTyping] = useState(false);
  const [isGeneratingImage, setIsGeneratingImage] = useState(false);
  
  const [pages, setPages] = useState<BookPage[]>([]);
  const [currentPageIndex, setCurrentPageIndex] = useState(0);
  const [isStoryFinished, setIsStoryFinished] = useState(false);
  
  // Use a ref to keep track of the chat session
  const chatSession = useRef<any>(null);

  useEffect(() => {
    // Initialize chat on mount
    const initChat = async () => {
      try {
        chatSession.current = createChatSession(WEAVER_SYSTEM_INSTRUCTION);
        setIsTyping(true);
        const response = await chatSession.current.sendMessage({ message: "Hello, please start." });
        const text = response.text;
        setMessages([{ role: 'model', text }]);
      } catch (error) {
        console.error("Failed to start chat:", error);
      } finally {
        setIsTyping(false);
      }
    };

    initChat();
  }, []);

  const sendMessage = async (text: string) => {
    if (!chatSession.current) return;

    // Add user message immediately
    const userMsg: ChatMessage = { role: 'user', text };
    setMessages(prev => [...prev, userMsg]);
    setIsTyping(true);

    try {
      const response = await chatSession.current.sendMessage({ message: text });
      const responseText = response.text;
      
      // Add model message
      const modelMsg: ChatMessage = { role: 'model', text: responseText };
      setMessages(prev => [...prev, modelMsg]);

      // Parse for tags
      await parseAndHandleTags(responseText);

    } catch (error) {
      console.error("Error sending message:", error);
      setMessages(prev => [...prev, { role: 'model', text: "I'm sorry, I encountered an error. Please try again." }]);
    } finally {
      setIsTyping(false);
    }
  };

  const parseAndHandleTags = async (text: string) => {
    const promptRegex = /\[NANO_BANANA_PROMPT:\s*(.*?)\]/s;
    const textRegex = /\[BOOK_PAGE_TEXT:\s*(.*?)\]/s;
    const finishedRegex = /\[STORY_FINISHED\]/s;

    const promptMatch = text.match(promptRegex);
    const textMatch = text.match(textRegex);
    const finishedMatch = text.match(finishedRegex);

    if (finishedMatch) {
      setIsStoryFinished(true);
    }

    if (!promptMatch && !textMatch) return;

    // Determine Target Index
    let targetIndex = -1;
    
    const sceneMatch = text.match(/Scene\s+(\d+)/i);
    const coverMatch = text.match(/cover/i);

    if (sceneMatch && coverMatch) {
        // Both found, prioritize the one that appears first in the text
        // e.g. "Here is the Cover showing Scene 1" -> Cover is subject
        // e.g. "In Scene 1, unlike the Cover" -> Scene 1 is subject
        if ((coverMatch.index || 0) < (sceneMatch.index || 0)) {
            targetIndex = 0;
        } else {
            targetIndex = parseInt(sceneMatch[1], 10);
        }
    } else if (sceneMatch) {
        targetIndex = parseInt(sceneMatch[1], 10);
    } else if (coverMatch) {
        targetIndex = 0;
    } else if (textMatch) {
       targetIndex = -1; 
    } else if (promptMatch && !textMatch) {
       targetIndex = currentPageIndex;
    }

    // Override: If "Cover" is explicitly the subject of the prompt generation phase
    if (coverMatch && promptMatch && !textMatch) {
        // Double check if "Scene" is not the *primary* label (e.g. "Scene 1")
        // If the prompt contains "cover" and we are in prompt-only mode, it's likely the cover.
        // But we must respect the sceneMatch logic above if "Scene 1" was the header.
        
        // Actually, if we are in Phase 2 (Cover), there is NO text tag.
        // If we are in Phase 3 (Scene), there IS a text tag usually.
        // So !textMatch is a strong indicator of Cover phase OR an image edit.
        
        // If we detected targetIndex = 1 because of "Scene 1" inside the prompt, 
        // but the prompt ALSO says "cover" and appears first... the logic above handles it.
        
        // Let's trust the index comparison logic above.
    }

    // Update Text immediately if present, OR if we need to initialize the page for a prompt
    if (textMatch || promptMatch) {
       setPages(prev => {
         const effectiveIndex = targetIndex !== -1 ? targetIndex : Math.max(0, prev.length - 1);
         
         // Create copy and expand if needed
         const newPages = [...prev];
         while (newPages.length <= effectiveIndex) {
           newPages.push({ image: null, text: null });
         }

         if (textMatch) {
           newPages[effectiveIndex] = {
             ...newPages[effectiveIndex],
             text: textMatch[1].trim()
           };
         }
         
         return newPages;
       });

       // Update index if explicit target
       if (targetIndex !== -1) {
           setCurrentPageIndex(targetIndex);
       }
    }

    // Handle Image Generation
    if (promptMatch) {
      const prompt = promptMatch[1].trim();
      setIsGeneratingImage(true);
      try {
        const imageUrl = await generateImage(prompt);
        if (imageUrl) {
          setPages(prev => {
            const effectiveIndex = targetIndex !== -1 ? targetIndex : Math.max(0, prev.length - 1);
            
            const newPages = [...prev];
            while (newPages.length <= effectiveIndex) {
               newPages.push({ image: null, text: null });
            }
            
            newPages[effectiveIndex] = {
              ...newPages[effectiveIndex],
              image: imageUrl
            };
            return newPages;
          });
        }
      } catch (err) {
        console.error("Image generation error:", err);
      } finally {
        setIsGeneratingImage(false);
      }
    }
  };

  return {
    messages,
    isTyping,
    sendMessage,
    pages,
    currentPageIndex,
    setCurrentPageIndex,
    isGeneratingImage,
    isStoryFinished
  };
};
