import { Download, CheckCircle2, Loader2 } from 'lucide-react';
import { Button } from '@client/src/components/ui/button';
import { Progress } from '@client/src/components/ui/progress';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@client/src/components/ui/alert-dialog';

interface BankDownloadButtonProps {
  downloaded: boolean;
  downloading: boolean;
  progress: number;
  onDownload: () => void;
  onDelete: () => void;
  bankName: string;
}

/**
 * 题库下载按钮 — 三种状态：未下载 / 下载中 / 已下载
 */
const BankDownloadButton = ({
  downloaded,
  downloading,
  progress,
  onDownload,
  onDelete,
  bankName,
}: BankDownloadButtonProps) => {
  if (downloading) {
    return (
      <div
        className="relative flex h-11 w-11 items-center justify-center rounded-lg border border-border/60 bg-muted/30"
        title={`下载中 ${progress}%`}
      >
        <Loader2 className="h-4 w-4 animate-spin text-primary" />
        <Progress
          value={progress}
          className="absolute bottom-0 left-0 h-0.5 w-full rounded-none"
        />
      </div>
    );
  }

  if (downloaded) {
    return (
      <AlertDialog>
        <AlertDialogTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="h-11 w-11 text-emerald-500 hover:text-emerald-600 hover:bg-emerald-500/10 min-h-[44px]"
            title="已离线缓存，点击删除"
          >
            <CheckCircle2 className="h-4 w-4" />
          </Button>
        </AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>删除离线缓存</AlertDialogTitle>
            <AlertDialogDescription>
              确定要删除「{bankName}」的离线缓存吗？本地缓存的题目数据将被清除，已同步的在线记录不受影响。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction
              onClick={onDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              确认删除
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    );
  }

  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={onDownload}
      className="h-11 w-11 text-muted-foreground hover:text-primary hover:bg-primary/10 min-h-[44px]"
      title="下载到本地，离线可用"
    >
      <Download className="h-4 w-4" />
    </Button>
  );
};

export default BankDownloadButton;
