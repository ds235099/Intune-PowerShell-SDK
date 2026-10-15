import { NavLink, Outlet } from "react-router-dom";

export function Shell() {
  return (
    <div className="app">
      <header className="topbar">
        <NavLink to="/" className="wordmark">Easy Agent Ad Pro</NavLink>
        <nav>
          <NavLink to="/campaigns">Campaigns</NavLink>
          <NavLink to="/library">Brand library</NavLink>
          <NavLink to="/campaigns/new" className="button solid">New campaign</NavLink>
        </nav>
      </header>
      <Outlet />
    </div>
  );
}
