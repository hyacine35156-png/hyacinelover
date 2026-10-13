import { Controller, Get, Param, Req, Res, Render } from '@nestjs/common';
import type { Request, Response } from 'express';
import { join } from 'path';
import { readFileSync, existsSync } from 'fs';
import axios from 'axios';
import { Logger } from '@nestjs/common';

function resolveStaticFile(filename: string): string | null {
  const prodPath = join(
    process.cwd(),
    process.env.NODE_ENV === 'production' ? 'client' : 'dist/client',
    filename,
  );
  if (existsSync(prodPath)) return prodPath;
  const devPath = join(process.cwd(), 'client/public', filename);
  if (existsSync(devPath)) return devPath;
  return null;
}

const ALLOWED_HOSTS = [
  'aka.doubaocdn.com',
  'lf3-static.bytednsdoc.com',
];

@Controller()
export class ViewController {
  private readonly logger = new Logger(ViewController.name);

  @Get('sw.js')
  serveSw(@Res() res: Response): void {
    const filePath = resolveStaticFile('sw.js');
    if (!filePath) {
      res.status(404).send('Service Worker not found');
      return;
    }
    const content = readFileSync(filePath, 'utf-8');
    res.setHeader('Content-Type', 'application/javascript; charset=utf-8');
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.setHeader('Service-Worker-Allowed', '/');
    res.send(content);
  }

  @Get('manifest.json')
  serveManifest(@Res() res: Response): void {
    const filePath = resolveStaticFile('manifest.json');
    if (!filePath) {
      res.status(404).send('Manifest not found');
      return;
    }
    const content = readFileSync(filePath, 'utf-8');
    res.setHeader('Content-Type', 'application/manifest+json; charset=utf-8');
    res.setHeader('Cache-Control', 'no-cache');
    res.send(content);
  }

  @Get('img-proxy/:host/*')
  async proxyImage(
    @Param('host') host: string,
    @Req() req: Request,
    @Res() res: Response,
  ): Promise<void> {
    if (!ALLOWED_HOSTS.includes(host)) {
      res.status(403).send('Host not allowed');
      return;
    }

    const wildcard = (req.params as { '0'?: string })?.['0'] || '';
    const query = req.url.split('?')[1] || '';
    const targetUrl = `https://${host}/${wildcard}${query ? '?' + query : ''}`;

    try {
      const response = await axios.get(targetUrl, {
        responseType: 'stream',
        timeout: 15000,
        maxRedirects: 5,
        validateStatus: (status: number) => status >= 200 && status < 400,
      });

      const contentType = response.headers['content-type'] as string | undefined;
      if (contentType) {
        res.setHeader('Content-Type', contentType);
      }
      res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
      const contentEncoding = response.headers['content-encoding'];
      if (typeof contentEncoding === 'string') {
        res.setHeader('Content-Encoding', contentEncoding);
      }
      res.status(response.status);
      response.data.pipe(res);
    } catch (error) {
      this.logger.error(
        `图片代理失败: ${targetUrl}`,
        error instanceof Error ? error.message : String(error),
      );
      res.status(502).send('Image proxy failed');
    }
  }

  @Get(['/', '*'])
  @Render('index')
  async render(@Req() req: Request): Promise<{ __platform__: string }> {
    const platformData = req.__platform_data__ ?? {};
    return {
      __platform__: JSON.stringify(platformData),
    };
  }
}
