import { useState } from 'react';
import { MessageCircle } from 'lucide-react';
import FeedbackDialog from './FeedbackDialog';

const FeedbackButton = () => {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="反馈问题"
        title="反馈问题"
        className="fixed bottom-6 right-6 z-50 flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-br from-[hsl(265_85%_65%)] to-[hsl(290_75%_65%)] text-white shadow-lg shadow-primary/30 transition-all duration-300 ease-out hover:-translate-y-1 hover:shadow-xl hover:shadow-primary/40 active:scale-95"
      >
        <MessageCircle className="h-6 w-6" />
      </button>
      <FeedbackDialog open={open} onOpenChange={setOpen} />
    </>
  );
};

export default FeedbackButton;
