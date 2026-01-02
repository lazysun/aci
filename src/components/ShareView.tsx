import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { BookPreview } from './BookPreview';
import { BookPage } from '../hooks/useWeaver';
import { Loader2, ArrowLeft } from 'lucide-react';

export const ShareView: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const [pages, setPages] = useState<BookPage[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentPageIndex, setCurrentPageIndex] = useState(0);

  useEffect(() => {
    const fetchStory = async () => {
      try {
        const res = await fetch(`/api/stories/${id}`);
        if (!res.ok) throw new Error('Story not found');
        const data = await res.json();
        setPages(data.pages);
      } catch (err) {
        setError('Failed to load story');
      } finally {
        setLoading(false);
      }
    };

    if (id) fetchStory();
  }, [id]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-100">
        <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
      </div>
    );
  }

  if (error || pages.length === 0) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-slate-100 gap-4">
        <p className="text-red-500 font-medium">{error || 'Story is empty'}</p>
        <Link to="/" className="text-indigo-600 hover:underline flex items-center gap-2">
          <ArrowLeft size={16} /> Create your own
        </Link>
      </div>
    );
  }

  return (
    <div className="h-screen w-screen bg-slate-100 flex flex-col overflow-hidden">
      <div className="p-4 bg-white shadow-sm flex items-center justify-between">
        <Link to="/" className="text-slate-600 hover:text-indigo-600 flex items-center gap-2 font-medium transition-colors">
          <ArrowLeft size={20} />
          <span>Create New Story</span>
        </Link>
        <h1 className="font-bold text-slate-800">Shared Story Preview</h1>
        <div className="w-24" /> {/* Spacer for centering */}
      </div>
      
      <div className="flex-1 p-4 md:p-8 overflow-hidden flex items-center justify-center">
        <div className="w-full max-w-5xl h-full max-h-[800px]">
          <BookPreview 
            pages={pages}
            currentPageIndex={currentPageIndex}
            onPageChange={setCurrentPageIndex}
            isGenerating={false}
            isStoryFinished={true} // Allow PDF download in shared view
            readOnly={true} // Add this prop to hide "Share" button in shared view
          />
        </div>
      </div>
    </div>
  );
};
