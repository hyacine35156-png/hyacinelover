import { Home, SearchX } from 'lucide-react';
import { Button } from '@client/src/components/ui/button';
import { useNavigate } from '@client/src/utils/router';

const NotFound = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <div className="w-full max-w-md bg-card rounded-xl shadow-sm border border-border/60 p-8 text-center fade-in-up">
        <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-gradient-to-br from-[hsl(265_85%_92%)] to-[hsl(290_75%_92%)] flex items-center justify-center">
          <SearchX className="w-10 h-10 text-primary" strokeWidth={1.5} />
        </div>

        <h1 className="text-2xl font-semibold text-foreground mb-2">
          页面不存在
        </h1>
        <p className="text-muted-foreground text-sm mb-8 leading-relaxed">
          您访问的页面可能已被移除、重命名，或者链接输入有误。
          <br />
           请检查网址是否正确，或返回题集首页继续练习。
        </p>

        <Button
          onClick={() => navigate('/banks')}
          size="lg"
          className="w-full text-white"
          style={{
            background:
              'linear-gradient(135deg, hsl(265 85% 65%) 0%, hsl(290 75% 65%) 100%)',
            border: 'none',
            boxShadow: '0 4px 12px -2px hsl(265 85% 65% / 0.35)',
          }}
        >
          <Home className="w-4 h-4" />
           返回题集首页
        </Button>
      </div>
    </div>
  );
};

export default NotFound;
