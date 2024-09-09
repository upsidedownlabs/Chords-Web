"use client";

import React, { useEffect, useState } from "react";
import { MoonIcon, SunIcon } from "@radix-ui/react-icons";
import { useTheme } from "next-themes";
import { Button } from "@/components/ui/button";

export function ModeToggle({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const toggleTheme = () => {
    console.log("Current theme:", theme); // Debug log
    setTheme(theme === "dark" ? "light" : "dark");
  };

  if (!mounted) {
    return null;
  }

  return (
    <div className={className} {...props}>
      <Button variant="ghost" size="sm" onClick={toggleTheme}>
        {theme === "dark" ? (
          <SunIcon width={16} height={16} />
        ) : (
          <MoonIcon width={16} height={16} />
        )}
      </Button>
    </div>
  );
}
