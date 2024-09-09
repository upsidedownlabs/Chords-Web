import { useTheme } from "next-themes";
import { MoonIcon, SunIcon } from "@radix-ui/react-icons";
import { Button } from "@/components/ui/button"; // Importing the Button from shadcn

export const ModeToggle = () => {
  const { theme, setTheme, systemTheme } = useTheme();

  // Determine the current theme (dark/light)
  const currentTheme = theme === "system" ? systemTheme : theme;

  // Toggle between light and dark themes
  const toggleTheme = () => {
    setTheme(currentTheme === "dark" ? "light" : "dark");
  };

  return (
    <Button variant="ghost" size="sm" onClick={toggleTheme}>
      {currentTheme === "dark" ? (
        <SunIcon width={16} height={16} />
      ) : (
        <MoonIcon width={16} height={16} />
      )}
    </Button>
  );
};
