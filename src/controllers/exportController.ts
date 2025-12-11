import { Request, Response } from 'express';
import { exportCsv, exportExcel, exportPdf } from '../services/exportService';

export const csv = async (req: Request, res: Response) => {
  const data = await exportCsv(req.user!);
  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', 'attachment; filename=transactions.csv');
  return res.send(data);
};

export const excel = async (req: Request, res: Response) => {
  const buffer = await exportExcel(req.user!);
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', 'attachment; filename=transactions.xlsx');
  return res.send(buffer);
};

export const pdf = async (req: Request, res: Response) => {
  const buffer = await exportPdf(req.user!);
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', 'attachment; filename=transactions.pdf');
  return res.send(buffer);
};

