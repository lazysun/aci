import React from 'react';
import { Routes, Route } from 'react-router-dom';
import { useWeaver } from './hooks/useWeaver';
import { ChatInterface } from './components/ChatInterface';
import { BookPreview } from './components/BookPreview';
import { ShareView } from './components/ShareView';

function Creator() {
  const { 
    messages, 
    isTyping, 
    sendMessage, 
    pages,
    currentPageIndex,
    setCurrentPageIndex,
    isGeneratingImage,
    isStoryFinished
  } = useWeaver();

  return (
    <div className="h-screen w-screen bg-slate-100 flex flex-col overflow-hidden font-sans text-slate-900">
      <div className="flex-1 p-4 md:p-6 overflow-hidden">
        <div className="max-w-7xl mx-auto h-full grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Left Column: Chat */}
          <div className="lg:col-span-4 h-full overflow-hidden">
            <ChatInterface 
              messages={messages} 
              isTyping={isTyping} 
              onSendMessage={sendMessage} 
            />
          </div>

          {/* Right Column: Preview */}
          <div className="lg:col-span-8 h-full overflow-hidden">
            <BookPreview 
              pages={pages}
              currentPageIndex={currentPageIndex}
              onPageChange={setCurrentPageIndex}
              isGenerating={isGeneratingImage}
              isStoryFinished={isStoryFinished}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

function App() {
  return (
    <Routes>
      <Route path="/" element={<Creator />} />
      <Route path="/share/:id" element={<ShareView />} />
    </Routes>
  );
}

export default App;
