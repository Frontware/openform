'use client'

import { useState } from 'react'
import { Trash2, Loader2 } from 'lucide-react'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import { DropdownMenuItem } from '@/components/ui/dropdown-menu'
import { useTranslations } from 'next-intl'
import { toast } from 'sonner'
import { formClient } from '@/lib/grpc-client'

interface DeleteFormButtonProps {
  formId: string
  formTitle: string
  onDelete?: (formId: string) => void
}

export function DeleteFormButton({ formId, formTitle, onDelete }: DeleteFormButtonProps) {
  const t = useTranslations('dashboard.deleteDialog')
  const [isDeleting, setIsDeleting] = useState(false)
  const [open, setOpen] = useState(false)

  const handleDelete = async () => {
    setIsDeleting(true)
    try {
      await formClient.deleteForm({ id: formId })
      toast.success(t('success'))
      setOpen(false)
      // Call the onDelete callback to update parent state
      if (onDelete) {
        onDelete(formId)
      }
    } catch (error) {
      console.error('Delete error:', error)
      toast.error(t('error'))
    } finally {
      setIsDeleting(false)
    }
  }

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogTrigger asChild>
        <DropdownMenuItem 
          onSelect={(e) => e.preventDefault()}
          className="text-red-600 focus:text-red-600 focus:bg-red-50 cursor-pointer"
        >
          <Trash2 className="mr-2 h-4 w-4" />
          {t('trigger')}
        </DropdownMenuItem>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{t('title')}</AlertDialogTitle>
          <AlertDialogDescription>
            {t('description', { title: formTitle })}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isDeleting}>{t('cancel')}</AlertDialogCancel>
          <AlertDialogAction
            onClick={(e) => {
              e.preventDefault()
              handleDelete()
            }}
            className="bg-red-600 hover:bg-red-700 focus:ring-red-600"
            disabled={isDeleting}
          >
            {isDeleting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                {t('deleting')}
              </>
            ) : (
              t('confirm')
            )}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}

