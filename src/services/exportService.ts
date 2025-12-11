import { Parser } from 'json2csv';
import ExcelJs from 'exceljs';
import PDFDocument from 'pdfkit';
import Transaction from '../models/transaction';
import { IUserDocument } from '../models/user';

export const exportCsv = async (user: IUserDocument) => {
  const transactions = await Transaction.find({ user: user.id });
  const parser = new Parser({
    fields: ['title', 'amount', 'type', 'category', 'date', 'notes'],
  });
  return parser.parse(transactions);
};

export const exportExcel = async (user: IUserDocument) => {
  const transactions = await Transaction.find({ user: user.id });
  const workbook = new ExcelJs.Workbook();
  const sheet = workbook.addWorksheet('Transactions');
  sheet.columns = [
    { header: 'Title', key: 'title' },
    { header: 'Amount', key: 'amount' },
    { header: 'Type', key: 'type' },
    { header: 'Category', key: 'category' },
    // { header: 'Account', key: 'account' }, // Removed
    { header: 'Date', key: 'date' },
    { header: 'Notes', key: 'notes' },
  ];
  transactions.forEach((tx) =>
    sheet.addRow({
      title: tx.title,
      amount: tx.amount,
      type: tx.type,
      category: tx.category,
      // account: (tx.account as any)?.name, // Removed
      date: tx.date,
      notes: tx.notes,
    })
  );
  const buffer = await workbook.xlsx.writeBuffer();
  return buffer;
};

export const exportPdf = async (user: IUserDocument) => {
  const doc = new PDFDocument();
  const chunks: Buffer[] = [];
  doc.on('data', (chunk) => chunks.push(chunk as Buffer));
  doc.on('end', () => { });
  doc.fontSize(18).text('Transactions Report', { align: 'center' });
  doc.moveDown();
  const transactions = await Transaction.find({ user: user.id }).sort({ date: -1 }).limit(100);
  transactions.forEach((tx) => {
    doc
      .fontSize(12)
      .text(
        `${tx.date.toDateString()} | ${tx.title} | ${tx.type === 'income' ? '+' : '-'}${tx.amount} | ${tx.category}`
      );
  });
  doc.end();
  return new Promise<Buffer>((resolve) => {
    doc.on('end', () => {
      resolve(Buffer.concat(chunks));
    });
  });
};

