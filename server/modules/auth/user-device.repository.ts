import { Injectable } from '@nestjs/common';
import { Inject } from '@nestjs/common';
import { DRIZZLE_DATABASE, type PostgresJsDatabase } from '@lark-apaas/fullstack-nestjs-core';
import { sql } from 'drizzle-orm';
import type { UserDeviceItem } from '@shared/api.interface';

interface UserDeviceRow {
  id: string;
  user_id: string;
  device_id: string;
  device_name: string;
  browser: string | null;
  os: string | null;
  ip_address: string | null;
  last_active_at: Date;
  _created_at: Date;
}

function rowToItem(row: UserDeviceRow, currentDeviceId: string): UserDeviceItem {
  return {
    id: row.id,
    userId: row.user_id,
    deviceId: row.device_id,
    deviceName: row.device_name,
    browser: row.browser,
    os: row.os,
    ipAddress: row.ip_address,
    lastActiveAt: row.last_active_at.toISOString(),
    createdAt: row._created_at.toISOString(),
    isCurrent: row.device_id === currentDeviceId,
  };
}

@Injectable()
export class UserDeviceRepository {
  constructor(
    @Inject(DRIZZLE_DATABASE) private readonly db: PostgresJsDatabase,
  ) {}

  /**
   * Upsert a device record for a user.
   * Updates last_active_at if the device already exists.
   */
  async upsertDevice(params: {
    userId: string;
    deviceId: string;
    deviceName: string;
    browser?: string;
    os?: string;
    ipAddress?: string;
  }): Promise<void> {
    const { userId, deviceId, deviceName, browser, os, ipAddress } = params;
    await this.db.execute(sql`
      INSERT INTO user_device (user_id, device_id, device_name, browser, os, ip_address, last_active_at)
      VALUES (${userId}::uuid, ${deviceId}, ${deviceName}, ${browser ?? null}, ${os ?? null}, ${ipAddress ?? null}, CURRENT_TIMESTAMP)
      ON CONFLICT (user_id, device_id) DO UPDATE
      SET
        device_name = EXCLUDED.device_name,
        browser = EXCLUDED.browser,
        os = EXCLUDED.os,
        ip_address = COALESCE(EXCLUDED.ip_address, user_device.ip_address),
        last_active_at = CURRENT_TIMESTAMP
    `);
  }

  /**
   * Check if a device exists for a user.
   * Returns true if the device record exists.
   */
  async deviceExists(userId: string, deviceId: string): Promise<boolean> {
    const result = await this.db.execute(sql<{ count: string }>`
      SELECT COUNT(*)::text AS count
      FROM user_device
      WHERE user_id = ${userId}::uuid AND device_id = ${deviceId}
    `);
    const rows = result as unknown as { count: string }[];
    return Number(rows[0]?.count ?? '0') > 0;
  }

  /**
   * Get all devices for a user, ordered by last_active_at DESC.
   */
  async listDevices(userId: string, currentDeviceId: string): Promise<UserDeviceItem[]> {
    const result = await this.db.execute(sql<UserDeviceRow>`
      SELECT id, user_id, device_id, device_name, browser, os, ip_address, last_active_at, _created_at
      FROM user_device
      WHERE user_id = ${userId}::uuid
      ORDER BY last_active_at DESC
    `);
    const rows = result as unknown as UserDeviceRow[];
    return rows.map((row: UserDeviceRow) => rowToItem(row, currentDeviceId));
  }

  /**
   * Delete a specific device for a user.
   * Returns the number of deleted rows.
   */
  async deleteDevice(userId: string, deviceId: string): Promise<number> {
    const result = await this.db.execute(sql`
      DELETE FROM user_device
      WHERE user_id = ${userId}::uuid AND device_id = ${deviceId}
    `);
    // drizzle returns { rowCount } for delete via execute
    const meta = result as unknown as { rowCount?: number };
    return meta.rowCount ?? 0;
  }

  /**
   * Delete all devices for a user except the specified one.
   * Returns the number of deleted rows.
   */
  async deleteOtherDevices(userId: string, keepDeviceId: string): Promise<number> {
    const result = await this.db.execute(sql`
      DELETE FROM user_device
      WHERE user_id = ${userId}::uuid AND device_id <> ${keepDeviceId}
    `);
    const meta = result as unknown as { rowCount?: number };
    return meta.rowCount ?? 0;
  }
}
