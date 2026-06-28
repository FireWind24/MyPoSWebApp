import { type ButtonHTMLAttributes, type ReactNode, forwardRef } from 'react'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'ghost' | 'danger'
  size?: 'sm' | 'xs' | 'md'
  icon?: boolean
  children: ReactNode
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button({
  variant = 'primary',
  size = 'md',
  icon = false,
  children,
  className = '',
  ...props
}, ref) {
  const cls = [
    'btn',
    variant === 'primary' ? 'btn-g' : variant === 'danger' ? 'btn-r' : 'btn-ghost',
    size === 'sm' ? 'btn-sm' : size === 'xs' ? 'btn-xs' : '',
    icon ? 'btn-icon' : '',
    className,
  ]
    .filter(Boolean)
    .join(' ')

  return (
    <button ref={ref} className={cls} {...props}>
      {children}
    </button>
  )
})
