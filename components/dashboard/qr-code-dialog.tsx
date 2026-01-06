'use client'

import { useTranslations } from 'next-intl'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { QRCodeSVG } from 'qrcode.react'
import { Button } from '@/components/ui/button'
import { Download } from 'lucide-react'
import { toast } from 'sonner'

interface QRCodeDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  formUrl: string
  formTitle: string
}

export function QRCodeDialog({ open, onOpenChange, formUrl, formTitle }: QRCodeDialogProps) {
  const t = useTranslations('dashboard.qrCode')

  const handleDownload = () => {
    const svg = document.getElementById('qr-code-svg') as unknown as SVGSVGElement
    if (!svg) return

    const svgData = new XMLSerializer().serializeToString(svg)
    const canvas = document.createElement('canvas')
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const img = new Image()
    img.onload = () => {
      canvas.width = img.width
      canvas.height = img.height
      ctx.drawImage(img, 0, 0)

      const pngFile = canvas.toDataURL('image/png')
      const downloadLink = document.createElement('a')
      downloadLink.href = pngFile
      downloadLink.download = `qr-code-${formTitle.replace(/\s+/g, '-').toLowerCase()}.png`
      downloadLink.click()

      toast.success(t('downloaded'))
    }
    img.src = 'data:image/svg+xml;base64,' + btoa(svgData)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t('title')}</DialogTitle>
          <DialogDescription>
            {t('description')}
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col items-center gap-4 py-4">
          <div className="p-4 bg-white rounded-lg border-2 border-slate-200">
            <QRCodeSVG
              id="qr-code-svg"
              value={formUrl}
              size={200}
              level="M"
              includeMargin={true}
            />
          </div>

          <div className="text-center text-sm text-slate-600">
            <p className="font-medium">{formTitle}</p>
            <p className="text-xs text-slate-500 truncate max-w-[200px]">{formUrl}</p>
          </div>

          <Button onClick={handleDownload} variant="outline" className="w-full">
            <Download className="w-4 h-4 mr-2" />
            {t('download')}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
