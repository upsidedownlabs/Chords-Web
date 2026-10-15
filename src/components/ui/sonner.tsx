"use client"

import { useTheme } from "next-themes"
import { Toaster as Sonner } from "sonner"
import "@/lib/toast" // applies the no-repeat / persistent toast behaviour

type ToasterProps = React.ComponentProps<typeof Sonner>

const Toaster = ({ ...props }: ToasterProps) => {
  const { theme = "system" } = useTheme()

  return (
    <Sonner
      theme={theme as ToasterProps["theme"]}
      className="toaster group"
      toastOptions={{
        classNames: {
          toast:
            "group toast group-[.toaster]:bg-background group-[.toaster]:text-foreground group-[.toaster]:border-border group-[.toaster]:shadow-lg",
          description: "group-[.toast]:text-muted-foreground",
          actionButton:
            "group-[.toast]:bg-primary group-[.toast]:text-primary-foreground",
          cancelButton:
            "group-[.toast]:bg-muted group-[.toast]:text-muted-foreground",
          // Sonner puts the X top-left in LTR; move it to the top-right corner.
          closeButton: "!left-auto !right-0 ![transform:translate(35%,-35%)]",
        },
      }}
      {...props}
    />
  )
}

export { Toaster }
