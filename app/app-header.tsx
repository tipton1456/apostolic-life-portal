import HeaderBackLink from "./header-back-link";
import PortalLogo from "./portal-logo";
import SiteNavigation from "./site-navigation";

export default async function AppHeader() {
  return (
    <header className="bg-neutral-950 px-6 pt-5 text-white">
      <div className="mx-auto grid max-w-7xl grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-2 sm:gap-4">
        <div className="min-w-0 justify-self-start">
          <HeaderBackLink />
        </div>
        <div className="justify-self-center">
          <PortalLogo className="h-auto w-32 max-w-[34vw] sm:w-72 sm:max-w-[52vw]" />
        </div>
        <div className="min-w-0 justify-self-end">
          <SiteNavigation />
        </div>
      </div>
    </header>
  );
}
