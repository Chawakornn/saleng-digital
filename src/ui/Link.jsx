function SiteLink({ prefetch, href, ...a }) {
  href === "/" && (href = "/?intro=1");
  href.startsWith("/#") && (href = "/?intro=1" + href.slice(1));
  href.startsWith("/app") && (href = href.replace("/app", "/"));
  href.startsWith("/login") && (href = "/?roles=1");
  return <a href={href} {...a} />;
}
export { SiteLink };
