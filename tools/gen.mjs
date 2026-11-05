// Static page generator: `node tools/gen.mjs` writes every *.html page, sitemap.xml and robots.txt.
// Pages are plain HTML (no build step is needed on the server); dynamic content is rendered by assets/js/app.js.
import { writeFileSync, readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
// Each CSS/JS address carries a short fingerprint of the file, so browsers and the CDN always fetch the latest version after a change.
const ver = f => createHash('sha1').update(readFileSync(join(root, f))).digest('hex').slice(0, 8);
const SITE = process.env.SITE_URL || 'https://intellytiqsolutions.com';
const ARROW = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6"/></svg>';
const FAV = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 48 48'%3E%3Cdefs%3E%3ClinearGradient id='g' x1='0' y1='0' x2='1' y2='1'%3E%3Cstop offset='0' stop-color='%2322d3ee'/%3E%3Cstop offset='1' stop-color='%23d946ef'/%3E%3C/linearGradient%3E%3C/defs%3E%3Cpath d='M24 3 42 13.500v21L24 45 6 34.500v-21L24 3Z' fill='%2305060a' stroke='url(%23g)' stroke-width='3.500'/%3E%3Ccircle cx='24' cy='24' r='5' fill='url(%23g)'/%3E%3C/svg%3E";

const shell = ({ file, page, title, desc, body, extra = '' }) => `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${title}</title>
<meta name="description" content="${desc}">
<meta name="theme-color" content="#05060a">
<meta property="og:title" content="${title}"><meta property="og:description" content="${desc}"><meta property="og:type" content="website"><meta property="og:image" content="${SITE}/assets/img/og-image.jpg"><meta property="og:image:width" content="1200"><meta property="og:image:height" content="630"><meta name="twitter:card" content="summary_large_image"><meta name="twitter:image" content="${SITE}/assets/img/og-image.jpg"><meta property="og:site_name" content="Intellytiq Solutions">
<link rel="canonical" href="${SITE}/${file === 'index.html' ? '' : file}">
<link rel="icon" type="image/svg+xml" href="assets/img/logo-mark.svg">
<link rel="icon" type="image/png" sizes="32x32" href="assets/img/favicon-32.png"><link rel="apple-touch-icon" href="assets/img/apple-touch-icon.png">
<script src="assets/js/theme.js?v=${ver('assets/js/theme.js')}"></script>
<link rel="stylesheet" href="assets/css/style.css?v=${ver('assets/css/style.css')}">
<link rel="stylesheet" href="assets/css/extra.css?v=${ver('assets/css/extra.css')}">
${extra}
<script type="application/ld+json">{"@context":"https://schema.org","@type":"Organization","name":"Intellytiq Solutions","url":"${SITE}","logo":"${SITE}/assets/img/logo-mark.svg","description":"Data engineering, Microsoft Fabric, Databricks, Snowflake, SQL Server and Azure cloud consulting delivered remotely worldwide."}</script>
</head>
<body data-page="${page}">
<div class="loader" aria-hidden="true"><img src="assets/img/logo-mark.svg" alt="" width="84" height="84"></div>
<div id="nav"></div>
<main>
${body}
</main>
<div id="foot"></div>
<script src="assets/js/captcha.js?v=${ver('assets/js/captcha.js')}" defer></script>
<script src="assets/js/app.js?v=${ver('assets/js/app.js')}" defer></script>
</body>
</html>
`;

const phero = (h1, lead, crumb) => `<section class="phero"><canvas class="net"></canvas><div class="wrap">
  <div class="crumbs rv"><a href="index.html">Home</a> / ${crumb}</div>
  <h1 class="rv" style="--d:.08s">${h1}</h1><p class="lead rv" style="--d:.16s">${lead}</p></div></section>`;

const cta = (h = 'Let’s build your data advantage.', p = 'Hire us per day or for a fixed project, at rates below typical market prices, with guaranteed delivery and 24×7×365 support. We reply fast, on any day of the year.', vid = '') => `<section class="sec"><div class="wrap"><div class="cta-band rv">${vid ? `<span class="bgvid-slot" data-render="bg-video" data-key="${vid}"></span>` : ''}<h2>${h}</h2><p class="lead">${p}</p><div class="cta"><a class="btn primary" href="contact.html">Start a conversation ${ARROW}</a><a class="btn ghost" href="services.html">Explore services</a></div></div></div></section>`;

const head = (eyebrow, h2, lead = '', center = true) => `<div class="head ${center ? 'center' : ''}"><div class="eyebrow rv">${eyebrow}</div><h2 class="rv" style="--d:.07s">${h2}</h2>${lead ? `<p class="lead rv" style="--d:.14s">${lead}</p>` : ''}</div>`;

const pages = [];
const add = (p) => pages.push(p);

/* ---------------- HOME ---------------- */
add({ file: 'index.html', page: 'home', title: 'Intellytiq Solutions | Microsoft Fabric, Databricks, Snowflake & Azure Data Engineering', desc: 'Intellytiq Solutions delivers Microsoft Fabric, Databricks, Snowflake, MS SQL, data engineering, warehousing and Azure cloud expertise to companies worldwide, 100% remote, with 24×7×365 coverage.',
body: `
<section class="hero has-video"><div class="hero-media" aria-hidden="true"><video class="hero-video" autoplay muted loop playsinline preload="auto" poster="assets/video/hero.jpg"><source src="assets/video/hero.mp4" type="video/mp4"></video></div><div class="halo"><i></i><i></i><i></i></div><canvas class="net"></canvas>
  <div class="wrap"><div class="tag rv"><b></b> Available 24×7, 365 days a year · remote worldwide</div>
    <h1 class="rv" style="--d:.08s">Data platforms,<br>engineered for<span class="wordline"><span class="grad"><span class="rot" id="rot">Microsoft Fabric</span></span><span class="caret"></span></span></h1>
    <p class="lead rv" style="--d:.16s">Intellytiq Solutions gives companies the technical capability and senior skillsets to design, build and run modern data estates on Microsoft Fabric, Databricks, Snowflake, SQL Server and Azure.</p>
    <div class="cta rv" style="--d:.24s"><a class="btn primary" href="contact.html">Book a free consultation ${ARROW}</a><a class="btn ghost" href="services.html">Explore services</a></div>
    <ul class="assure rv" style="--d:.32s"><li>Per-day or project basis</li><li>Rates below typical market prices</li><li>Guaranteed delivery</li><li>24×7 support, 365 days a year</li></ul></div>
  <div class="hero-art" aria-hidden="true"><img src="assets/img/lakehouse.svg" alt="" width="600" height="560"><div class="chip-f c1">Fabric</div><div class="chip-f c2">Databricks</div><div class="chip-f c3">Snowflake</div></div><div class="scrollcue" aria-hidden="true"></div></section>

<div class="marq" data-render="tech-marquee" aria-label="Technologies we work with"></div>

<section class="sec"><div class="wrap center">
  <div class="eyebrow rv">Who we are</div>
  <h2 class="rv" style="--d:.07s;max-width:1000px;margin:0 auto">A specialist team that turns <span class="grad">complex data</span> into dependable, decision-ready platforms.</h2>
  <p class="lead rv" style="--d:.14s;margin:28px auto 0">From a single pipeline to a full enterprise lakehouse, we embed senior engineers who ship, document and hand over, wherever you are in the world.</p>
  <div class="vslot" data-render="video-frame" data-key="cloud-mesh" style="margin-top:56px"></div></div></section>

<section class="sec" style="padding-top:0"><div class="wrap center">${head('Our track record', 'Companies we have worked with')}</div><div class="marq" data-render="companies-strip" aria-label="Companies we have worked with"></div></section>

<section class="sec" style="padding-top:0"><div class="wrap">
  ${head('Hire us your way', 'Flexible, affordable and <span class="grad">guaranteed.</span>', 'Pick the engagement that fits. Every option comes with rates below typical market prices and delivery you can count on.')}
  <div class="grid g3">
    <div class="card rv"><div class="ico"><svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg></div><h3>Hire by the day</h3><p>Need an expert for a day, a week or a month? Book a senior engineer on a simple per-day basis. No long contracts, start and stop when you need.</p></div>
    <div class="card rv" style="--d:.1s"><div class="ico"><svg viewBox="0 0 24 24"><path d="M4 20V10M10 20V4M16 20v-8M22 20H2"/></svg></div><h3>Fixed-scope projects</h3><p>Hand us the whole project. Clear scope, clear price and end-to-end delivery, for less than you would typically pay elsewhere.</p></div>
    <div class="card rv" style="--d:.2s"><div class="ico"><svg viewBox="0 0 24 24"><path d="M12 3 4 6v6c0 5 3.4 8.3 8 9 4.6-.7 8-4 8-9V6l-8-3Z"/><path d="m8.5 12 2.5 2.5 4.5-5"/></svg></div><h3>Guaranteed delivery</h3><p>We commit to agreed milestones and acceptance criteria, with visible progress every week, so you know exactly where your project stands.</p></div>
  </div>
  <div class="center" style="margin-top:36px"><a class="btn primary" href="engagement.html">See engagement options ${ARROW}</a></div></div></section>

<section class="sec" style="padding-top:0"><div class="wrap"><div class="always dk rv">
  <div class="al-big"><span class="live"><i></i> Live coverage</span><b>24<em>×</em>7<em>×</em>365</b></div>
  <div class="al-txt"><h2>Always on. <span class="grad">Every hour of every day.</span></h2>
  <p class="lead">Follow-the-sun engineers across time zones watch your platforms, pipelines and databases around the clock, including weekends and public holidays.</p>
  <ul class="ticks"><li>Incident response at any hour, on any day of the year</li><li>Proactive monitoring that catches issues before your users do</li><li>One accountable team, with no handover gaps between time zones</li></ul>
  <div style="margin-top:28px"><a class="btn primary" href="contact.html?topic=Managed%20support%2024%C3%977%C3%97365">Talk to us now ${ARROW}</a></div></div>
</div></div></section>


<section class="sec" style="padding-top:0"><div class="wide">
  ${head('What we do', 'One partner. Every layer of the data stack.')}
  <div class="bento" data-render="services-bento"></div></div></section>

<section class="sec alt"><div class="wrap">
  ${head('Capabilities in motion', 'See what we build, <span class="grad">in action.</span>', 'Platforms, pipelines, security and AI, delivered end to end.')}
  <div class="vbento" data-render="video-bento" data-video-section></div></div></section>

<section class="sec light"><div class="wrap">
  ${head('How we work', 'From first call to production, <span style="color:#6366f1">in five clear steps.</span>', 'A transparent delivery model that keeps architecture, cost and quality visible at every stage.')}
  <div class="story"><div class="stick rv left"><div class="diagram" style="background:#07080d">
    <svg viewBox="0 0 400 360" fill="none" aria-label="Data platform delivery diagram">
      <g class="flows" stroke="#6366f1" stroke-width="2" stroke-linecap="round"><path class="flow" d="M150 66H250"/><path class="flow" d="M280 90C280 130 230 130 215 158"/><path class="flow" d="M170 214C150 240 110 240 100 268"/><path class="flow" d="M230 214C250 240 290 240 300 268"/></g>
      <g class="dn" data-i="0"><rect x="30" y="38" width="120" height="52" rx="16"/><text x="90" y="69" text-anchor="middle">Sources</text></g>
      <g class="dn" data-i="1"><rect x="250" y="38" width="120" height="52" rx="16"/><text x="310" y="69" text-anchor="middle">Architect</text></g>
      <g class="dn" data-i="2"><rect x="110" y="160" width="180" height="56" rx="18"/><text x="200" y="193" text-anchor="middle">Bronze · Silver · Gold</text></g>
      <g class="dn" data-i="3"><rect x="30" y="270" width="140" height="52" rx="16"/><text x="100" y="301" text-anchor="middle">Observe &amp; govern</text></g>
      <g class="dn" data-i="4"><rect x="230" y="270" width="140" height="52" rx="16"/><text x="300" y="301" text-anchor="middle">Analytics &amp; AI</text></g>
    </svg></div></div>
    <div class="steps" data-render="process"></div></div></div></section>

<section class="sec alt"><div class="wrap"><div class="stats" data-render="stats"></div></div></section>

<section class="sec dk showcase"><div class="wrap"><div class="story" style="align-items:center">
  <div><div class="eyebrow rv">See it in motion</div><h2 class="rv" style="--d:.07s">Pipelines that run <span class="grad">while you sleep.</span></h2>
  <p class="lead rv" style="--d:.14s;margin-top:20px">Orchestrated, observable and cost-aware from day one. Every run reports throughput, data quality and spend.</p>
  <ul class="ticks rv" style="--d:.2s"><li>Live lineage from source to dashboard</li><li>Automated quality gates on every layer</li><li>Cost guardrails with FinOps reporting</li></ul>
  <div style="margin-top:28px" class="rv"><a class="btn primary" href="services.html">Explore our services ${ARROW}</a></div></div>
  <div class="vframe rv right"><video autoplay muted loop playsinline preload="metadata" poster="assets/video/pipeline.jpg"><source src="assets/video/pipeline.mp4" type="video/mp4"></video></div></div></div></section>

<section class="sec"><div class="wrap story" style="align-items:center">
  <div><div class="eyebrow rv">Engineering-first</div><h2 class="rv" style="--d:.07s">Code you can read.<br>Pipelines you can trust.</h2>
  <p class="lead rv" style="--d:.14s;margin-top:22px">Every delivery ships with tests, CI/CD, monitoring and documentation, built on open formats like Delta and Parquet so you are never locked in.</p>
  <div style="margin-top:30px" class="rv"><a class="link" href="technologies.html">See our technology stack ${ARROW}</a></div></div>
  <div class="term rv right"><div class="tb"><i></i><i></i><i></i></div><pre><span class="cm"># Silver layer: idempotent, tested, observable</span>
<span class="k">from</span> pyspark.sql <span class="k">import</span> functions <span class="k">as</span> F
<span class="k">from</span> delta.tables <span class="k">import</span> DeltaTable

bronze = spark.readStream.<span class="f">table</span>(<span class="s">"lake.bronze.orders"</span>)

clean = (bronze
  .<span class="f">dropDuplicates</span>([<span class="s">"order_id"</span>])
  .<span class="f">withColumn</span>(<span class="s">"amount"</span>, F.<span class="f">col</span>(<span class="s">"amount"</span>).<span class="f">cast</span>(<span class="s">"decimal(18,2)"</span>))
  .<span class="f">filter</span>(<span class="s">"amount &gt;= 0"</span>))

<span class="k">def</span> <span class="f">upsert</span>(df, _):
    (DeltaTable.<span class="f">forName</span>(spark, <span class="s">"lake.silver.orders"</span>).alias(<span class="s">"t"</span>)
      .<span class="f">merge</span>(df.alias(<span class="s">"s"</span>), <span class="s">"t.order_id = s.order_id"</span>)
      .<span class="f">whenMatchedUpdateAll</span>().<span class="f">whenNotMatchedInsertAll</span>().<span class="f">execute</span>())

clean.writeStream.<span class="f">foreachBatch</span>(upsert).<span class="f">start</span>()  <span class="cm"># ✔ 99.9% pipeline reliability</span></pre></div></div></section>

<section class="sec alt"><div class="wrap">
  ${head('Technology', 'The platforms we master.', 'Certified, hands-on experience across the modern data stack.')}
  <div class="tiles" data-render="tech-tiles" data-limit="8"></div>
  <div class="center" style="margin-top:44px"><a class="btn ghost" href="technologies.html">View all technologies ${ARROW}</a></div></div></section>

<section class="sec"><div class="wrap">
  ${head('Voices', 'Trusted by teams that ship.', 'Sample feedback shown. Replace with real client quotes from the admin panel.')}
  <div class="quotes" data-render="testimonials"></div></div></section>

<section class="sec alt"><div class="wrap">
  <div class="tools"><div><div class="eyebrow">Insights</div><h2>From the blog.</h2></div><a class="btn ghost" href="blog.html">All articles ${ARROW}</a></div>
  <div class="posts" data-render="blog-latest"></div></div></section>

<section class="sec"><div class="wrap">${head('FAQ', 'Questions, answered.')}<div class="faq" data-render="faq" data-limit="5"></div>
  <div class="center" style="margin-top:36px"><a class="link" href="faq.html">More questions ${ARROW}</a></div></div></section>
${cta(undefined, undefined, 'ai-core')}`});

/* ---------------- ABOUT ---------------- */
add({ file: 'about.html', page: 'about', title: 'About Us | Intellytiq Solutions', desc: 'Learn about Intellytiq Solutions: a remote-first data engineering and cloud consultancy specialising in Microsoft Fabric, Databricks, Snowflake, SQL Server and Azure.',
body: `${phero('We are <span class="grad">Intellytiq</span>.', 'A remote-first team of data and cloud specialists helping companies worldwide turn raw data into reliable, governed, decision-ready platforms.', 'About')}
<section class="sec" style="padding-top:20px"><div class="wrap story" style="align-items:center">
  <div class="illus rv left"><img src="assets/img/dashboard.svg" alt="Analytics dashboard" loading="lazy"></div>
  <div><div class="eyebrow rv">Our mission</div><h2 class="rv" style="--d:.07s">Make enterprise-grade data engineering accessible to every company.</h2></div>
  <div><p class="lead rv" style="--d:.1s;margin-bottom:22px">Intellytiq Solutions provides the technical capabilities and skillsets companies need: Microsoft Fabric, Databricks, Snowflake, MS SQL, data engineering, warehousing and Azure cloud services.</p>
  <p class="lead rv" style="--d:.16s">We are open to all kinds of remote IT work, from short specialist engagements to long-term dedicated squads, and we hold ourselves to one standard: ship work that your team is proud to own.</p></div></div></section>
<section class="sec" style="padding-top:0"><div class="wrap"><div class="vslot" data-render="video-frame" data-key="zero-trust"></div></div></section>
<section class="sec alt"><div class="wrap">${head('Principles', 'What we stand for.')}<div class="grid g4" data-render="values"></div></div></section>
<section class="sec"><div class="wrap"><div class="stats" data-render="stats"></div></div></section>
<section class="sec alt"><div class="wrap">${head('Journey', 'Our story so far.')}<div class="tl" data-render="timeline"></div></div></section>
<section class="sec alt"><div class="wrap">${head('Experience', 'Companies and environments we have delivered in', 'A selection of the organisations where our team has delivered data and cloud work.')}<div class="grid g3" data-render="companies-grid"></div></div></section>
<section class="sec"><div class="wrap">${head('Industries', 'Experience across sectors.')}<div class="grid g4" data-render="industries"></div></div></section>
${cta('Meet the people behind the platforms.', 'Say hello to our team, or tell us what you’re building.')}`});

/* ---------------- SERVICES ---------------- */
add({ file: 'services.html', page: 'services', title: 'Services | Intellytiq Solutions', desc: 'Microsoft Fabric, Databricks, Snowflake, data engineering, data warehousing, MS SQL Server, Azure cloud, BI and remote IT staffing services.',
body: `${phero('Services built for the <span class="grad">modern data estate</span>.', 'Strategy, engineering and operations across the platforms that matter, delivered by senior specialists, remotely and worldwide.', 'Services')}
<section class="sec" style="padding-top:20px"><div class="wrap story" style="align-items:center"><div class="illus rv left"><img src="assets/img/lakehouse.svg" alt="Bronze, silver and gold lakehouse layers" loading="lazy"></div><div><div class="eyebrow rv">Our approach</div><h2 class="rv" style="--d:.07s">Every layer, engineered with care.</h2><p class="lead rv" style="--d:.14s;margin-top:18px">From raw ingestion to curated, governed insight, we build the medallion layers your analytics depend on.</p></div></div></section>
<section class="sec" style="padding-top:0"><div class="wrap"><div class="vslot" data-render="video-frame" data-key="lakehouse-telemetry"></div></div></section>
<section class="sec" style="padding-top:20px"><div class="wrap"><div class="grid g3" data-render="services-grid"></div></div></section>
<section class="sec" style="padding-top:0"><div class="wrap"><div class="assure-bar rv"><div><b>Per day or per project, for less.</b><p>Book an engineer by the day or hand us the full project. Rates are below typical market prices and delivery is guaranteed.</p></div><a class="btn primary" href="contact.html">Get a quote ${ARROW}</a></div></div></section>
<section class="sec alt"><div class="wrap">${head('Technologies', 'Technologies we deliver on.', 'Select any logo to see what we deliver with it and how we can help with your project.')}<div class="tiles" data-render="tech-tiles"></div></div></section>
<section class="sec light"><div class="wrap">${head('Delivery', 'A process you can see.', 'Five stages. Zero black boxes.')}
  <div class="story"><div class="stick rv left"><div class="diagram" style="background:#07080d"><svg viewBox="0 0 400 360" fill="none"><g stroke="#6366f1" stroke-width="2" stroke-linecap="round"><path class="flow" d="M150 66H250"/><path class="flow" d="M280 90C280 130 230 130 215 158"/><path class="flow" d="M170 214C150 240 110 240 100 268"/><path class="flow" d="M230 214C250 240 290 240 300 268"/></g>
  <g class="dn" data-i="0"><rect x="30" y="38" width="120" height="52" rx="16"/><text x="90" y="69" text-anchor="middle">Discover</text></g><g class="dn" data-i="1"><rect x="250" y="38" width="120" height="52" rx="16"/><text x="310" y="69" text-anchor="middle">Architect</text></g><g class="dn" data-i="2"><rect x="110" y="160" width="180" height="56" rx="18"/><text x="200" y="193" text-anchor="middle">Build</text></g><g class="dn" data-i="3"><rect x="30" y="270" width="140" height="52" rx="16"/><text x="100" y="301" text-anchor="middle">Operate</text></g><g class="dn" data-i="4"><rect x="230" y="270" width="140" height="52" rx="16"/><text x="300" y="301" text-anchor="middle">Enable</text></g></svg></div></div>
  <div data-render="process"></div></div></div></section>
<section class="sec"><div class="wrap">${head('FAQ', 'Good to know.')}<div class="faq" data-render="faq" data-limit="4"></div></div></section>
${cta()}`});

/* ---------------- SERVICE DETAIL ---------------- */
add({ file: 'service.html', page: 'service', title: 'Service | Intellytiq Solutions', desc: 'Intellytiq Solutions service details: capabilities, deliverables and technologies.',
body: `<section class="phero"><canvas class="net"></canvas><div class="wrap"><div class="crumbs"><a href="index.html">Home</a> / <a href="services.html">Services</a> / <span id="svcCrumb">Service</span></div><h1 id="svcTitle">Service</h1><p class="lead" id="svcSummary"></p></div></section>
<section class="sec" style="padding-top:20px"><div class="wrap"><div id="svcMedia" style="margin-bottom:44px"></div><div data-render="service-detail"></div></div></section>
<section class="sec alt"><div class="wrap">${head('Keep exploring', 'Related services.')}<div class="grid g3" id="related"></div></div></section>
${cta()}`});

/* ---------------- TECHNOLOGIES ---------------- */
add({ file: 'technologies.html', page: 'tech', title: 'Technologies | Intellytiq Solutions', desc: 'The technology stack Intellytiq Solutions works with: Microsoft Fabric, Databricks, Snowflake, SQL Server, Azure, Spark, dbt, Power BI, Kafka and Terraform.',
body: `${phero('The stack we <span class="grad">master</span>.', 'Deep, hands-on expertise across lakehouse, warehouse, streaming, orchestration, governance and DevOps tooling. Select any technology to see how we can help.', 'Technologies')}
<div class="marq" data-render="tech-marquee"></div>
<section class="sec" style="padding-top:20px"><div class="wrap story" style="align-items:center"><div class="illus rv left"><img src="assets/img/cloud.svg" alt="Cloud platform connected to data services" loading="lazy"></div><div><div class="eyebrow rv">One connected stack</div><h2 class="rv" style="--d:.07s">Cloud-native from the ground up.</h2><p class="lead rv" style="--d:.14s;margin-top:18px">Fabric, Databricks, Snowflake and Azure services working together, secured and governed as one platform.</p></div></div></section>
<section class="sec" style="padding-top:20px"><div class="wrap"><div class="tiles" data-render="tech-tiles"></div></div></section>
<section class="sec" style="padding-top:0"><div class="wrap"><div class="vslot" data-render="video-frame" data-key="devops-pipeline"></div></div></section>
<section class="sec alt"><div class="wrap">${head('Architecture', 'Open formats. No lock-in.', 'We favour Delta, Parquet and Iceberg-compatible patterns so your data stays yours.')}
  <div class="grid g3"><div class="card rv"><h3>Lakehouse</h3><p>Medallion layers on Delta Lake across Fabric OneLake and Databricks with Unity Catalog governance.</p></div><div class="card rv" style="--d:.1s"><h3>Warehouse</h3><p>Dimensional and Data Vault models on Snowflake, Fabric Warehouse and SQL Server.</p></div><div class="card rv" style="--d:.2s"><h3>Real-time</h3><p>Event-driven designs with Kafka, Event Hubs, Fabric Eventstreams and Structured Streaming.</p></div></div></div></section>
${cta()}`});

/* ---------------- INDUSTRIES ---------------- */
add({ file: 'industries.html', page: 'industries', title: 'Industries | Intellytiq Solutions', desc: 'Data engineering and analytics solutions for financial services, healthcare, retail, manufacturing, telecom, energy, SaaS and the public sector.',
body: `${phero('Industries we <span class="grad">serve</span>.', 'Domain context makes data platforms useful. We bring patterns proven across sectors, and adapt them to yours.', 'Industries')}
<section class="sec" style="padding-top:20px"><div class="wrap"><div class="grid g4" data-render="industries"></div></div></section>${cta()}`});

/* ---------------- CASE STUDIES ---------------- */
add({ file: 'case-studies.html', page: 'cases', title: 'Case Studies | Intellytiq Solutions', desc: 'Example engagements: lakehouse modernisation, Fabric migration, Snowflake optimisation and SQL Server to Azure SQL migration.',
body: `${phero('Work that <span class="grad">moves the needle</span>.', 'Representative engagement types. Edit these in the admin panel with your real, approved client stories.', 'Case studies')}
<section class="sec" style="padding-top:20px"><div class="wrap"><div class="grid g2" data-render="projects"></div></div></section>${cta()}`});

/* ---------------- TEAM ---------------- */
add({ file: 'team.html', page: 'team', title: 'Our Team | Intellytiq Solutions', desc: 'Meet the Intellytiq Solutions team: Raj Singh (Director), Pooja Singh (HR) and CB Singh (Senior Data Engineer), and our open roles.',
body: `${phero('The people behind <span class="grad">Intellytiq</span>.', 'A small, senior, remote-first team that cares about craft, clarity and outcomes.', 'Team')}
<section class="sec" style="padding-top:20px"><div class="wrap"><div class="team" data-render="team"></div></div></section>
<section class="sec alt"><div class="wrap">${head('Growing', 'Open roles. Your name could be here.', 'We’re expanding our bench of remote specialists. Pick a role and say hello.')}<div class="team" id="openRoles"></div></div></section>
<section class="sec"><div class="wrap">${head('Culture', 'How we work together.')}<div class="grid g3"><div class="card rv"><div class="ico"><svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c3 3 3 15 0 18M12 3c-3 3-3 15 0 18"/></svg></div><h3>Remote-first</h3><p>Work from anywhere with a small daily overlap and written-first communication.</p></div><div class="card rv" style="--d:.1s"><div class="ico"><svg viewBox="0 0 24 24"><path d="M13 2 4 14h7l-1 8 9-12h-7l1-8Z"/></svg></div><h3>Craft over hype</h3><p>Code reviews, tests, documentation and honest trade-offs on every project.</p></div><div class="card rv" style="--d:.2s"><div class="ico"><svg viewBox="0 0 24 24"><path d="M4 20V10M10 20V4M16 20v-8M22 20H2"/></svg></div><h3>Grow continuously</h3><p>Certification support, learning time and exposure to varied platforms and clients.</p></div></div></div></section>
${cta('Want to work with us?', 'See open roles or send us your profile.')}`});

/* ---------------- CAREERS ---------------- */
add({ file: 'careers.html', page: 'careers', title: 'Careers | Intellytiq Solutions', desc: 'Remote careers in data engineering, Microsoft Fabric, Snowflake, SQL Server and Azure at Intellytiq Solutions.',
body: `${phero('Build the future of <span class="grad">data</span> with us.', 'Remote-first roles for engineers who love clean pipelines, clear thinking and great teammates.', 'Careers')}
<section class="sec" style="padding-top:20px"><div class="wrap"><div class="illus rv" style="max-width:520px;margin:0 auto 40px"><img src="assets/img/globe.svg" alt="Globe with connected locations" loading="lazy"></div><div class="grid g3">
<div class="card rv"><h3>Work from anywhere</h3><p>Remote by default, outcome-focused, with flexible hours.</p></div><div class="card rv" style="--d:.08s"><h3>Learn & certify</h3><p>Support for Microsoft, Databricks and Snowflake certifications.</p></div><div class="card rv" style="--d:.16s"><h3>Meaningful projects</h3><p>Real platforms for real companies, not busywork.</p></div></div></div></section>
<section class="sec alt"><div class="wrap">${head('Open positions', 'Find your role.')}<div style="display:grid;gap:14px" data-render="careers"></div></div></section>
${cta('Don’t see your role?', 'Send us your profile and we’ll keep you in mind for upcoming engagements.')}`});

/* ---------------- BLOG ---------------- */
add({ file: 'blog.html', page: 'blog', title: 'Blog | Intellytiq Solutions', desc: 'Insights on Microsoft Fabric, Databricks, Snowflake, SQL Server, Azure and data engineering from the Intellytiq team.',
body: `${phero('Ideas, patterns & <span class="grad">field notes</span>.', 'Practical writing on lakehouses, warehouses, pipelines and cloud from engineers who build them.', 'Blog')}
<section class="sec" style="padding-top:10px"><div class="wide">
  <div class="tools"><div class="chips" id="chips"></div>
    <div style="display:flex;gap:12px;align-items:center;flex-wrap:wrap"><span class="muted" id="count" style="font-size:14px"></span>
    <label class="search"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.500-3.500"/></svg><input id="q" type="search" placeholder="Search articles" aria-label="Search articles"></label>
    <div class="toggle" role="group" aria-label="Layout"><button data-v="grid" aria-label="Grid view"><svg viewBox="0 0 24 24"><rect x="3" y="3" width="7" height="7" rx="1.500"/><rect x="14" y="3" width="7" height="7" rx="1.500"/><rect x="3" y="14" width="7" height="7" rx="1.500"/><rect x="14" y="14" width="7" height="7" rx="1.500"/></svg></button><button data-v="list" aria-label="List view"><svg viewBox="0 0 24 24"><path d="M4 6h16M4 12h16M4 18h16"/></svg></button></div></div></div>
  <div id="featured"></div><div class="posts" id="posts"></div></div></section>
${cta('Get new articles in your inbox.', 'Use the newsletter box in the footer, or talk to us about your data challenge.')}`});

/* ---------------- POST ---------------- */
add({ file: 'post.html', page: 'post', title: 'Article | Intellytiq Solutions', desc: 'Article from the Intellytiq Solutions blog.',
body: `<section class="phero" style="padding-bottom:40px"><div class="wrap" style="max-width:860px"><div class="crumbs"><a href="blog.html">Blog</a> / <span id="pCat"></span></div><h1 id="pTitle" style="font-size:clamp(34px,5vw,64px)"></h1><p class="muted" id="pMeta" style="margin-top:20px"></p></div></section>
<section style="padding-bottom:20px"><div class="wrap" style="max-width:980px"><div id="pCover" class="rv in" style="border-radius:32px;overflow:hidden;aspect-ratio:21/9"></div><div id="pVideo" style="margin-top:24px"></div></div></section>
<section class="sec" style="padding-top:60px"><div class="wrap"><article class="article" id="article"></article>
  <div class="center" style="margin-top:40px"><a id="share" class="btn ghost" target="_blank" rel="noopener">Share on LinkedIn ${ARROW}</a></div></div></section>
<section class="sec alt"><div class="wrap"><div class="tools"><h2>Keep reading</h2><a class="link" href="blog.html">All articles ${ARROW}</a></div><div class="posts" id="relPosts"></div></div></section>${cta()}`});

/* ---------------- CONTACT ---------------- */
add({ file: 'contact.html', page: 'contact', title: 'Contact Us | Intellytiq Solutions', desc: 'Contact Intellytiq Solutions for Microsoft Fabric, Databricks, Snowflake, SQL Server and Azure consulting or remote IT talent.',
body: `${phero('Let’s <span class="grad">talk</span>.', 'Tell us what you’re building. A senior engineer, not a salesperson, will respond within one business day.', 'Contact')}
<section class="sec" style="padding-top:0"><div class="wrap"><div class="assure-bar rv"><div><b>Need someone for a day, a week or a whole project?</b><p>We work per-day and on a project basis, at rates below typical market prices, with guaranteed delivery. We are available 24×7, 365 days a year. Tell us what you need.</p></div></div></div></section>
<section class="sec" style="padding-top:20px"><div class="wrap contact">
  <div><div class="illus rv left" style="margin-bottom:26px"><img src="assets/img/globe.svg" alt="Globe with connected locations" loading="lazy"></div><div class="info" data-render="contactinfo"></div></div>
  <form class="form card rv" data-contact novalidate style="padding:clamp(24px,4vw,44px)"><h3 style="margin-bottom:6px">Send us a message</h3>
    <div class="row"><div class="field"><input id="f1" name="name" placeholder=" " required autocomplete="name"><label for="f1">Full name</label></div><div class="field"><input id="f2" type="email" name="email" placeholder=" " required autocomplete="email"><label for="f2">Work email</label></div></div>
    <div class="row"><div class="field"><input id="f3" name="company" placeholder=" " autocomplete="organization"><label for="f3">Company</label></div>
    <div class="field"><select id="f4" name="topic"><option>General enquiry</option><option>Microsoft Fabric</option><option>Databricks Lakehouse</option><option>Snowflake Data Cloud</option><option>Data Engineering</option><option>Data Warehousing &amp; Modelling</option><option>MS SQL Server &amp; Azure SQL</option><option>Azure Cloud Services</option><option>Remote IT Talent &amp; Staff Augmentation</option></select><label for="f4">Topic</label></div></div>
    <div class="field"><textarea id="f5" name="message" placeholder=" " required></textarea><label for="f5">How can we help?</label></div>
    <input class="hp" name="hp" tabindex="-1" autocomplete="off" aria-hidden="true">
    <div data-captcha hidden></div>
    <div class="note" role="status"></div>
    <button class="btn primary" type="submit" style="justify-content:center">Send message ${ARROW}</button></form></div></section>`});

/* ---------------- ENGAGEMENT ---------------- */
add({ file: 'engagement.html', page: 'engagement', title: 'Engagement Models | Intellytiq Solutions', desc: 'Hire Intellytiq Solutions per day or per project: flexible engagement models, rates below typical market prices and guaranteed delivery.',
body: `${phero('Hire us by the day, or by the <span class="grad">project</span>.', 'Flexible engagement models to match your scope, budget and pace. All remote, all worldwide, at rates below typical market prices and with guaranteed delivery.', 'Engagement models')}
<section class="sec" style="padding-top:20px"><div class="wrap"><div class="grid g2">
<div class="card plan hot rv"><div class="tag2">Most flexible</div><h3>Per-day engagement</h3><p>Book a senior engineer, architect or DBA by the day. Ideal for health checks, urgent fixes, short sprints and filling a gap while you hire.</p><ul class="ck"><li>Start within days, stop any time</li><li>No long-term commitment</li><li>Extend whenever you like</li><li>Transparent daily rate</li></ul><a class="btn primary" href="contact.html?topic=Remote%20IT%20Talent%20%26%20Staff%20Augmentation">Book by the day</a></div>
<div class="card plan rv" style="--d:.08s"><div class="tag2">Project basis</div><h3>Fixed-scope project</h3><p>Hand us the whole project. Clear scope, milestones and price for migrations, platform builds and optimisation programmes.</p><ul class="ck"><li>Defined scope and milestones</li><li>Price agreed up front</li><li>Documentation and handover</li><li>Guaranteed delivery</li></ul><a class="btn ghost" href="contact.html?topic=Data%20Engineering">Scope a project</a></div>
<div class="card plan rv" style="--d:.16s"><div class="tag2">Team</div><h3>Dedicated remote squad</h3><p>A cross-functional team of engineers and an architect embedded in your roadmap.</p><ul class="ck"><li>Time-zone aligned team</li><li>Scale up or down monthly</li><li>Delivery management included</li><li>Shared KPIs and weekly demos</li></ul><a class="btn ghost" href="contact.html?topic=Remote%20IT%20Talent%20%26%20Staff%20Augmentation">Build your squad</a></div>
<div class="card plan rv" style="--d:.24s"><div class="tag2">Ongoing</div><h3>Managed support</h3><p>Managed 24×7×365 DBA and platform support on a retainer, with proactive monitoring and incident response at any hour.</p><ul class="ck"><li>Proactive monitoring</li><li>24×7×365 SLA-backed response</li><li>Monthly health reports</li><li>Cost optimisation reviews</li></ul><a class="btn ghost" href="contact.html?topic=MS%20SQL%20Server%20%26%20Azure%20SQL">Request support</a></div></div></div></section>
<section class="sec alt"><div class="wrap">${head('Why teams choose us', 'Less cost. More certainty.')}<div class="grid g3">
<div class="card rv"><h3>Rates below typical market prices</h3><p>Senior skills without the usual premium. You get a clear estimate up front, so there are no surprises.</p></div>
<div class="card rv" style="--d:.1s"><h3>Guaranteed delivery</h3><p>Agreed scope, milestones and acceptance criteria, with progress you can see every week. Guarantee terms are written into your agreement.</p></div>
<div class="card rv" style="--d:.2s"><h3>The right skill set</h3><p>Microsoft Fabric, Databricks, Snowflake, SQL Server and Azure experts, matched to your project and time zone.</p></div></div></div></section>${cta()}`});

/* ---------------- FAQ ---------------- */
add({ file: 'faq.html', page: 'faq', title: 'FAQ | Intellytiq Solutions', desc: 'Frequently asked questions about Intellytiq Solutions services, engagement models and remote delivery.',
body: `${phero('Frequently asked <span class="grad">questions</span>.', 'Everything you need to know before we start.', 'FAQ')}<section class="sec" style="padding-top:20px"><div class="wrap"><div class="faq" data-render="faq"></div></div></section>${cta('Still have questions?', 'We’re happy to talk it through.')}`});

/* ---------------- LEGAL ---------------- */
const legal = (file, title, h1, body) => add({ file, page: 'legal', title: `${title} | Intellytiq Solutions`, desc: `${title} for Intellytiq Solutions.`, body: `${phero(h1, 'Last updated: ' + new Date().toISOString().slice(0, 10), title)}<section class="sec" style="padding-top:10px"><div class="wrap legal" style="max-width:820px">${body}</div></section>` });
legal('privacy.html', 'Privacy Policy', 'Privacy <span class="grad">Policy</span>', `<p>This is a general template. Please have it reviewed by qualified counsel before relying on it.</p><h2>Information we collect</h2><p>When you contact us we collect your name, email, company and message. If you subscribe to the newsletter we collect your email address. We do not use advertising trackers.</p><h2>How we use it</h2><ul><li>To respond to your enquiry.</li><li>To send updates you have subscribed to (unsubscribe any time).</li><li>To improve our services and keep the site secure.</li></ul><h2>Retention and security</h2><p>Enquiries are stored securely and deleted on request. Access is restricted to authorised staff.</p><h2>Your rights</h2><p>You may request access, correction or deletion of your personal data by contacting us via the Contact page.</p>`);
legal('terms.html', 'Terms of Use', 'Terms of <span class="grad">Use</span>', `<p>This is a general template. Please have it reviewed by qualified counsel before relying on it.</p><h2>Use of this site</h2><p>The content on this website is provided for general information. By using it you agree not to misuse, scrape at scale, or attempt to disrupt the service.</p><h2>Intellectual property</h2><p>All content, design and code is owned by Intellytiq Solutions unless stated. Third-party product names are trademarks of their respective owners; use does not imply endorsement.</p><h2>Liability</h2><p>Information is provided “as is” without warranties. Engagements are governed by a separate written agreement.</p>`);

/* ---------------- 404 ---------------- */
add({ file: '404.html', page: 'notfound', title: 'Page not found | Intellytiq Solutions', desc: 'Page not found.',
body: `<section class="hero" style="min-height:90vh"><div class="halo"><i></i><i></i><i></i></div><canvas class="net"></canvas><div class="wrap center"><h1><span class="grad">404</span></h1><p class="lead" style="margin:20px auto 34px">This pipeline doesn’t lead anywhere. Let’s get you back on track.</p><a class="btn primary" href="index.html">Back to home ${ARROW}</a></div></section>` });

for (const p of pages) writeFileSync(join(root, p.file), shell(p));

const urls = pages.filter(p => !['404.html'].includes(p.file)).map(p => `  <url><loc>${SITE}/${p.file === 'index.html' ? '' : p.file}</loc></url>`).join('\n');
writeFileSync(join(root, 'sitemap.xml'), `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`);
writeFileSync(join(root, 'robots.txt'), `User-agent: *\nAllow: /\nDisallow: /admin/\nDisallow: /api.php\nSitemap: ${SITE}/sitemap.xml\n`);

// The admin page is hand-written, so stamp its asset addresses the same way.
const adminPath = join(root, 'admin/index.html');
writeFileSync(adminPath, readFileSync(adminPath, 'utf8').replace(/(href|src)="((?:\.\.\/)?[^"?]+\.(?:css|js))(?:\?v=[a-f0-9]+)?"/g, (m, attr, p) => `${attr}="${p}?v=${ver(join('admin', p))}"`));
console.log(`Generated ${pages.length} pages.`);
