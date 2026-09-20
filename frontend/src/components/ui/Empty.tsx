import React from 'react';
import { cn } from '../../lib/utils';

export interface EmptyProps extends React.ComponentProps<'div'> {
  className?: string;
}

export function Empty({ className, ...props }: EmptyProps): React.ReactElement {
  return (
    <div
      className={cn(
        'flex min-w-0 flex-1 flex-col items-center justify-center gap-4 text-balance px-6 py-10 text-center rounded-2xl border border-dashed border-outline-variant/80 bg-surface-container-low/40',
        className
      )}
      data-slot="empty"
      {...props}
    />
  );
}

export function EmptyHeader({ className, ...props }: React.ComponentProps<'div'>): React.ReactElement {
  return (
    <div
      className={cn('flex max-w-sm flex-col items-center text-center space-y-1.5', className)}
      data-slot="empty-header"
      {...props}
    />
  );
}

export function EmptyMedia({
  className,
  variant = 'icon',
  ...props
}: React.ComponentProps<'div'> & { variant?: 'default' | 'icon' }): React.ReactElement {
  return (
    <div
      className={cn(
        'flex shrink-0 items-center justify-center',
        variant === 'icon' &&
          'relative flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-secondary-container/60 text-primary shadow-xs border border-primary/10',
        className
      )}
      data-slot="empty-media"
      {...props}
    />
  );
}

export function EmptyTitle({ className, ...props }: React.ComponentProps<'h3'>): React.ReactElement {
  return (
    <h3
      className={cn('font-headline text-base font-medium text-on-surface tracking-tight', className)}
      data-slot="empty-title"
      {...props}
    />
  );
}

export function EmptyDescription({ className, ...props }: React.ComponentProps<'p'>): React.ReactElement {
  return (
    <p
      className={cn('text-sm text-stone-700 max-w-sm leading-relaxed', className)}
      data-slot="empty-description"
      {...props}
    />
  );
}

export function EmptyContent({ className, ...props }: React.ComponentProps<'div'>): React.ReactElement {
  return (
    <div
      className={cn('flex flex-wrap items-center justify-center gap-3 pt-2', className)}
      data-slot="empty-content"
      {...props}
    />
  );
}
