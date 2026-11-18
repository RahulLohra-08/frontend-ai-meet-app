import { motion } from 'framer-motion';
import { ArrowUpRight, AudioLines, BrainCircuit, Check, ChevronRight, Globe2, Languages, LockKeyhole, Play, Sparkles, Video, WandSparkles } from 'lucide-react';
import { Link } from 'react-router-dom';

const reveal = { hidden: { opacity: 0, y: 22 }, visible: { opacity: 1, y: 0 } };

export default function Home() {
  return <div className="site-shell">
    <header className="site-nav">
      <Link to="/" className="brand"><span className="brand-mark"><Globe2 size={22} /></span><span>lingua<span className="brand-accent">meet</span><small>AI meeting companion</small></span></Link>
      <nav className="nav-links"><a href="#features">Features</a><Link to="/how-it-works">How it works</Link><Link to="/technology">Technology</Link><Link to="/pricing">Pricing</Link></nav>
      <div className="nav-actions"><Link to="/login" className="nav-login">Log in</Link><Link to="/signup" className="button button-primary button-small">Get started <ArrowUpRight size={16} /></Link></div>
    </header>

    <main>
      <section className="hero-section">
        <div className="hero-orb hero-orb-one"/><div className="hero-orb hero-orb-two"/>
        <motion.div className="hero-copy" initial="hidden" animate="visible" variants={{ visible: { transition: { staggerChildren: .11 } } }}>
          <motion.div variants={reveal} className="eyebrow"><span className="eyebrow-dot"/> MEET WITHOUT LANGUAGE BARRIERS</motion.div>
          <motion.h1 variants={reveal}>Good conversations<br/>have <em>no borders.</em></motion.h1>
          <motion.p variants={reveal}>Meet naturally in your own language. Lingua Meet brings live captions, thoughtful translations and AI meeting notes together in one calm workspace.</motion.p>
          <motion.div variants={reveal} className="hero-actions"><Link to="/signup" className="button button-primary">Start your first meeting <ChevronRight size={18}/></Link><Link to="/how-it-works" className="button button-secondary"><Play size={16} fill="currentColor"/> See how it works</Link></motion.div>
          <motion.div variants={reveal} className="trust-row"><div className="avatar-stack"><span>AR</span><span>MK</span><span>JL</span><span>+8</span></div><div><strong>Made for teams everywhere</strong><small>Clearer conversations, better follow-through.</small></div></motion.div>
        </motion.div>

        <motion.div className="product-preview" initial={{ opacity: 0, scale: .96, y: 18 }} animate={{ opacity: 1, scale: 1, y: 0 }} transition={{ duration: .65, delay: .2 }}>
          <div className="preview-topbar"><div className="window-dots"><i/><i/><i/></div><div className="preview-meeting-title"><span className="live-dot"/> Product planning <span className="preview-timer">18:42</span></div><span className="preview-chip">AI enabled</span></div>
          <div className="preview-body">
            <div className="preview-stage">
              <div className="person-tile person-tile-main"><div className="person-photo photo-one"><span>AM</span></div><div className="person-label"><span>Amisha Mehta</span><small><AudioLines size={12}/> Speaking</small></div><span className="tile-mic"><AudioLines size={14}/></span></div>
              <div className="person-tile person-tile-secondary"><div className="person-photo photo-two"><span>RK</span></div><div className="person-label"><span>Rahul Kumar</span><small>Hindi · India</small></div></div>
              <div className="caption-float"><span>LIVE CAPTIONS</span><p>Let’s align on the launch timeline and next steps.</p><p className="caption-translation">आइए लॉन्च की समय-सीमा और अगले कदम तय करें।</p></div>
            </div>
            <aside className="preview-side"><div className="side-heading"><span className="side-icon"><Languages size={15}/></span><div><strong>Live translation</strong><small>English → Hindi</small></div></div><div className="translation-card"><small>ORIGINAL</small><p>Can we review the launch plan?</p></div><div className="translation-card translation-card-active"><small>TRANSLATION</small><p>क्या हम लॉन्च प्लान की समीक्षा कर सकते हैं?</p></div><div className="ai-note-card"><div className="ai-note-heading"><Sparkles size={15}/> AI meeting notes</div><p><Check size={13}/> Timeline reviewed</p><p><Check size={13}/> Owners identified</p><p className="note-muted">Summary ready after the call</p></div></aside>
          </div>
          <div className="preview-controls"><span className="control-pill"><AudioLines size={15}/> Mic on</span><span className="control-pill"><Video size={15}/> Camera</span><span className="control-pill"><Languages size={15}/> Translate</span><span className="control-leave">Leave call</span></div>
        </motion.div>
        <div className="hero-footnote"><LockKeyhole size={14}/> Your conversations stay in your workspace <span>·</span> Built for focused collaboration</div>
      </section>

      <section id="features" className="features-section section-wrap">
        <div className="section-intro"><div className="eyebrow">ONE WORKSPACE, MORE CLARITY</div><h2>Less friction in the meeting.<br/><em>More progress after it.</em></h2><p>Everything you need to understand each other and keep the work moving—without a cluttered interface.</p></div>
        <div className="feature-grid">
          {[{ icon: Languages, n: '01', title: 'Speak your language', desc: 'Readable live captions and contextual translations help everyone follow along.' }, { icon: AudioLines, n: '02', title: 'Stay in the moment', desc: 'A focused meeting space keeps the conversation front and centre.' }, { icon: BrainCircuit, n: '03', title: 'Leave with a plan', desc: 'Turn the transcript into summaries, decisions and reviewable action items.' }].map((f, i) => <motion.article key={f.n} className="feature-card" initial={{ opacity: 0, y: 18 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, amount: .25 }} transition={{ delay: i * .08 }}><div className="feature-card-top"><span className="feature-icon"><f.icon size={22}/></span><span>{f.n}</span></div><h3>{f.title}</h3><p>{f.desc}</p><span className="feature-arrow"><ArrowUpRight size={17}/></span></motion.article>)}
        </div>
      </section>

      <section className="workflow-section"><div className="workflow-inner"><div className="workflow-copy"><div className="eyebrow">A BETTER WAY TO MEET</div><h2>From first hello<br/>to <em>clear next steps.</em></h2><p>One simple flow connects the conversation to the work that follows.</p><Link to="/signup" className="text-link">Try Lingua Meet <ArrowUpRight size={16}/></Link></div><div className="workflow-list">{[{icon:Video,title:'Meet',desc:'Start a focused video conversation.'},{icon:Languages,title:'Understand',desc:'Follow captions and translations as you talk.'},{icon:WandSparkles,title:'Capture',desc:'Create AI notes from the saved transcript.'},{icon:Check,title:'Follow through',desc:'Review action items and track what’s done.'}].map((step,i)=><motion.div key={step.title} className="workflow-step" initial={{opacity:0,x:16}} whileInView={{opacity:1,x:0}} viewport={{once:true}} transition={{delay:i*.07}}><span className="workflow-step-icon"><step.icon size={19}/></span><div><h3>{step.title}</h3><p>{step.desc}</p></div><span className="workflow-step-number">0{i+1}</span></motion.div>)}</div></div></section>

      <section className="cta-section"><div className="cta-card"><div className="cta-spark"><Sparkles size={20}/></div><h2>Make every voice part<br/>of the conversation.</h2><p>Start with one meeting. Leave with a little more clarity.</p><Link to="/signup" className="button button-light">Create your workspace <ArrowUpRight size={17}/></Link><span className="cta-decoration cta-decoration-one"/><span className="cta-decoration cta-decoration-two"/></div></section>
    </main>
    <footer className="site-footer"><Link to="/" className="brand"><span className="brand-mark"><Globe2 size={20}/></span><span>lingua<span className="brand-accent">meet</span><small>AI meeting companion</small></span></Link><span>© 2026 Lingua Meet AI</span><div><Link to="/privacy">Privacy</Link><Link to="/contact">Contact</Link></div></footer>
  </div>;
}
