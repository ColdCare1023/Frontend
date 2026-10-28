import * as DropdownMenu from '@radix-ui/react-dropdown-menu'
import { Check } from 'lucide-react'

import { cn } from '@/lib/utils'

export const Menu = DropdownMenu.Root
export const MenuTrigger = DropdownMenu.Trigger
export const MenuRadioGroup = DropdownMenu.RadioGroup

/** Panel flotante compartido por los menús de la barra superior. */
export function MenuContent({
  className,
  align = 'end',
  children,
  ...props
}: React.ComponentPropsWithoutRef<typeof DropdownMenu.Content>) {
  return (
    <DropdownMenu.Portal>
      <DropdownMenu.Content
        align={align}
        sideOffset={8}
        collisionPadding={12}
        className={cn(
          'cristal z-50 min-w-48 origin-(--radix-dropdown-menu-content-transform-origin) rounded-(--radius-card) border p-1.5 text-sm text-foreground',
          'data-[state=open]:animate-(--animate-pop-in) data-[state=closed]:animate-(--animate-pop-out)',
          className,
        )}
        {...props}
      >
        {children}
      </DropdownMenu.Content>
    </DropdownMenu.Portal>
  )
}

const itemBase =
  'relative flex min-h-11 cursor-pointer select-none items-center gap-2.5 rounded-md px-2.5 py-1.5 text-sm outline-none transition-colors duration-(--duration-micro) data-[highlighted]:bg-cream-200/70 data-[disabled]:pointer-events-none data-[disabled]:opacity-50 sm:min-h-9 sm:pointer-coarse:min-h-11 [&_svg]:size-4 [&_svg]:shrink-0'

export function MenuItem({ className, ...props }: React.ComponentPropsWithoutRef<typeof DropdownMenu.Item>) {
  return <DropdownMenu.Item className={cn(itemBase, className)} {...props} />
}

export function MenuRadioItem({
  className,
  children,
  ...props
}: React.ComponentPropsWithoutRef<typeof DropdownMenu.RadioItem>) {
  return (
    <DropdownMenu.RadioItem className={cn(itemBase, 'pr-8', className)} {...props}>
      {children}
      <DropdownMenu.ItemIndicator className="absolute right-2.5 inline-flex text-primary">
        <Check aria-hidden />
      </DropdownMenu.ItemIndicator>
    </DropdownMenu.RadioItem>
  )
}

export function MenuLabel({ className, ...props }: React.ComponentPropsWithoutRef<typeof DropdownMenu.Label>) {
  return <DropdownMenu.Label className={cn('px-2.5 pt-1.5 pb-1 text-xs font-medium text-faint', className)} {...props} />
}

export function MenuSeparator({ className, ...props }: React.ComponentPropsWithoutRef<typeof DropdownMenu.Separator>) {
  return <DropdownMenu.Separator className={cn('-mx-1.5 my-1.5 h-px bg-border', className)} {...props} />
}
