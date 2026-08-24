"use client"

import * as React from "react"
import * as TabsPrimitive from "@radix-ui/react-tabs"

import { cn } from "@/lib/utils"

function Tabs({
  className,
  ...props
}: React.ComponentProps<typeof TabsPrimitive.Root>) {
  return (
    <TabsPrimitive.Root
      data-slot="tabs"
      className={cn("flex flex-col gap-2", className)}
      {...props}
    />
  )
}

function TabsList({
  className,
  ...props
}: React.ComponentProps<typeof TabsPrimitive.List>) {
  return (
    <TabsPrimitive.List
      data-slot="tabs-list"
      className={cn(
        "bg-muted text-muted-foreground inline-flex h-9 w-fit items-center justify-center rounded-lg p-[3px]",
        // When the consumer applies a `grid` layout (e.g. settings page
        // tabs on mobile), override the default `inline-flex w-fit h-9` so
        // the grid columns take effect and the height is auto. Without this,
        // on iOS Safari the `inline-flex` wins and the tab triggers
        // overflow/get hidden.
        className?.includes('grid') && 'flex w-full h-auto',
        className
      )}
      {...props}
    />
  )
}

function TabsTrigger({
  className,
  ...props
}: React.ComponentProps<typeof TabsPrimitive.Trigger>) {
  // Detect if the trigger is inside a grid TabsList (settings page) by
  // checking for `justify-center` which the settings page adds. When in
  // grid mode, we MUST override the default `h-[calc(100%-1px)]` because
  // percentage heights require a defined parent height — with `h-auto` on
  // the TabsList, iOS Safari computes `calc(100% - 1px)` as 0, making the
  // triggers invisible (the root cause of "tabs hidden on iOS").
  const isGridMode = className?.includes('justify-center')
  return (
    <TabsPrimitive.Trigger
      data-slot="tabs-trigger"
      className={cn(
        "data-[state=active]:bg-background dark:data-[state=active]:text-foreground focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:outline-ring dark:data-[state=active]:border-input dark:data-[state=active]:bg-input/30 text-foreground dark:text-muted-foreground inline-flex h-[calc(100%-1px)] flex-1 items-center justify-center gap-1.5 rounded-md border border-transparent px-2 py-1 text-sm font-medium whitespace-nowrap transition-[color,box-shadow] focus-visible:ring-[3px] focus-visible:outline-1 disabled:pointer-events-none disabled:opacity-50 data-[state=active]:shadow-sm [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
        // In grid mode: override height to auto (the calc(100%-1px) breaks
        // on iOS when the parent has h-auto) and allow text wrapping.
        isGridMode && 'h-auto whitespace-normal text-center',
        className
      )}
      {...props}
    />
  )
}

function TabsContent({
  className,
  ...props
}: React.ComponentProps<typeof TabsPrimitive.Content>) {
  return (
    <TabsPrimitive.Content
      data-slot="tabs-content"
      className={cn("flex-1 outline-none", className)}
      {...props}
    />
  )
}

export { Tabs, TabsList, TabsTrigger, TabsContent }
