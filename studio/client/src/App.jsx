import { Route, Routes } from "react-router-dom";
import { Shell } from "./components/Shell.jsx";
import { Campaigns } from "./pages/Campaigns.jsx";
import { Flow } from "./pages/Flow.jsx";
import { Home } from "./pages/Home.jsx";
import { Library } from "./pages/Library.jsx";
import { Studio } from "./pages/Studio.jsx";

export function App() {
  return (
    <Routes>
      <Route element={<Shell />}>
        <Route index element={<Home />} />
        <Route path="campaigns" element={<Campaigns />} />
        <Route path="campaigns/new" element={<Flow />} />
        <Route path="campaigns/:id" element={<Studio />} />
        <Route path="library" element={<Library />} />
      </Route>
    </Routes>
  );
}
