import type { Request, Response } from "express";
import { BackupService } from "../services/BackupService";
import { SummaryService } from "../services/SummaryService";
import { ValidationService } from "../services/ValidationService";
import { HttpError } from "../utils/HttpError";

function stampForFile(): string {
  return new Date().toISOString().slice(0, 10);
}

export const ReportController = {
  month(req: Request, res: Response): void {
    const { year, month } = ValidationService.period(req.query.year, req.query.month);
    res.json(SummaryService.month(year, month));
  },

  year(req: Request, res: Response): void {
    const { year } = ValidationService.period(req.query.year, 1);
    res.json({ year, months: SummaryService.year(year) });
  },

  exportJson(_req: Request, res: Response): void {
    res.setHeader("Content-Disposition", `attachment; filename="backup-financas-${stampForFile()}.json"`);
    res.json(BackupService.exportJson());
  },

  exportCsv(req: Request, res: Response): void {
    const kind = req.params.kind;
    let csv: string;
    if (kind === "lancamentos") {
      csv = BackupService.exportEntriesCsv();
    } else if (kind === "eventos") {
      csv = BackupService.exportEventsCsv();
    } else {
      throw new HttpError(404, "Tipo de exportacao desconhecido.");
    }
    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename="${kind}-${stampForFile()}.csv"`);
    res.send(csv);
  },

  importJson(req: Request, res: Response): void {
    res.json(BackupService.importJson(req.body));
  },
};
