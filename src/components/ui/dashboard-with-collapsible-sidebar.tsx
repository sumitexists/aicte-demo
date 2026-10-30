"use client"

import React from 'react'
import { ChevronDown, ChevronsRight, Moon, Sun } from 'lucide-react'
import { cn } from './primitives'

export interface NavItem {
  key: string
  title: string
  Icon: React.ComponentType<{ className?: string }>
  badge?: number
}

interface SidebarProps {
  open: boolean
  items: NavItem[]
  selected: string
  onSelect: (key: string) => void
  roleSlot?: React.ReactNode
  isDark: boolean
  onToggleDark: () => void
  onToggleOpen: () => void
}

export const Sidebar = ({ open, items, selected, onSelect, roleSlot, isDark, onToggleDark, onToggleOpen }: SidebarProps) => {
  return (
    <nav
      className={cn(
        'relative sticky top-0 h-screen shrink-0 border-r transition-all duration-300 ease-in-out',
        'border-gray-200 bg-white p-2 shadow-sm dark:border-gray-800 dark:bg-gray-900',
        open ? 'w-64' : 'w-16',
      )}
    >
      <TitleSection open={open} />

      {roleSlot}

      <div className="mb-8 space-y-1">
        {items.map(({ key, title, Icon, badge }) => (
          <Option
            key={key}
            Icon={Icon}
            title={title}
            selected={selected}
            onSelect={onSelect}
            navKey={key}
            open={open}
            notifs={badge}
          />
        ))}
      </div>

      <button
        onClick={onToggleDark}
        className={cn(
          'mt-2 flex h-11 w-full items-center rounded-md text-gray-600 transition-colors hover:bg-gray-50 dark:text-gray-400 dark:hover:bg-gray-800',
        )}
      >
        <div className="grid h-full w-12 place-content-center">
          {isDark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
        </div>
        {open && <span className="text-sm font-medium">{isDark ? 'Light mode' : 'Dark mode'}</span>}
      </button>

      <button
        onClick={onToggleOpen}
        className="absolute bottom-0 left-0 right-0 border-t border-gray-200 transition-colors hover:bg-gray-50 dark:border-gray-800 dark:hover:bg-gray-800"
      >
        <div className="flex items-center p-3">
          <div className="grid size-10 place-content-center">
            <ChevronsRight
              className={cn(
                'h-4 w-4 text-gray-500 transition-transform duration-300 dark:text-gray-400',
                open ? 'rotate-180' : '',
              )}
            />
          </div>
          {open && <span className="text-sm font-medium text-gray-600 dark:text-gray-300">Collapse</span>}
        </div>
      </button>
    </nav>
  )
}

const Option = ({
  Icon,
  title,
  selected,
  onSelect,
  navKey,
  open,
  notifs,
}: {
  Icon: React.ComponentType<{ className?: string }>
  title: string
  selected: string
  onSelect: (k: string) => void
  navKey: string
  open: boolean
  notifs?: number
}) => {
  const isSelected = selected === navKey
  return (
    <button
      title={title}
      onClick={() => onSelect(navKey)}
      className={cn(
        'relative flex h-11 w-full items-center rounded-md transition-all duration-200',
        isSelected
          ? 'border-l-2 border-[#e99424] bg-[#edf4f9] text-[#123b63] shadow-sm dark:bg-blue-900/40 dark:text-blue-300'
          : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900 dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-gray-200',
      )}
    >
      <div className="grid h-full w-12 place-content-center">
        <Icon className="h-4 w-4" />
      </div>
      {open && <span className="text-sm font-medium">{title}</span>}
      {!!notifs && open && (
        <span className="absolute right-3 flex h-5 min-w-5 items-center justify-center rounded-full bg-[#123b63] px-1 text-[11px] font-medium text-white">
          {notifs}
        </span>
      )}
    </button>
  )
}

const TitleSection = ({ open }: { open: boolean }) => {
  return (
    <div className="mb-4 border-b border-gray-200 pb-4 dark:border-gray-800">
      <div className="flex cursor-pointer items-center justify-between rounded-md p-2 transition-colors hover:bg-gray-50 dark:hover:bg-gray-800">
        <div className="flex items-center gap-3">
          <Logo />
          {open && (
            <div>
              <span className="block text-sm font-semibold leading-tight text-[#123b63] dark:text-gray-100">
                AICTE Approval Monitor
              </span>
              <span className="block text-[11px] text-gray-500 dark:text-gray-400">AICTE · AY 2026-27</span>
            </div>
          )}
        </div>
        {open && <ChevronDown className="h-4 w-4 text-gray-400 dark:text-gray-500" />}
      </div>
    </div>
  )
}

const Logo = () => <img src="/aicte-logo.png" alt="AICTE logo" className="size-10 shrink-0 object-contain" />
