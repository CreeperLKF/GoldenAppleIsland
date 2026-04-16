import PopupWindow from "./components/PopupWindow";
import { ForceOverridesProvider } from "./hooks/useForceOverrides";
import { useTheme } from "./hooks/useTheme";

export default function App() {
  useTheme();
  return (
    <ForceOverridesProvider>
      <PopupWindow />
    </ForceOverridesProvider>
  );
}
