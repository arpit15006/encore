import type { MouseEvent, ReactNode } from "react";
import { BrandMark, GrooveDivider } from "../art/scenes";
import { navigate, usePath } from "../router";

function NavLink({ to, children }: { to: string; children: ReactNode }) {
  const path = usePath();
  const onClick = (event: MouseEvent<HTMLAnchorElement>) => {
    event.preventDefault();
    navigate(to);
  };
  return (
    <a href={to} onClick={onClick} aria-current={path === to ? "page" : undefined}>
      {children}
    </a>
  );
}

export function Layout({ children }: { children: ReactNode }) {
  return (
    <>
      <a className="skip-link" href="#main">
        Skip to content
      </a>
      <header className="site-header">
        <div className="container">
          <a
            className="brand"
            href="/"
            onClick={(event) => {
              event.preventDefault();
              navigate("/");
            }}
          >
            <BrandMark />
            Encore
          </a>
          <nav className="site-nav" aria-label="Main">
            <NavLink to="/start">Start</NavLink>
            <NavLink to="/demo">
              Demo<span className="nav-extra">&nbsp;care home</span>
            </NavLink>
          </nav>
        </div>
      </header>
      <main id="main" tabIndex={-1}>
        <div className="container">{children}</div>
      </main>
      <footer className="site-footer">
        <div className="container">
          <GrooveDivider />
          <p>
            Encore supports engagement and person-centered activities. It is not a medical tool and doesn't replace music therapists or
            care professionals. Taste data from Qloo describes groups of people, never one person.
          </p>
        </div>
      </footer>
    </>
  );
}
