import { useRef, useState, useEffect } from 'react';
import { Image as ImageIcon, Upload, Trash2, Sparkles, Eye, X, RotateCcw } from 'lucide-react';
import { toast } from 'sonner';
import { logger } from '@lark-apaas/client-toolkit/logger';
import { getDataloom } from '@lark-apaas/client-toolkit/dataloom';
import { getDefaultBucketId } from '@lark-apaas/client-toolkit/tools/storage';
import { Button } from '@client/src/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@client/src/components/ui/card';
import {
  useWallpaper,
  type WallpaperSize,
  type WallpaperType,
  type UserWallpaperItem,
  type TextColorMode,
} from '@client/src/contexts/WallpaperContext';
import { Image as ImageComponent } from '@client/src/components/ui/image';

const SIZE_OPTIONS: { value: WallpaperSize; label: string }[] = [
  { value: 'cover', label: '全覆盖' },
  { value: 'contain', label: '适应' },
  { value: 'stretch', label: '拉伸' },
];

const TEXT_COLOR_OPTIONS: { value: TextColorMode; label: string }[] = [
  { value: 'auto', label: '自动' },
  { value: 'dark', label: '深色' },
  { value: 'light', label: '浅色' },
];

const WallpaperSection = () => {
  const {
    wallpaperType,
    wallpaperUrl,
    wallpaperOpacity,
    wallpaperSize,
    userWallpapers,
    showInPractice,
    textColorMode,
    setWallpaperType,
    setWallpaperUrl,
    setWallpaperOpacity,
    setWallpaperSize,
    addUserWallpaper,
    removeUserWallpaper,
    clearWallpaper,
    setShowInPractice,
    setTextColorMode,
  } = useWallpaper();

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState(false);

  const currentPreviewUrl = wallpaperType !== 'none' ? wallpaperUrl : null;

  const lowOpacity = wallpaperOpacity > 0 && wallpaperOpacity < 15;

  useEffect(() => {
    if (!currentPreviewUrl) {
      setPreviewLoading(false);
      setPreviewError(false);
      return;
    }
    setPreviewLoading(true);
    setPreviewError(false);
    const img = new Image();
    img.onload = () => {
      setPreviewLoading(false);
      setPreviewError(false);
    };
    img.onerror = () => {
      setPreviewLoading(false);
      setPreviewError(true);
      logger.error('[Wallpaper] 壁纸加载失败', currentPreviewUrl);
    };
    img.src = currentPreviewUrl;
  }, [currentPreviewUrl]);

  const handleSelectCustom = (item: UserWallpaperItem): void => {
    setWallpaperType('custom');
    setWallpaperUrl(item.url);
  };

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>): Promise<void> => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 10 * 1024 * 1024) {
      toast.error('图片大小不能超过 10MB');
      return;
    }

    if (!file.type.startsWith('image/')) {
      toast.error('请选择图片文件');
      return;
    }

    setUploading(true);
    try {
      const dataloom = await getDataloom();
      const { data, error } = await dataloom
        .storage
        .from(getDefaultBucketId())
        .uploadFile(file);

      if (error || !data) {
        throw new Error(error?.message ?? '未知错误');
      }

      const newWallpaper: UserWallpaperItem = {
        id: `custom-${Date.now()}`,
        url: data.download_url,
        name: file.name,
      };
      addUserWallpaper(newWallpaper);
      setWallpaperType('custom');
      setWallpaperUrl(data.download_url);
      toast.success('壁纸上传成功，已自动应用');
    } catch (err) {
      logger.error('[Wallpaper] 上传失败', String(err));
      toast.error('壁纸上传失败');
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleRemove = (id: string, e: React.MouseEvent): void => {
    e.stopPropagation();
    removeUserWallpaper(id);
    toast.success('壁纸已删除');
  };

  const handleApply = (): void => {
    if (wallpaperType === 'none' || !wallpaperUrl) {
      toast.info('请先选择一张壁纸');
      return;
    }
    if (previewError) {
      toast.error('当前壁纸加载失败，请更换壁纸');
      return;
    }
    toast.success('壁纸已应用到整个网站');
    logger.info('[Wallpaper] 壁纸已应用', {
      type: wallpaperType,
      url: wallpaperUrl,
      opacity: wallpaperOpacity,
      size: wallpaperSize,
    });
  };

  const handleClear = (): void => {
    clearWallpaper();
    toast.success('壁纸已清除');
  };

  const handleReset = (): void => {
    clearWallpaper();
    setWallpaperOpacity(40);
    setWallpaperSize('cover');
    setShowInPractice(false);
    setTextColorMode('auto');
    toast.success('已恢复默认设置');
  };

  const isActive = (url: string, type: WallpaperType): boolean => {
    return wallpaperType === type && wallpaperUrl === url;
  };

  const sizeStyle = (): string => {
    switch (wallpaperSize) {
      case 'cover': return 'cover';
      case 'contain': return 'contain';
      case 'stretch': return '100% 100%';
    }
  };

  return (
    <Card className="overflow-hidden border-border/60 shadow-sm">
      <CardHeader className="flex flex-row items-center gap-3 pb-4">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
          <ImageIcon className="h-4 w-4" />
        </div>
        <div className="min-w-0 flex-1">
          <CardTitle className="text-sm font-semibold text-foreground">
            壁纸设置
          </CardTitle>
          <p className="mt-0.5 text-xs text-muted-foreground">
            自定义网页背景，让练习更有氛围
          </p>
        </div>
        <Button
          size="sm"
          variant="ghost"
          onClick={handleReset}
          className="h-7 gap-1 px-2 text-xs text-muted-foreground hover:text-foreground"
          title="恢复默认设置"
        >
          <RotateCcw className="h-3.5 w-3.5" />
          恢复默认
        </Button>
      </CardHeader>
      <CardContent className="space-y-5 pt-0">
        {/* 预览区域 */}
        <div className="relative aspect-[16/9] w-full overflow-hidden rounded-lg border border-border/60 bg-muted/30">
          {currentPreviewUrl && !previewError ? (
            <>
              <div
                className="absolute inset-0 transition-opacity duration-300"
                style={{
                  backgroundImage: `url("${currentPreviewUrl}")`,
                  backgroundSize: sizeStyle(),
                  backgroundPosition: 'center',
                  backgroundRepeat: 'no-repeat',
                  opacity: previewLoading ? 0 : wallpaperOpacity / 100,
                }}
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/30 via-transparent to-transparent" />
              {previewLoading && (
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary/30 border-t-primary" />
                </div>
              )}
              <div className="absolute bottom-3 left-3 right-3 flex items-end justify-between">
                <div className="flex flex-col gap-0.5">
                  <p className="text-xs font-medium text-white drop-shadow">
                    预览效果
                  </p>
                  {lowOpacity && (
                    <p className="text-[10px] font-medium text-amber-300 drop-shadow">
                      透明度较低，可能看不到壁纸
                    </p>
                  )}
                </div>
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => setShowPreview(true)}
                  disabled={previewLoading}
                  className="h-7 gap-1 px-2.5 text-xs"
                >
                  <Eye className="h-3.5 w-3.5" />
                  全屏预览
                </Button>
              </div>
            </>
          ) : previewError ? (
            <div className="flex h-full flex-col items-center justify-center gap-2">
              <p className="text-xs text-red-500">壁纸加载失败</p>
              <p className="text-[11px] text-muted-foreground">请尝试更换其他壁纸</p>
            </div>
          ) : (
            <div className="flex h-full items-center justify-center">
              <p className="text-xs text-muted-foreground">选择壁纸后在此预览效果</p>
            </div>
          )}
        </div>

        {/* 我的壁纸 */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <p className="text-xs font-medium text-muted-foreground">
              我的壁纸
            </p>
            <Button
              size="sm"
              variant="outline"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              className="h-7 gap-1 px-2.5 text-xs"
            >
              <Upload className="h-3.5 w-3.5" />
              {uploading ? '上传中...' : '上传壁纸'}
            </Button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleUpload}
              className="hidden"
            />
          </div>
          {userWallpapers.length === 0 ? (
            <div className="flex h-14 items-center justify-center rounded-md border border-dashed border-border/60 bg-muted/20 px-4 text-center">
              <p className="text-[11px] text-muted-foreground">
                点击&quot;上传壁纸&quot;添加自定义壁纸，支持 JPG/PNG/WebP，最大 10MB
              </p>
            </div>
          ) : (
            <div className="flex flex-wrap gap-2">
              {userWallpapers.map((wp) => (
                <div
                  key={wp.id}
                  className={`group relative h-14 w-24 overflow-hidden rounded-md border-2 transition-all duration-200 ${
                    isActive(wp.url, 'custom')
                      ? 'border-primary shadow-sm ring-2 ring-primary/20'
                      : 'border-border/60 hover:border-primary/40'
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => handleSelectCustom(wp)}
                    className="h-full w-full"
                    title={wp.name}
                  >
                    <ImageComponent
                      src={wp.url}
                      alt={wp.name}
                      className="h-full w-full object-cover"
                      loading="lazy"
                    />
                  </button>
                  <button
                    type="button"
                    onClick={(e) => handleRemove(wp.id, e)}
                    className="absolute right-0 top-0 flex h-5 w-5 items-center justify-center rounded-bl-md bg-black/60 text-white opacity-0 transition-opacity group-hover:opacity-100 hover:bg-red-500"
                    title="删除壁纸"
                  >
                    <Trash2 className="h-3 w-3" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="border-t border-border/40" />

        {/* 透明度 */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <p className="text-xs font-medium text-muted-foreground">
              透明度
            </p>
            <span className={`text-xs font-medium ${lowOpacity ? 'text-amber-600' : 'text-foreground'}`}>
              {wallpaperOpacity}%
              {lowOpacity && ' (偏低)'}
            </span>
          </div>
          <input
            type="range"
            min={0}
            max={100}
            value={wallpaperOpacity}
            onChange={(e) => setWallpaperOpacity(Number(e.target.value))}
            className="h-2 w-full cursor-pointer appearance-none rounded-full bg-muted accent-primary"
          />
        </div>

        {/* 显示模式 */}
        <div className="space-y-2">
          <p className="text-xs font-medium text-muted-foreground">
            显示模式
          </p>
          <div className="inline-flex rounded-lg bg-muted p-1 ring-1 ring-border/40">
            {SIZE_OPTIONS.map((option) => {
              const active = wallpaperSize === option.value;
              return (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => setWallpaperSize(option.value)}
                  className={`rounded-md px-3 py-1 text-xs font-medium transition-all duration-200 ${
                    active
                      ? 'bg-card text-primary shadow-sm ring-1 ring-border/60'
                      : 'text-muted-foreground hover:text-foreground hover:bg-card/50'
                  }`}
                >
                  {option.label}
                </button>
              );
            })}
          </div>
        </div>

         {/* 在刷题界面显示壁纸 */}
         <div className="space-y-2">
           <div className="flex items-center justify-between">
             <div>
               <p className="text-xs font-medium text-foreground">
                  在练习界面显示壁纸
               </p>
               <p className="mt-0.5 text-[11px] text-muted-foreground">
                  开启后练习页面也会显示壁纸背景，保持沉浸感
               </p>
             </div>
             <button
               type="button"
               onClick={() => setShowInPractice(!showInPractice)}
               className={`relative h-6 w-11 shrink-0 rounded-full transition-colors duration-200 ${
                 showInPractice ? 'bg-primary' : 'bg-muted'
               }`}
               aria-checked={showInPractice}
               role="switch"
             >
               <span
                 className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform duration-200 ${
                   showInPractice ? 'translate-x-[22px]' : 'translate-x-0.5'
                 }`}
               />
             </button>
           </div>
         </div>

         {/* 文字颜色模式 */}
         <div className="space-y-2">
           <div className="flex items-center justify-between">
             <p className="text-xs font-medium text-muted-foreground">
               文字颜色
             </p>
           </div>
           <div className="inline-flex rounded-lg bg-muted p-1 ring-1 ring-border/40">
             {TEXT_COLOR_OPTIONS.map((option) => {
               const active = textColorMode === option.value;
               return (
                 <button
                   key={option.value}
                   type="button"
                   onClick={() => setTextColorMode(option.value)}
                   className={`rounded-md px-3 py-1 text-xs font-medium transition-all duration-200 ${
                     active
                       ? 'bg-card text-primary shadow-sm ring-1 ring-border/60'
                       : 'text-muted-foreground hover:text-foreground hover:bg-card/50'
                   }`}
                 >
                   {option.label}
                 </button>
               );
             })}
           </div>
           <p className="text-[11px] text-muted-foreground">
             自动模式会根据壁纸亮度自适应文字颜色
           </p>
         </div>

         {/* 操作按钮 */}
         <div className="flex items-center justify-between pt-2">
          <Button
            size="sm"
            variant="ghost"
            onClick={handleClear}
            disabled={wallpaperType === 'none'}
            className="h-8 text-xs text-muted-foreground hover:text-destructive"
          >
            清除壁纸
          </Button>
          <Button
            size="sm"
            onClick={handleApply}
            className="h-8 gap-1.5"
          >
            <Sparkles className="h-3.5 w-3.5" />
            应用壁纸
          </Button>
        </div>
      </CardContent>

      {/* 全屏预览弹窗 */}
      {showPreview && currentPreviewUrl && !previewError && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm"
          onClick={() => setShowPreview(false)}
        >
          <button
            type="button"
            onClick={() => setShowPreview(false)}
            className="absolute right-4 top-4 flex h-9 w-9 items-center justify-center rounded-full bg-white/10 text-white hover:bg-white/20"
            aria-label="关闭预览"
          >
            <X className="h-5 w-5" />
          </button>
          <div className="relative h-5/6 w-5/6 max-w-5xl overflow-hidden rounded-xl shadow-2xl">
            <div
              className="absolute inset-0"
              style={{
                backgroundImage: `url("${currentPreviewUrl}")`,
                backgroundSize: sizeStyle(),
                backgroundPosition: 'center',
                backgroundRepeat: 'no-repeat',
                opacity: wallpaperOpacity / 100,
              }}
            />
            <div className="absolute inset-0 bg-white/10">
              <div className="mx-auto h-full max-w-lg px-6 pt-20">
                <div className="rounded-xl bg-white/90 p-6 shadow-lg backdrop-blur">
                  <h3 className="text-base font-bold text-foreground">预览效果</h3>
                  <p className="mt-2 text-sm text-muted-foreground">
                    这是壁纸应用后的实际效果示意，内容层在壁纸之上，不会影响阅读。
                  </p>
                  <div className="mt-4 h-2 rounded-full bg-muted">
                    <div className="h-full w-2/3 rounded-full bg-primary" />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </Card>
  );
};

export default WallpaperSection;
