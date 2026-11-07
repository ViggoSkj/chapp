"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { AccountMenu } from "./account";
import { UsageObserver } from "./usage-observer";
import { Icon } from "./icons";
import { sections } from "../lib/demo";

const navigationGroups = [
  { label: "Practice", items: [
    { id: "practice", title: "Daily Q&A", icon: "spark" },
    { id: "sentences", title: "Mandarin → English translation", icon: "book" },
    { id: "listening", title: "Listening", icon: "sound" },
  ] },
  { label: "Explore", items: [
    { id: "vocabulary", title: "Vocabulary", icon: "book" },
    { id: "progress", title: "Progress", icon: "chart" },
  ] },
  { label: "Manage", items: [
    { id: "connections", title: "Connections", icon: "plug" },
    { id: "usage", title: "Usage", icon: "chart" },
    { id: "reviews", title: "Anki reviews", icon: "cards", demo: true },
  ] },
];

const overviewLink = { id: "", title: "Overview", icon: "grid" };
const navigation = [overviewLink, ...navigationGroups.flatMap(group => group.items)];

function NavigationLink({ item, pathname }: {
  item: { id: string; title: string; icon: string; demo?: boolean };
  pathname: string;
}) {
  const href = `/${item.id}`;
  const active = pathname === href;

  return <Link href={href} className={`nav-link ${active ? "active" : ""}`} aria-current={active ? "page" : undefined}>
    <Icon name={item.icon} />
    <span>{item.title}</span>
    {item.demo && <small className="nav-demo">Demo</small>}
  </Link>;
}

export function Workspace({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isDemoPage = ["/reviews"].includes(pathname);
  return <div className="workspace"><UsageObserver />
    <aside className="sidebar">
      <Link href="/" className="brand" aria-label="Mando home"><span className="brand-mark" lang="zh">文</span><span>mando<span className="brand-dot">.</span><small>A LITTLE EVERY DAY</small></span></Link>
      <div className="workspace-label">MY LEARNING SPACE</div>
      <nav aria-label="Main navigation">
        <NavigationLink item={overviewLink} pathname={pathname} />
        {navigationGroups.map(group => <div className="nav-group" role="group" aria-label={group.label} key={group.label}>
          <div className="nav-group-label" aria-hidden="true">{group.label}</div>
          {group.items.map(item => <NavigationLink key={item.id} item={item} pathname={pathname} />)}
        </div>)}
      </nav>
      <div className="sidebar-bottom"><div className="small-note"><Icon name="leaf" size={21} /><strong>Small steps. Real progress.</strong><p>Every word brings you a little closer.</p><span lang="zh">慢慢来，比较快。</span></div><div className="profile"><span className="avatar">V</span><div><strong>My Mandarin journey</strong><small>Personal workspace</small></div><span className="profile-dot" /></div></div>
    </aside>
    <div className="main-wrap"><header className="topbar"><div className="breadcrumb">My workspace <span>/</span> <strong>{navigation.find(n => `/${n.id}` === pathname)?.title ?? (pathname === "/login" ? "Sign in" : "Overview")}</strong></div><div className="topbar-right"><AccountMenu /><span className="header-divider" /><span className="language-label">简体中文 <Icon name="book" size={15} /></span></div></header><main id="main-content">{isDemoPage && <div className="page-demo-banner" role="note"><span className="demo-sticker">DEMO</span><span>Sample content and practice · not your live study data.</span></div>}{children}</main><footer><span>Made for your Mandarin journey.</span><span>一点一滴 · One step at a time</span></footer></div>
  </div>;
}

function PageHeading({ title, description, dashboard = false }: { title: string; description: string; dashboard?: boolean }) {
  return <div className="page-heading"><div><div className="eyebrow">{dashboard ? "YOUR MANDARIN JOURNEY" : "YOUR LEARNING SPACE"}</div><h1>{title}{dashboard && <span className="greeting" lang="zh">你好!</span>}</h1><p>{description}</p></div>{dashboard ? <Link href="/practice" className="button primary"><Icon name="spark" size={17} /> Let’s practice <Icon name="arrow" size={17} /></Link> : <Link href="/" className="button secondary">Back to overview <Icon name="arrow" size={16} /></Link>}</div>;
}

function Reviews() {
  return <section className="panel detail-panel"><div className="panel-heading"><div><h2>Your Anki decks</h2><p>Example review queues. Live scheduling will come from Anki.</p></div><Icon name="cards" /></div><div className="deck-list">{[{ title: "Everyday Mandarin", sub: "Useful words for everyday conversations", due: 14, total: 680 }, { title: "HSK vocabulary", sub: "A foundation for your next language milestone", due: 8, total: 450 }, { title: "Words from life", sub: "Expressions collected along the way", due: 2, total: 118 }].map(deck => <div className="deck-row" key={deck.title}><span className="tool-icon sage"><Icon name="cards" /></span><div className="deck-title"><h3>{deck.title}</h3><p>{deck.sub}</p><small>{deck.total} words</small></div><span className="due-count">{deck.due}<small>due today</small></span><Link href="/practice" className="button secondary">Try sample review <Icon name="arrow" size={16} /></Link></div>)}</div></section>;
}

export function DetailPage({ section }: { section: string }) {
  const item = sections.find(item => item.id === section);
  return <><PageHeading title={item?.title ?? "Your learning, connected."} description={item?.description ?? "A home for the tools that power your Mandarin journey."} />{section === "reviews" && <Reviews />}</>;
}
