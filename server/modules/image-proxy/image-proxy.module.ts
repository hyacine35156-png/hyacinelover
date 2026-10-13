// Placeholder to prevent stale dist image-proxy module warnings.
// The real image proxy route is implemented in ViewController (server/modules/view/view.controller.ts).
// This file exists only to satisfy the module registration check against compiled dist artifacts.
import { Module } from '@nestjs/common';

@Module({})
export class ImageProxyModule {}
