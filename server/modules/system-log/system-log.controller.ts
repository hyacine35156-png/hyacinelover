import {
  Controller,
  Get,
  Query,
  Req,
  BadRequestException,
  Res,
  Post,
  Body,
  Header,
} from '@nestjs/common';
import type { Request, Response } from 'express';

import { NeedAppLogin, NeedAdmin } from '../auth/jwt.guard';
import { SystemLogService } from './system-log.service';

import type {
  SystemLogListResponse,
  SystemLogStatsResponse,
  SystemLogExportFormat,
  SystemLogType,
  SystemLogExportRequest,
} from '@shared/api.interface';

@Controller('api/admin/system-logs')
export class SystemLogController {
  constructor(private readonly logService: SystemLogService) {}

  @Get()
  @NeedAppLogin()
  @NeedAdmin()
  async listLogs(
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
    @Query('logType') logType?: string,
    @Query('logTypes') logTypes?: string,
    @Query('username') username?: string,
    @Query('status') status?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('keyword') keyword?: string,
    @Req() req?: Request,
  ): Promise<SystemLogListResponse> {
    const logTypesArr = logTypes
      ? (logTypes.split(',').filter(Boolean) as SystemLogType[])
      : undefined;

    return this.logService.listLogs({
      page: page ? parseInt(page, 10) : undefined,
      pageSize: pageSize ? parseInt(pageSize, 10) : undefined,
      logType: (logType as SystemLogType) ?? undefined,
      logTypes: logTypesArr,
      username,
      status: (status as 'success' | 'failed') ?? undefined,
      startDate,
      endDate,
      keyword,
    });
  }

  @Get('stats')
  @NeedAppLogin()
  @NeedAdmin()
  async getStats(): Promise<SystemLogStatsResponse> {
    return this.logService.getStats();
  }

  @Post('export')
  @NeedAppLogin()
  @NeedAdmin()
  @Header('Content-Type', 'application/octet-stream')
  async exportLogs(
    @Body() body: SystemLogExportRequest,
    @Req() req: Request,
    @Res() res?: Response,
  ): Promise<void> {
    if (!res) throw new BadRequestException('No response object');

    const format = body.format;
    if (!['csv', 'excel', 'json'].includes(format)) {
      throw new BadRequestException('不支持的导出格式');
    }

    const total = await this.logService.getLogCount({
      logType: body.logType,
      logTypes: body.logTypes,
      username: body.username,
      status: body.status,
      startDate: body.startDate,
      endDate: body.endDate,
      keyword: body.keyword,
      ids: body.ids,
    });

    if (total > 10000) {
      throw new BadRequestException(
        `导出数据量过大（${total}条），请缩小时间范围或筛选条件（不超过10000条）`,
      );
    }

    const items = await this.logService.exportLogs(
      {
        logType: body.logType,
        logTypes: body.logTypes,
        username: body.username,
        status: body.status,
        startDate: body.startDate,
        endDate: body.endDate,
        keyword: body.keyword,
        ids: body.ids,
      },
      10000,
    );

    const timestamp = new Date()
      .toISOString()
      .replace(/[:.]/g, '-')
      .slice(0, 19);

    if (format === 'json') {
      res.setHeader(
        'Content-Disposition',
        `attachment; filename="system-logs-${timestamp}.json"`,
      );
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      res.send(JSON.stringify(items, null, 2));
    } else if (format === 'csv') {
      const csv = this.generateCsv(items);
      res.setHeader(
        'Content-Disposition',
        `attachment; filename="system-logs-${timestamp}.csv"`,
      );
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.send('\uFEFF' + csv);
    } else {
      const xlsx = await import('exceljs');
      const workbook = new xlsx.Workbook();
      const sheet = workbook.addWorksheet('系统日志');
      sheet.columns = [
        { header: '操作时间', key: 'createdAt', width: 22 },
        { header: '用户名', key: 'username', width: 15 },
        { header: '操作类型', key: 'logType', width: 12 },
        { header: '操作描述', key: 'action', width: 20 },
        { header: '目标类型', key: 'targetType', width: 15 },
        { header: '目标名称', key: 'targetName', width: 25 },
        { header: 'IP地址', key: 'ipAddress', width: 15 },
        { header: '浏览器', key: 'browser', width: 12 },
        { header: '操作系统', key: 'os', width: 12 },
        { header: '状态', key: 'status', width: 10 },
        { header: '错误信息', key: 'errorMessage', width: 25 },
        { header: '详情', key: 'detail', width: 40 },
      ];
      for (const item of items) {
        const deviceInfo = item.deviceInfo as Record<string, string> | undefined;
        sheet.addRow({
          createdAt: item.createdAt,
          username: item.username ?? '',
          logType: item.logType,
          action: item.action,
          targetType: item.targetType ?? '',
          targetName: item.targetName ?? '',
          ipAddress: item.ipAddress ?? '',
          browser: deviceInfo?.browser ?? '',
          os: deviceInfo?.os ?? '',
          status: item.status,
          errorMessage: item.errorMessage ?? '',
          detail: item.detail ?? '',
        });
      }
      res.setHeader(
        'Content-Disposition',
        `attachment; filename="system-logs-${timestamp}.xlsx"`,
      );
      res.setHeader(
        'Content-Type',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      );
      await workbook.xlsx.write(res);
      res.end();
    }

    const appUser = req?.appUser;
    this.logService.logAsync({
      logType: 'export',
      action: '导出系统日志',
      userId: appUser?.id,
      username: appUser?.username,
      detail: `格式：${format}，数量：${items.length}条`,
      status: 'success',
      req,
    });
  }

  private generateCsv(items: Array<{
    createdAt: string;
    username?: string;
    logType: string;
    action: string;
    targetType?: string;
    targetName?: string;
    ipAddress?: string;
    deviceInfo?: Record<string, unknown>;
    status: string;
    errorMessage?: string;
    detail?: string;
  }>): string {
    const headers = [
      '操作时间',
      '用户名',
      '操作类型',
      '操作描述',
      '目标类型',
      '目标名称',
      'IP地址',
      '浏览器',
      '操作系统',
      '状态',
      '错误信息',
      '详情',
    ];
    const rows = items.map((item) => {
      const deviceInfo = item.deviceInfo as Record<string, string> | undefined;
      return [
        item.createdAt,
        item.username ?? '',
        item.logType,
        item.action,
        item.targetType ?? '',
        item.targetName ?? '',
        item.ipAddress ?? '',
        deviceInfo?.browser ?? '',
        deviceInfo?.os ?? '',
        item.status,
        item.errorMessage ?? '',
        (item.detail ?? '').replace(/\n/g, ' '),
      ];
    });
    const escape = (val: string): string => {
      if (val.includes(',') || val.includes('"') || val.includes('\n')) {
        return '"' + val.replace(/"/g, '""') + '"';
      }
      return val;
    };
    return [headers, ...rows]
      .map((row) => row.map(escape).join(','))
      .join('\n');
  }
}
