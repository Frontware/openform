'use client'

import { useState } from 'react';
import { Download, FileSpreadsheet, FileText, Loader2 } from 'lucide-react';
import { downloadAnalyticsExport } from '@/lib/grpc-client';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';

interface ExportButtonProps {
  formId: string;
  startDate: Date;
  endDate: Date;
}

export function ExportButton({ formId, startDate, endDate }: ExportButtonProps) {
  const t = useTranslations('analytics');
  const [isExporting, setIsExporting] = useState(false);
  const [showMenu, setShowMenu] = useState(false);

  const handleExport = async (format: 'csv' | 'xlsx' | 'pdf') => {
    setIsExporting(true);
    setShowMenu(false);

    try {
      const result = await downloadAnalyticsExport(formId, format, startDate, endDate);
      // Show success notification
      toast.success(`${t('export')} ${t('success')}: ${result.filename}`);
    } catch (error) {
      toast.error(t('error'));
      console.error('Export error:', error);
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="relative">
      <button
        onClick={() => setShowMenu(!showMenu)}
        disabled={isExporting}
        className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed outline-none"
      >
        {isExporting ? (
          <>
            <Loader2 className="w-4 h-4 animate-spin" />
            {t('exporting')}
          </>
        ) : (
          <>
            <Download className="w-4 h-4" />
            {t('export')}
          </>
        )}
      </button>

      {showMenu && !isExporting && (
        <div className="absolute right-0 mt-2 w-48 bg-white rounded-lg shadow-lg border border-gray-200 py-1 z-10">
          <button
            onClick={() => handleExport('csv')}
            className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2"
          >
            <FileText className="w-4 h-4" />
            {t('exportCsv')}
          </button>
          <button
            onClick={() => handleExport('xlsx')}
            className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2"
          >
            <FileSpreadsheet className="w-4 h-4" />
            {t('exportExcel')}
          </button>
          <button
            onClick={() => handleExport('pdf')}
            className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2 opacity-50 cursor-not-allowed"
            disabled
          >
            <FileText className="w-4 h-4" />
            {t('exportPdf')}
          </button>
        </div>
      )}
    </div>
  );
}

