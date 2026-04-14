import PopupWindow from "./components/PopupWindow";
import { ForceOverridesProvider } from "./hooks/useForceOverrides";

export default function App() {
  return (
    <ForceOverridesProvider>
      <PopupWindow />
    </ForceOverridesProvider>
  );
}
