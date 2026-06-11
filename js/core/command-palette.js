// js/core/command-palette.js — Ctrl+K omnibar for the Playbook
// Search across nav tabs, views, contracts, people, data categories, quick actions

import store from './store.js';
import { getCached } from './data.js';

// ─── Registry of searchable items ───
const _registry = [];

// Item shape: { id, category, label, description, keywords, action, icon }

function register(item) {
  _registry.push(item);
}

// ─── Built-in navigation items ───
register({ id: 'nav-home',     category: 'Navigate', label: 'Go Home',            description: 'Return to L.U.N.A. search',          keywords: 'home luna search',      action: () => window.goHome?.(),               icon: '🏠' });
register({ id: 'nav-playbook', category: 'Navigate', label: 'Open Playbook',      description: 'Browse playbook sections',           keywords: 'playbook sections kb',   action: () => window.setView?.('playbook'),     icon: '📖' });
register({ id: 'nav-projects', category: 'Navigate', label: 'Open Projects',      description: 'View project overview',               keywords: 'projects mfp miami',     action: () => window.setView?.('projects'),     icon: '🏗' });
register({ id: 'nav-actions',  category: 'Navigate', label: 'Open Action Items',  description: 'View flagged emails and reminders',    keywords: 'actions reminders flagged', action: () => window.openReminderPanel?.(),     icon: '⚡' });
register({ id: 'nav-briefing', category: 'Navigate', label: 'Open Briefing Panel', description: 'Daily briefing with actions + calendar', keywords: 'briefing daily',          action: () => window.openReminderPanel?.(),     icon: '📋' });

// ─── Data commands ───
register({ id: 'data-contracts',   category: 'Data', label: 'Browse Contracts',    description: 'Search all subcontracts and amounts',             keywords: 'subs vendors contracts', action: () => window.setView?.('playbook'),     icon: '📄' });
register({ id: 'data-financials',  category: 'Data', label: 'View Financials',     description: 'Budget, paid-to-date, retainage, CO totals',       keywords: 'budget financials cost',  action: () => window.setView?.('playbook'),     icon: '💰' });
register({ id: 'data-schedule',    category: 'Data', label: 'Project Schedule',    description: 'Milestones, phases, target completion dates',       keywords: 'schedule timeline dates', action: () => window.setView?.('playbook'),     icon: '📅' });
register({ id: 'data-cos',         category: 'Data', label: 'Change Orders',       description: 'Approved COs, pending, total amounts',             keywords: 'change orders cos pending', action: () => window.setView?.('playbook'),    icon: '📝' });
register({ id: 'data-risks',       category: 'Data', label: 'Top Project Risks',  description: 'Current risk register and mitigation status',       keywords: 'risks mitigation issues', action: () => {
  const btn = document.querySelector('[onclick*="Top project risks"]');
  btn?.click();
}, icon: '⚠' });

// ─── Quick actions ───
register({ id: 'action-chat',     category: 'Actions', label: 'Ask L.U.N.A.',      description: 'Ask anything about the project',                   keywords: 'chat ask luna question', action: () => document.querySelector('.luna-hero-input')?.focus(), icon: '💬' });
register({ id: 'action-signin',   category: 'Actions', label: 'Sign in (Microsoft)', description: 'Authenticate with Microsoft 365',                  keywords: 'sign in login microsoft', action: () => window.location.href = '/auth/login', icon: '🔑' });
register({ id: 'action-procore',  category: 'Actions', label: 'Open Procore Data', description: 'View live Procore subcontract data',                keywords: 'procore subs data sync',  action: () => window.location.href = '/procore/data', icon: '🔄' });
register({ id: 'action-refresh',  category: 'Actions', label: 'Refresh Data',       description: 'Force refresh all cached data',                    keywords: 'refresh reload sync',     action: () => {
  if (window.LU?.cache) { window.LU.cache.clear(); }
  window.location.reload();
}, icon: '🔄' });

// ─── People (from context if available) ───
function indexPeople() {
  const context = getCached('mfp_context');
  if (context?.people) {
    context.people.forEach(p => {
      register({
        id: `person-${p.name?.replace(/\s+/g, '-')}`,
        category: 'People',
        label: p.name,
        description: `${p.role || ''}${p.company ? ` — ${p.company}` : ''}${p.email ? ` — ${p.email}` : ''}`,
        keywords: `${p.name} ${p.role || ''} ${p.company || ''} ${p.email || ''}`,
        action: () => {
          // Search for the person in playbook
          const input = document.querySelector('.luna-hero-input');
          if (input) { input.value = p.name; input.focus(); }
        },
        icon: '👤'
      });
    });
  }
}

// ─── State ───
let _open = false;
let _results = [];
let _selectedIndex = 0;

function render() {
  const overlay = document.getElementById('cmd-palette');
  const input = document.getElementById('cmd-palette-input');
  const results = document.getElementById('cmd-palette-results');
  if (!overlay || !input || !results) return;

  if (!_open) {
    overlay.classList.remove('open');
    overlay.classList.add('closed');
    store.set('commandPaletteOpen', false);
    return;
  }

  overlay.classList.remove('closed');
  overlay.classList.add('open');
  store.set('commandPaletteOpen', true);
  input.focus();

  // Render results
  if (_results.length === 0) {
    results.innerHTML = '<div class="cp-empty">Type to search...</div>';
    return;
  }

  let html = '';
  let currentCategory = '';
  _results.forEach((item, i) => {
    if (item.category !== currentCategory) {
      currentCategory = item.category;
      html += `<div class="cp-category">${item.category}</div>`;
    }
    html += `<div class="cp-item${i === _selectedIndex ? ' cp-selected' : ''}" data-index="${i}">
      <span class="cp-icon">${item.icon || '•'}</span>
      <span class="cp-label">${item.label}</span>
      <span class="cp-desc">${item.description || ''}</span>
    </div>`;
  });
  results.innerHTML = html;

  // Scroll selected into view
  const selected = results.querySelector('.cp-selected');
  if (selected) selected.scrollIntoView({ block: 'nearest' });
}

function search(query) {
  if (!query.trim()) {
    // Show all items grouped when empty
    _results = [..._registry];
  } else {
    const q = query.toLowerCase();
    _results = _registry.filter(item => {
      return item.label.toLowerCase().includes(q)
        || item.keywords.toLowerCase().includes(q)
        || (item.description && item.description.toLowerCase().includes(q));
    });
    // Sort: label match first, then keyword match
    _results.sort((a, b) => {
      const aLabel = a.label.toLowerCase().includes(q) ? 0 : 1;
      const bLabel = b.label.toLowerCase().includes(q) ? 0 : 1;
      return aLabel - bLabel;
    });
  }
  _selectedIndex = 0;
  render();
}

function selectCurrent() {
  const item = _results[_selectedIndex];
  if (item?.action) {
    close();
    setTimeout(() => item.action(), 80);
  }
}

function moveSelection(delta) {
  if (_results.length === 0) return;
  _selectedIndex = (_selectedIndex + delta + _results.length) % _results.length;
  render();
}

function open() {
  _open = true;
  _results = [..._registry];
  _selectedIndex = 0;
  indexPeople(); // re-index people in case context loaded
  render();
}

function close() {
  _open = false;
  render();
}

function toggle() {
  if (_open) close();
  else open();
}

// ─── Keyboard handler ───
function onKeyDown(e) {
  if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
    e.preventDefault();
    toggle();
    return;
  }

  if (!_open) return;

  if (e.key === 'Escape') {
    e.preventDefault();
    close();
    return;
  }

  if (e.key === 'ArrowDown') {
    e.preventDefault();
    moveSelection(1);
    return;
  }

  if (e.key === 'ArrowUp') {
    e.preventDefault();
    moveSelection(-1);
    return;
  }

  if (e.key === 'Enter') {
    e.preventDefault();
    selectCurrent();
    return;
  }
}

// ─── Init ───
export function init() {
  indexPeople();

  document.addEventListener('keydown', onKeyDown);

  const input = document.getElementById('cmd-palette-input');
  if (input) {
    input.addEventListener('input', (e) => search(e.target.value));
    input.addEventListener('keydown', (e) => {
      // Prevent Enter/arrows from propagating to document handler
      if (['Enter', 'ArrowDown', 'ArrowUp'].includes(e.key)) {
        e.stopPropagation();
      }
    });
  }

  const overlay = document.getElementById('cmd-palette');
  if (overlay) {
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) close();
    });
  }

  // Re-index people when context data loads
  store.on('context', () => indexPeople());
}

export const commandPalette = {
  open,
  close,
  toggle,
  search,
  register,
  init
};

export default commandPalette;