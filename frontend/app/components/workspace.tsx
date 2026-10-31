"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { AccountMenu } from "./account";
import { ExploreText, useLearningPage } from "./learning-support";
import { Icon } from "./icons";
import { monthlyReviews, sections, weeklyReviews, words } from "../lib/demo";

export function Workspace({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isDemoPage = ["/", "/vocabulary", "/reviews", "/progress", "/listening"].includes(pathname);
  const navigation = [{ id: "", title: "Overview", icon: "grid" }, ...sections, { id: "connections", title: "Connections", icon: "plug" }];
  return <div className="workspace">
    <aside className="sidebar">
      <Link href="/" className="brand" aria-label="Mando home"><span className="brand-mark" lang="zh">文</span><span>mando<span className="brand-dot">.</span><small>A LITTLE EVERY DAY</small></span></Link>
      <div className="workspace-label">MY LEARNING SPACE</div>
      <nav aria-label="Main navigation">{navigation.map(item => <Link key={item.id} href={`/${item.id}`} className={`nav-link ${pathname === `/${item.id}` ? "active" : ""}`} aria-current={pathname === `/${item.id}` ? "page" : undefined}><Icon name={item.icon} /><span>{item.title}</span>{item.id === "reviews" && <span className="nav-count">24</span>}</Link>)}</nav>
      <div className="sidebar-bottom"><div className="small-note"><Icon name="leaf" size={21} /><strong>Small steps. Real progress.</strong><p>Every word brings you a little closer.</p><span lang="zh">慢慢来，比较快。</span></div><div className="profile"><span className="avatar">V</span><div><strong>My Mandarin journey</strong><small>Personal workspace</small></div><span className="profile-dot" /></div></div>
    </aside>
    <div className="main-wrap"><header className="topbar"><div className="breadcrumb">My workspace <span>/</span> <strong>{navigation.find(n => `/${n.id}` === pathname)?.title ?? (pathname === "/login" ? "Sign in" : "Overview")}</strong></div><div className="topbar-right"><AccountMenu /><span className="header-divider" /><span className="language-label">简体中文 <Icon name="book" size={15} /></span></div></header><main id="main-content">{isDemoPage && <div className="page-demo-banner" role="note"><span className="demo-sticker">DEMO</span><span>Sample content and practice · not your live study data.</span></div>}{children}</main><footer><span>Made for your Mandarin journey.</span><span>一点一滴 · One step at a time</span></footer></div>
  </div>;
}

function PageHeading({ title, description, dashboard = false }: { title: string; description: string; dashboard?: boolean }) {
  return <div className="page-heading"><div><div className="eyebrow">{dashboard ? "YOUR MANDARIN JOURNEY" : "YOUR LEARNING SPACE"}</div><h1>{title}{dashboard && <span className="greeting" lang="zh">你好!</span>}</h1><p>{description}</p></div>{dashboard ? <Link href="/practice" className="button primary"><Icon name="spark" size={17} /> Let’s practice <Icon name="arrow" size={17} /></Link> : <Link href="/" className="button secondary">Back to overview <Icon name="arrow" size={16} /></Link>}</div>;
}

function Landscape() {
  return <svg className="landscape" viewBox="0 0 470 245" fill="none" aria-hidden="true"><circle cx="355" cy="64" r="34" fill="#ffe353" opacity=".7" /><path d="M35 229C80 182 110 137 147 89c25-35 37-30 60 8l48 70 41-48c22-26 37-28 61 6l95 111H35Z" fill="#78304f" /><path d="m105 229 65-109c15-27 29-26 47 3l52 79 41-56c14-20 30-11 42 7l64 82-311-6Z" fill="#ac3068" /><path d="M211 245c38-43 39-63 69-85 24-19 27-21 34-29-23 37-11 49-32 77-10 13-14 25-19 37" fill="#f3cf5b" /><path d="M0 234c64-21 96-14 147-1 60 17 99 4 154-9 61-14 105-3 169 15v16H0Z" fill="#d41468" /><path d="M395 111v125m0-100-23-15m23 37 29-22m-29 47-29-17m29 34 25-13" stroke="#ff79b4" strokeWidth="3" /><path d="m361 121 22-5-6 15-16-10Zm51 16 18-12 4 18-22-6Zm-55 24 23 2-6 14-17-16Zm57 26 20-10 0 16-20-6Z" fill="#ff79b4" /><path d="m302 62 6-3 6 3m12-12 5-3 5 3" stroke="#ff79b4" strokeWidth="1.5" strokeLinecap="round" /></svg>;
}

function Stats() {
  const stats = [{ label: "Words learned", value: "1,248", icon: "book", note: "+32 this week", color: "sage" }, { label: "Cards to review", value: "24", icon: "cards", note: "A little refresh awaits", color: "peach" }, { label: "Current streak", value: "12", suffix: "days", icon: "flame", note: "Your best is 18 days", color: "butter" }, { label: "Study time", value: "3.5", suffix: "hrs", icon: "clock", note: "This week · +18%", color: "lavender" }];
  return <div className="stats-grid">{stats.map((stat) => <div className="stat-card" key={stat.label}><div className="stat-top"><span>{stat.label}</span><span className={`stat-icon ${stat.color}`}><Icon name={stat.icon} size={18} /></span></div><div className="stat-value">{stat.value}<span>{stat.suffix}</span></div><div className={stat.label === "Words learned" ? "stat-note positive" : "stat-note"}>{stat.label === "Words learned" && <span>↗ </span>}{stat.note}</div></div>)}</div>;
}

function ActivityChart() {
  const [range, setRange] = useState("week");
  const data = range === "week" ? weeklyReviews : monthlyReviews;
  const labels = range === "week" ? ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"] : ["1–4", "5–8", "9–12", "13–16", "17–20", "21–24", "25–28"];
  return <section className="panel activity-panel"><div className="panel-heading"><div><h2>Learning activity</h2><p>A little consistency adds up.</p></div><label className="select-wrap"><span className="sr-only">Activity period</span><select value={range} onChange={e => setRange(e.target.value)}><option value="week">This week</option><option value="month">Last 28 days</option></select><Icon name="down" size={13} /></label></div><div className="chart" role="img" aria-label={`Example reviews: ${data.map((v, i) => `${labels[i]} ${v}`).join(", ")}`}><div className="chart-y"><span>100</span><span>75</span><span>50</span><span>25</span><span>0</span></div><div className="chart-plot"><div className="grid-lines">{[0, 1, 2, 3, 4].map(n => <div key={n} />)}</div><div className="bars">{data.map((height, i) => <div className="bar-column" key={i}><div className="bar-track"><div className={`bar ${i === 5 ? "highlight" : ""}`} style={{ height: `${height}%` }}><span className="bar-tooltip">{height} reviews</span></div></div><span className="bar-label">{labels[i]}</span></div>)}</div></div></div><div className="chart-footer"><span><i />Cards reviewed</span><span><strong>{data.reduce((a, b) => a + b, 0)}</strong> reviews {range === "week" ? "this week" : "in 28 days"}</span></div></section>;
}

function GoalCard() {
  return <section className="panel goal-panel"><div className="panel-heading"><div><h2>Your next milestone</h2><p>Building a stronger foundation.</p></div><span className="goal-icon"><Icon name="mountain" /></span></div><div className="goal-main"><div className="progress-ring"><span>83<small>%</small></span></div><div><span className="eyebrow">VOCABULARY GOAL</span><h3>1,500 words</h3><p><strong>1,248</strong> / 1,500 learned</p></div></div><div className="goal-note"><Icon name="leaf" size={17} /><span>252 more words. You’re getting there!</span></div><Link href="/progress" className="text-link">View your progress <Icon name="arrow" size={16} /></Link></section>;
}

export function Dashboard() {
  return <><PageHeading title="A little better, every day." description="Your Mandarin learning, all in one place. Let’s keep growing." dashboard /><section className="welcome-banner"><div className="welcome-copy"><span className="banner-eyebrow"><span /> KEEP YOUR MOMENTUM</span><h2>Big journeys start<br />with small steps.</h2><p>You have 24 cards waiting for a little attention.<br />A few minutes today makes a difference.</p><Link href="/reviews" className="button forest">Review your cards <Icon name="arrow" size={17} /></Link></div><Landscape /><div className="banner-chinese" lang="zh">学无止境<span>There is no end to learning.</span></div></section><div className="section-kicker"><span>YOUR JOURNEY AT A GLANCE</span><span className="sample-label">Example data <Icon name="info" size={13} /></span></div><Stats /><div className="insights-grid"><ActivityChart /><GoalCard /></div><div className="explore-heading"><div><h2>Your learning toolkit</h2><p>A place for every part of your practice.</p></div><span>Find your next small step <Icon name="arrow" size={15} /></span></div><div className="toolkit-grid">{sections.map(item => <Link href={`/${item.id}`} key={item.id} className="tool-card"><div className={`tool-icon ${item.color}`}><Icon name={item.icon} size={23} /></div><h3>{item.title}</h3><p>{item.description}</p><span className="tool-action">{item.action}<Icon name="arrow" size={16} /></span></Link>)}</div><Link href="/connections" className="connection-strip"><span className="connection-symbol"><Icon name="plug" size={21} /></span><div><strong>Your learning, connected.</strong><p>Bring your Anki decks and study history into one place.</p></div><span className="connection-cta">Explore connections <Icon name="arrow" size={17} /></span></Link></>;
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
  return <><PageHeading title={item?.title ?? "Your learning, connected."} description={item?.description ?? "A home for the tools that power your Mandarin journey."} />{section === "vocabulary" && <Vocabulary />}{section === "reviews" && <Reviews />}{section === "progress" && <><Stats /><div className="insights-grid detail-insights"><ActivityChart /><GoalCard /></div><section className="panel detail-panel"><h2>Every word is a step forward.</h2><p>Your progress page will bring together study time, review consistency, retention, and vocabulary milestones from your connected collection. The figures above illustrate how your learning story will look.</p><Link href="/vocabulary" className="text-link">Explore your vocabulary <Icon name="arrow" size={16} /></Link></section></>}</>;
}
