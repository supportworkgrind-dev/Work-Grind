import { ReactNode } from 'react';
import { ArrowUpRight, Check, Circle, Clock3 } from 'lucide-react';
import { ThemeAwareLogo } from '@/components/common/ThemeAwareLogo';

export function AuthShell({ children }: { children: ReactNode }) {
  return (
    <main className="auth-shell">
      <aside className="auth-editorial" aria-label="WorkGrind workspace preview">
        <div className="auth-brand">
          <ThemeAwareLogo size="md" showWordmark surface="dark" />
          <span className="auth-brand-note">WORK, IN GOOD ORDER.</span>
        </div>

        <div className="auth-editorial-copy">
          <p className="auth-kicker">THE WORKSPACE THAT MOVES WITH YOU</p>
          <h2>Make room<br />for your best work.</h2>
          <p className="auth-editorial-description">
            Projects, people and progress — brought into one considered place.
          </p>
        </div>

        <div className="auth-workspace-preview" aria-label="Illustration of a WorkGrind workspace">
          <div className="auth-preview-topline">
            <span>MONDAY / OVERVIEW</span>
            <span className="auth-preview-live"><i /> LIVE</span>
          </div>
          <div className="auth-preview-heading">Good morning, team<span>.</span></div>
          <div className="auth-preview-rule" />
          <div className="auth-preview-row">
            <div className="auth-preview-icon"><Check size={13} /></div>
            <div className="auth-preview-task">
              <strong>Launch planning</strong>
              <small>Product / Due today</small>
            </div>
            <span className="auth-preview-owner">AM</span>
          </div>
          <div className="auth-preview-row">
            <div className="auth-preview-icon auth-preview-icon-open"><Circle size={12} /></div>
            <div className="auth-preview-task">
              <strong>Review Q3 pipeline</strong>
              <small>Sales / In progress</small>
            </div>
            <span className="auth-preview-owner auth-preview-owner-warm">JL</span>
          </div>
          <div className="auth-preview-footer">
            <span><Clock3 size={12} /> FOCUS BLOCK</span>
            <strong>2h 40m <ArrowUpRight size={13} /></strong>
          </div>
        </div>

        <p className="auth-editorial-foot">A clearer way to work together.</p>
      </aside>

      <section className="auth-main">
        <div className="auth-mobile-brand">
          <ThemeAwareLogo size="md" showWordmark />
        </div>
        <div className="auth-content">{children}</div>
        <footer className="auth-main-footer">
          <span>© {new Date().getFullYear()} WorkGrind</span>
          <span>Thoughtful work starts here.</span>
        </footer>
      </section>
    </main>
  );
}
