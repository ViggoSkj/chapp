"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { AccountMenu } from "./account";
import { ExploreText, useLearningPage } from "./learning-support";
import { Icon } from "./icons";
import { sections, words } from "../lib/demo";

export function Workspace({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isDemoPage = ["/vocabulary", "/reviews", "/listening"].includes(pathname);
  const navigation = [{ id: "", title: "Overview", icon: "grid" }, ...sections, { id: "connections", title: "Connections", icon: "plug" }];
  return <div className="workspace">
    <aside className="sidebar">
      <Link href="/" className="brand" aria-label="Mando home"><span className="brand-mark" lang="zh">文</span><span>mando<span className="brand-dot">.</span><small>A LITTLE EVERY DAY</small></span></Link>
      <div className="workspace-label">MY LEARNING SPACE</div>
      <nav aria-label="Main navigation">{navigation.map(item => <Link key={item.id} href={`/${item.id}`} className={`nav-link ${pathname === `/${item.id}` ? "active" : ""}`} aria-current={pathname === `/${item.id}` ? "page" : undefined}><Icon name={item.icon} /><span>{item.title}</span></Link>)}</nav>
      <div className="sidebar-bottom"><div className="small-note"><Icon name="leaf" size={21} /><strong>Small steps. Real progress.</strong><p>Every word brings you a little closer.</p><span lang="zh">慢慢来，比较快。</span></div><div className="profile"><span className="avatar">V</span><div><strong>My Mandarin journey</strong><small>Personal workspace</small></div><span className="profile-dot" /></div></div>
    </aside>
    <div className="main-wrap"><header className="topbar"><div className="breadcrumb">My workspace <span>/</span> <strong>{navigation.find(n => `/${n.id}` === pathname)?.title ?? (pathname === "/login" ? "Sign in" : "Overview")}</strong></div><div className="topbar-right"><AccountMenu /><span className="header-divider" /><span className="language-label">简体中文 <Icon name="book" size={15} /></span></div></header><main id="main-content">{isDemoPage && <div className="page-demo-banner" role="note"><span className="demo-sticker">DEMO</span><span>Sample content and practice · not your live study data.</span></div>}{children}</main><footer><span>Made for your Mandarin journey.</span><span>一点一滴 · One step at a time</span></footer></div>
  </div>;
}

function PageHeading({ title, description, dashboard = false }: { title: string; description: string; dashboard?: boolean }) {
  return <div className="page-heading"><div><div className="eyebrow">{dashboard ? "YOUR MANDARIN JOURNEY" : "YOUR LEARNING SPACE"}</div><h1>{title}{dashboard && <span className="greeting" lang="zh">你好!</span>}</h1><p>{description}</p></div>{dashboard ? <Link href="/practice" className="button primary"><Icon name="spark" size={17} /> Let’s practice <Icon name="arrow" size={17} /></Link> : <Link href="/" className="button secondary">Back to overview <Icon name="arrow" size={16} /></Link>}</div>;
}

function Vocabulary() {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("All words");
  const filtered = words.filter(word => `${word.hanzi} ${word.pinyin} ${word.meaning}`.toLowerCase().includes(query.toLowerCase()) && (filter === "All words" || word.state === filter));
  useLearningPage({ key: "vocabulary", page: "/vocabulary", mode: "vocabulary", revealed: true, content: [
    { text: filtered.map(word => word.hanzi).join("，"), language: "zh-Hans" },
    { text: filtered.map(word => word.pinyin).join("; "), language: "zh-Latn-pinyin" },
    { text: filtered.map(word => word.meaning).join("; "), language: "en" },
  ] });
  return <section className="panel detail-panel"><div className="table-toolbar"><h2>Your word collection <span className="count-pill">6 examples</span></h2><div className="table-controls"><label className="search-input"><Icon name="search" size={17} /><input aria-label="Search vocabulary" value={query} onChange={e => setQuery(e.target.value)} placeholder="Search words, pinyin, meanings…" /></label><select aria-label="Filter by learning status" value={filter} onChange={e => setFilter(e.target.value)}>{["All words", "Learning", "Familiar", "Mastered"].map(s => <option key={s}>{s}</option>)}</select></div></div><div className="table-scroll"><table><thead><tr><th>Word</th><th>Pinyin</th><th>Meaning</th><th>Level</th><th>Status</th></tr></thead><tbody>{filtered.map(word => <tr key={word.hanzi}><td className="hanzi" lang="zh"><ExploreText text={word.hanzi} enabled /></td><td>{word.pinyin}</td><td>{word.meaning}</td><td><span className="level-tag">{word.level}</span></td><td><span className={`status-tag ${word.state.toLowerCase()}`}>{word.state}</span></td></tr>)}</tbody></table>{!filtered.length && <p className="empty-state">No words match. Try another search or status.</p>}</div></section>;
}

function Reviews() {
  return <section className="panel detail-panel"><div className="panel-heading"><div><h2>Your Anki decks</h2><p>Example review queues. Live scheduling will come from Anki.</p></div><Icon name="cards" /></div><div className="deck-list">{[{ title: "Everyday Mandarin", sub: "Useful words for everyday conversations", due: 14, total: 680 }, { title: "HSK vocabulary", sub: "A foundation for your next language milestone", due: 8, total: 450 }, { title: "Words from life", sub: "Expressions collected along the way", due: 2, total: 118 }].map(deck => <div className="deck-row" key={deck.title}><span className="tool-icon sage"><Icon name="cards" /></span><div className="deck-title"><h3>{deck.title}</h3><p>{deck.sub}</p><small>{deck.total} words</small></div><span className="due-count">{deck.due}<small>due today</small></span><Link href="/practice" className="button secondary">Try sample review <Icon name="arrow" size={16} /></Link></div>)}</div></section>;
}

export function DetailPage({ section }: { section: string }) {
  const item = sections.find(item => item.id === section);
  return <><PageHeading title={item?.title ?? "Your learning, connected."} description={item?.description ?? "A home for the tools that power your Mandarin journey."} />{section === "vocabulary" && <Vocabulary />}{section === "reviews" && <Reviews />}</>;
}
