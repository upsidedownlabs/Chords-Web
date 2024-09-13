import { useTheme } from "next-themes";
import { MoonIcon, SunIcon } from "@radix-ui/react-icons";
import { Button } from "@/components/ui/button";

export function ModeToggle({
  className,
  disabled, // Accept disabled prop
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

  return (
    <div className={className} {...props}>
      <Button
        variant="ghost"
        size="sm"
        onClick={toggleTheme}
        disabled={disabled} // Disable the button based on the prop
        className={`${disabled ? "opacity-50 cursor-not-allowed" : ""}`} // Fade the color if disabled
      >
        {theme === "dark" ? (
          <SunIcon width={16} height={16} />
        ) : (
          <MoonIcon width={16} height={16} />
        )}
      </Button>
    </div>
  );
}
