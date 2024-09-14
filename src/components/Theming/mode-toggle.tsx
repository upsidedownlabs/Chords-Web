import { useTheme } from "next-themes";
import { MoonIcon, SunIcon } from "@radix-ui/react-icons";
import { Button } from "@/components/ui/button";

export function ModeToggle({
  className,
  disabled,
  ...props
}: React.HTMLAttributes<HTMLDivElement> & { disabled?: boolean }) {
  const { theme, setTheme, systemTheme } = useTheme();

  // Determine the current theme (dark/light)
  const currentTheme = theme === "system" ? systemTheme : theme;

  // Toggle between light and dark themes
  const toggleTheme = () => {
    if (!disabled) {
      setTheme(currentTheme === "dark" ? "light" : "dark");
    }
  };

  if (disabled) {
    return null; // Do not render the button if it's disabled
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
