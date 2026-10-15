import { useState, useCallback } from 'react';
import { Share2, Copy, Check, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { logger } from '@lark-apaas/client-toolkit/logger';

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@client/src/components/ui/dialog';
import { Button } from '@client/src/components/ui/button';
import { Input } from '@client/src/components/ui/input';

import { questionBankApi } from '@client/src/api';
import { getUrlPrefix } from '@client/src/utils/router';
import type { QuestionBankItem } from '@shared/api.interface';

interface ShareDialogProps {
  bank: QuestionBankItem;
}

const ShareDialog = ({ bank }: ShareDialogProps) => {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [shareUrl, setShareUrl] = useState('');

  const handleOpenChange = useCallback(async (next: boolean) => {
    setOpen(next);
    if (next && !shareUrl) {
      try {
        setLoading(true);
        const info = await questionBankApi.getShareInfo(bank.id);
        if (info.isPublic) {
          // 用客户端当前 origin + urlPrefix 构建准确的分享链接
          const origin =
            typeof window !== 'undefined' ? window.location.origin : '';
          const prefix = getUrlPrefix();
          const fullUrl = `${origin}${prefix}/banks?tab=public&q=${encodeURIComponent(bank.name)}`;
          setShareUrl(fullUrl);
        } else {
          setShareUrl('');
        }
      } catch (error) {
        logger.error('获取分享链接失败', error);
        toast.error('获取分享链接失败');
      } finally {
        setLoading(false);
      }
    }
    if (!next) {
      setCopied(false);
    }
  }, [bank.id, bank.name, shareUrl]);

  const handleCopy = useCallback(async () => {
    if (!shareUrl) return;
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(shareUrl);
      } else {
        const textarea = document.createElement('textarea');
        textarea.value = shareUrl;
        textarea.style.position = 'fixed';
        textarea.style.opacity = '0';
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand('copy');
        document.body.removeChild(textarea);
      }
      setCopied(true);
      toast.success('链接已复制到剪贴板');
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      logger.error('复制链接失败', error);
      toast.error('复制失败，请手动复制');
    }
  }, [shareUrl]);

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="h-11 w-11 text-muted-foreground hover:text-primary hover:bg-primary/10 min-h-[44px]"
          title="分享题集"
        >
          <Share2 className="h-4 w-4" />
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>分享题集</DialogTitle>
          <DialogDescription>
            复制链接分享给好友，对方打开后可查看并复制此题集。
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-2">
          {loading ? (
            <div className="flex items-center justify-center py-8 text-muted-foreground">
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              生成链接中…
            </div>
          ) : shareUrl ? (
            <>
              <div className="flex items-center gap-2">
                <Input
                  readOnly
                  value={shareUrl}
                  className="flex-1 font-mono text-xs"
                  onFocus={(e) => e.target.select()}
                />
                <Button onClick={handleCopy} size="sm" className="shrink-0">
                  {copied ? (
                    <>
                      <Check className="mr-1.5 h-4 w-4" />
                      已复制
                    </>
                  ) : (
                    <>
                      <Copy className="mr-1.5 h-4 w-4" />
                      复制
                    </>
                  )}
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                对方打开链接后，在「公开题集广场」中搜索 <span className="font-medium text-foreground">「{bank.name}」</span> 即可找到。
              </p>
            </>
          ) : (
            <div className="py-4 text-center text-sm text-muted-foreground">
              该题集为私密状态，无法分享。请先在题集设置中设为公开。
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            关闭
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default ShareDialog;
