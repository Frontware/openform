'use client'

import Link from 'next/link'
import Image from 'next/image'
import { cn } from '@/lib/utils'

interface LogoProps {
  href?: string
  size?: 'sm' | 'md' | 'lg'
  className?: string
}

export function Logo({ href = '/', size = 'md', className }: LogoProps) {
  const sizes = {
    sm: { width: 120, height: 32 },
    md: { width: 150, height: 40 },
    lg: { width: 180, height: 48 },
  }

  const { width, height } = sizes[size]

  const content = (
    <div className={cn("relative", className)}>
      <Image
        src="/weladee-logo.png"
        alt="Weladee Form"
        width={width}
        height={height}
        className="object-contain"
        priority
      />
    </div>
  )

  if (href) {
    return (
      <Link href={href} className="focus:outline-none focus-visible:ring-2 focus-visible:ring-primary rounded">
        {content}
      </Link>
    )
  }

  return content
}
