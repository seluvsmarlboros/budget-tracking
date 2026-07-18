/* Settings — profile, streak, categories, goals, data, theme */
import { State } from './state.js';
import { toast, cur } from './app.js';

export function initSettings() {
  render();
  State.subscribe(render);
  window.addEventListener('viewchange', e => { if (e.detail === 'settings') render(); });

  // Settings form
  document.getElementById('settings-form').addEventListener('submit', e => {
    e.preventDefault();
    State.data.user.name = document.getElementById('set-name').value.trim();
    State.data.user.currency = document.getElementById('set-currency').value;
    State.data.user.weeklyPocketMoney = parseFloat(document.getElementById('set-budget').value);
    State.data.user.commuteType = document.getElementById('set-commute').value;
    State.data.commute.type = State.data.user.commuteType;
    State.data.user.upiId = document.getElementById('set-upi').value.trim();
    State.data.user.budgetPeriod = document.getElementById('set-period').value;
    State.data.user.targetGoal = document.getElementById('set-target-goal').value.trim();
    State.data.user.cutbackCategory = document.getElementById('set-cutback-category').value;
    State.saveState();
    toast('Settings saved');
  });

  // AI Settings form
  document.getElementById('ai-settings-form').addEventListener('submit', e => {
    e.preventDefault();
    State.data.ai.provider = document.getElementById('set-ai-provider').value;
    State.data.ai.apiKey = document.getElementById('set-ai-key').value.trim();
    State.data.ai.model = document.getElementById('set-ai-model').value;
    State.saveState();
    toast('AI Settings saved');
  });

  document.getElementById('set-ai-provider').addEventListener('change', e => {
    populateModels(e.target.value, '');
  });


  // Category dialog
  const catDialog = document.getElementById('dialog-cat');
  document.getElementById('btn-add-cat').addEventListener('click', () => catDialog.showModal());
  document.getElementById('close-cat-dialog').addEventListener('click', () => catDialog.close());
  document.getElementById('form-cat').addEventListener('submit', e => {
    e.preventDefault();
    const name = document.getElementById('inp-cat-name').value.trim();
    if (State.addCategory(name)) {
      toast(`Added "${name}"`);
      document.getElementById('inp-cat-name').value = '';
      catDialog.close();
    } else {
      toast('Category exists');
    }
  });

  // Goal dialog
  const goalDialog = document.getElementById('dialog-goal');
  document.getElementById('btn-add-goal').addEventListener('click', () => goalDialog.showModal());
  document.getElementById('close-goal-dialog').addEventListener('click', () => goalDialog.close());
  document.getElementById('form-goal').addEventListener('submit', e => {
    e.preventDefault();
    const name = document.getElementById('goal-name').value.trim();
    const target = document.getElementById('goal-target').value;
    const saved = document.getElementById('goal-saved').value || 0;
    if (!name || !target) return;
    State.addSavingsGoal({ name, target, saved });
    toast('Goal created');
    goalDialog.close();
    document.getElementById('form-goal').reset();
  });

  // Category tag delete (delegated)
  document.getElementById('cat-tags').addEventListener('click', e => {
    const btn = e.target.closest('[data-del-cat]');
    if (!btn) return;
    State.deleteCategory(btn.dataset.delCat);
    toast('Category removed');
  });

  // Goals list actions (delegated)
  document.getElementById('goals-list').addEventListener('click', e => {
    const addBtn = e.target.closest('[data-add-goal]');
    const delBtn = e.target.closest('[data-del-goal]');
    if (addBtn) {
      const idx = parseInt(addBtn.dataset.addGoal);
      const amount = prompt('Amount to add:');
      if (amount && parseFloat(amount) > 0) {
        State.addSavingsAmount(idx, amount);
        toast('Saved!');
      }
    }
    if (delBtn) {
      const idx = parseInt(delBtn.dataset.delGoal);
      if (confirm('Delete this goal?')) {
        State.deleteSavingsGoal(idx);
        toast('Goal deleted');
      }
    }
  });

  // Export
  document.getElementById('btn-export').addEventListener('click', () => {
    const blob = new Blob([JSON.stringify(State.data, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `unispend-backup-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    toast('Backup downloaded');
  });

  // Import
  document.getElementById('btn-import').addEventListener('change', e => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const data = JSON.parse(reader.result);
        State.data = data;
        State.saveState();
        toast('Data imported');
        render();
      } catch {
        toast('Invalid file');
      }
    };
    reader.readAsText(file);
  });

  // Reset
  document.getElementById('btn-reset').addEventListener('click', () => {
    if (confirm('This will delete ALL your data. Continue?')) {
      State.resetState();
      location.reload();
    }
  });

  // Dark mode toggle
  const toggle = document.getElementById('toggle-dark');
  const isDark = localStorage.getItem('unispend_dark') === '1';
  if (isDark) { document.body.classList.add('dark'); toggle.checked = true; }
  toggle.addEventListener('change', () => {
    document.body.classList.toggle('dark', toggle.checked);
    localStorage.setItem('unispend_dark', toggle.checked ? '1' : '0');
  });

  // Dashboard Widget Toggles
  const toggles = {
    showBudget: document.getElementById('widget-toggle-budget'),
    showAiBar: document.getElementById('widget-toggle-aibar'),
    showStats: document.getElementById('widget-toggle-stats'),
    showRecent: document.getElementById('widget-toggle-recent')
  };

  Object.entries(toggles).forEach(([key, el]) => {
    if (!el) return;
    el.addEventListener('change', () => {
      State.data.widgetSettings[key] = el.checked;
      State.saveState();
      import('./dashboard.js').then(m => m.updateDashboardWidgets());
    });
  });

  // Auto rules form
  const ruleForm = document.getElementById('auto-rule-form');
  if (ruleForm) {
    ruleForm.addEventListener('submit', e => {
      e.preventDefault();
      const keyword = document.getElementById('rule-keyword').value.trim();
      const category = document.getElementById('rule-category').value;
      if (!keyword || !category) return;
      
      State.data.rules = State.data.rules || [];
      if (State.data.rules.some(r => r.keyword.toLowerCase() === keyword.toLowerCase())) {
        toast('Rule already exists');
        return;
      }
      State.data.rules.push({ keyword, category });
      State.saveState();
      toast(`Added rule: ${keyword} → ${category}`);
      ruleForm.reset();
      renderRulesList();
    });
  }

  // Auto rules delete
  const rulesTags = document.getElementById('rules-tags');
  if (rulesTags) {
    rulesTags.addEventListener('click', e => {
      const btn = e.target.closest('[data-del-rule]');
      if (!btn) return;
      const kw = btn.dataset.delRule;
      State.data.rules = (State.data.rules || []).filter(r => r.keyword !== kw);
      State.saveState();
      toast('Rule removed');
      renderRulesList();
    });
  }
}

function render() {
  const { user, categories, wallet } = State.data;

  // Streak
  document.getElementById('set-streak').textContent = user.streak || 0;
  document.getElementById('set-active-days').textContent = user.totalDaysActive || 0;

  // Form values
  document.getElementById('set-name').value = user.name || '';
  document.getElementById('set-currency').value = user.currency || '₹';
  document.getElementById('set-budget').value = user.weeklyPocketMoney || '';
  document.getElementById('set-commute').value = user.commuteType || 'metro';
  document.getElementById('set-upi').value = user.upiId || '';
  document.getElementById('set-period').value = user.budgetPeriod || 'week';
  document.getElementById('set-target-goal').value = user.targetGoal || '';
  document.getElementById('set-cutback-category').value = user.cutbackCategory || 'Canteen';

  // AI values
  const ai = State.data.ai || { provider: 'openrouter', apiKey: '', model: 'meta-llama/llama-3.3-70b-instruct:free' };
  document.getElementById('set-ai-provider').value = ai.provider || 'openrouter';
  document.getElementById('set-ai-key').value = ai.apiKey || '';
  populateModels(ai.provider || 'openrouter', ai.model);

  // Categories
  document.getElementById('cat-tags').innerHTML = categories.map(c =>
    `<span class="tag">${c}<button data-del-cat="${c}">×</button></span>`
  ).join('');

  // Goals
  const goals = wallet.savingsGoals || [];
  const goalsList = document.getElementById('goals-list');
  if (goals.length === 0) {
    goalsList.innerHTML = '<p class="empty-state">No goals yet</p>';
  } else {
    goalsList.innerHTML = goals.map((g, i) => {
      const pct = g.target > 0 ? Math.min((g.saved / g.target) * 100, 100) : 0;
      return `<div class="goal-item">
        <div class="goal-head">
          <strong>${g.name}</strong>
          <span>${cur(g.saved)} / ${cur(g.target)}</span>
        </div>
        <div class="goal-bar"><div class="goal-fill" style="width:${pct}%"></div></div>
        <div class="goal-actions">
          <button class="btn-ghost btn-sm" data-add-goal="${i}">+ Add funds</button>
          <button class="btn-ghost btn-sm" data-del-goal="${i}" style="color:var(--red)">Delete</button>
        </div>
      </div>`;
    }).join('');
  }

  // Widget Checkboxes Sync
  const settings = State.data.widgetSettings || { showBudget: true, showAiBar: true, showStats: true, showRecent: true };
  if (document.getElementById('widget-toggle-budget')) document.getElementById('widget-toggle-budget').checked = settings.showBudget !== false;
  if (document.getElementById('widget-toggle-aibar')) document.getElementById('widget-toggle-aibar').checked = settings.showAiBar !== false;
  if (document.getElementById('widget-toggle-stats')) document.getElementById('widget-toggle-stats').checked = settings.showStats !== false;
  if (document.getElementById('widget-toggle-recent')) document.getElementById('widget-toggle-recent').checked = settings.showRecent !== false;

  // Rules Dropdown Category Sync
  const ruleCatSelect = document.getElementById('rule-category');
  if (ruleCatSelect) {
    ruleCatSelect.innerHTML = categories.map(c => `<option value="${c}">${c}</option>`).join('');
  }

  renderRulesList();
}

function renderRulesList() {
  const container = document.getElementById('rules-tags');
  if (!container) return;
  const rules = State.data.rules || [];
  if (rules.length === 0) {
    container.innerHTML = '<div class="empty-state" style="padding: 12px 0;">No active rules. Add one above!</div>';
  } else {
    container.innerHTML = rules.map(r => 
      `<span class="tag" style="border: 1px solid var(--border); background: var(--bg-body); font-size: 12px; border-radius: var(--radius-sm); padding: 4px 8px; display: inline-flex; align-items: center; gap: 6px; margin: 4px;">
        <strong>${r.keyword}</strong> &rarr; <span class="muted">${r.category}</span>
        <button data-del-rule="${r.keyword}" style="background: none; border: none; font-size: 14px; line-height: 1; cursor: pointer; color: var(--text-muted);">&times;</button>
      </span>`
    ).join('');
  }
}

const PROVIDER_MODELS = {
  openrouter: [
    { val: 'meta-llama/llama-3.3-70b-instruct:free', txt: 'meta-llama/llama-3.3-70b-instruct:free (Recommended - Free)' },
    { val: 'qwen/qwen3-coder:free', txt: 'qwen/qwen3-coder:free (Free)' },
    { val: 'qwen/qwen3-next-80b-a3b-instruct:free', txt: 'qwen/qwen3-next-80b-a3b-instruct:free (Free)' },
    { val: 'meta-llama/llama-3.2-3b-instruct:free', txt: 'meta-llama/llama-3.2-3b-instruct:free (Free)' }
  ],
  gemini: [
    { val: 'gemini-2.5-flash', txt: 'gemini-2.5-flash (Recommended - Free)' },
    { val: 'gemini-1.5-flash', txt: 'gemini-1.5-flash (Free)' },
    { val: 'gemini-2.5-flash-lite', txt: 'gemini-2.5-flash-lite' }
  ],
  groq: [
    { val: 'llama-3.3-70b-versatile', txt: 'llama-3.3-70b-versatile (Recommended - Free)' },
    { val: 'llama-3.1-8b-instant', txt: 'llama-3.1-8b-instant (Free)' },
    { val: 'gemma2-9b-it', txt: 'gemma2-9b-it (Free)' }
  ]
};

function populateModels(provider, selectedValue) {
  const sel = document.getElementById('set-ai-model');
  if (!sel) return;
  const models = PROVIDER_MODELS[provider] || [];
  sel.innerHTML = models.map(m => `<option value="${m.val}"${m.val === selectedValue ? ' selected' : ''}>${m.txt}</option>`).join('');

  const keyInput = document.getElementById('set-ai-key');
  const keyLabel = document.getElementById('ai-key-label');
  if (provider === 'openrouter') {
    keyLabel.textContent = 'OpenRouter API Key';
    keyInput.placeholder = 'sk-or-v1-...';
  } else if (provider === 'gemini') {
    keyLabel.textContent = 'Google AI Studio API Key';
    keyInput.placeholder = 'AIzaSy...';
  } else {
    keyLabel.textContent = 'Groq API Key';
    keyInput.placeholder = 'gsk_...';
  }
}
