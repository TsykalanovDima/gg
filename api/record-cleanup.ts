import { ServiceNowApi } from './service-now-api';

interface CleanupTarget {
  table: string;
  query: string;
}

export interface CleanupReport {
  deleted: string[];
  problems: string[];
}

// Deletes only records matched by run-unique keys, last tracked first.
export class RecordCleanup {
  private readonly targets: CleanupTarget[] = [];

  constructor(private readonly api: ServiceNowApi) {}

  track(table: string, query: string): void {
    this.targets.push({ table, query });
  }

  async deleteTracked(): Promise<CleanupReport> {
    const report: CleanupReport = { deleted: [], problems: [] };

    for (const { table, query } of [...this.targets].reverse()) {
      try {
        const rows = await this.api.query(table, query, ['sys_id']);
        if (rows.length > 1) {
          report.problems.push(`${table}?${query}: ${rows.length} matches, refusing to delete`);
          continue;
        }
        for (const row of rows) {
          const record = `${table}/${row.sys_id.value}`;
          const status = await this.api.delete(table, row.sys_id.value);
          if (status === 204 || status === 404) {
            report.deleted.push(record);
          } else {
            report.problems.push(`${record}: DELETE returned ${status}`);
          }
        }
      } catch (error) {
        report.problems.push(`${table}?${query}: ${(error as Error).message.split('\n')[0]}`);
      }
    }
    return report;
  }
}
